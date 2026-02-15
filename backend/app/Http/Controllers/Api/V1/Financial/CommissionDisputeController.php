<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class CommissionDisputeController extends Controller
{
    use ApiResponseTrait;

    private const STATUS_OPEN = 'open';
    private const STATUS_ACCEPTED = 'accepted';
    private const STATUS_REJECTED = 'rejected';

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    private function osNumberFilter(Request $request): ?string
    {
        $osNumber = trim((string) $request->get('os_number', ''));
        return $osNumber !== '' ? $osNumber : null;
    }

    public function index(Request $request): JsonResponse
    {
        $osNumber = $this->osNumberFilter($request);
        $query = DB::table('commission_disputes')
            ->where('commission_disputes.tenant_id', $this->tenantId())
            ->join('users', 'commission_disputes.user_id', '=', 'users.id')
            ->join('commission_events', 'commission_disputes.commission_event_id', '=', 'commission_events.id')
            ->leftJoin('work_orders', 'commission_events.work_order_id', '=', 'work_orders.id')
            ->select(
                'commission_disputes.*',
                'users.name as user_name',
                'commission_events.commission_amount',
                'commission_events.base_amount',
                'commission_events.work_order_id',
                'work_orders.os_number',
                'work_orders.number as work_order_number'
            );

        if ($status = $request->get('status')) {
            $query->where('commission_disputes.status', $status);
        }
        if ($userId = $request->get('user_id')) {
            $query->where('commission_disputes.user_id', $userId);
        }
        if ($osNumber) {
            $query->where(function ($q) use ($osNumber) {
                $q->where('work_orders.os_number', 'like', "%{$osNumber}%")
                    ->orWhere('work_orders.number', 'like', "%{$osNumber}%");
            });
        }

        return response()->json($query->orderByDesc('commission_disputes.created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'commission_event_id' => [
                'required',
                Rule::exists('commission_events', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId)),
            ],
            'reason' => 'required|string|min:10|max:2000',
        ]);

        $existing = DB::table('commission_disputes')
            ->where('tenant_id', $tenantId)
            ->where('commission_event_id', $validated['commission_event_id'])
            ->where('status', self::STATUS_OPEN)
            ->exists();

        if ($existing) {
            return $this->error('Ja existe uma contestacao aberta para este evento', 422);
        }

        try {
            $id = DB::transaction(function () use ($tenantId, $validated) {
                $id = DB::table('commission_disputes')->insertGetId([
                    'tenant_id' => $tenantId,
                    'commission_event_id' => $validated['commission_event_id'],
                    'user_id' => auth()->id(),
                    'reason' => $validated['reason'],
                    'status' => self::STATUS_OPEN,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $event = DB::table('commission_events')->find($validated['commission_event_id']);
                DB::table('notifications')->insert([
                    'id' => \Illuminate\Support\Str::uuid(),
                    'type' => 'App\\Notifications\\CommissionDisputed',
                    'notifiable_type' => 'App\\Models\\User',
                    'notifiable_id' => $event->user_id ?? auth()->id(),
                    'data' => json_encode([
                        'title' => 'Comissão contestada',
                        'message' => "Uma contestação foi aberta: {$validated['reason']}",
                        'type' => 'commission_dispute',
                        'dispute_id' => $id,
                    ]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return $id;
            });

            return $this->success(['id' => $id], 'Contestação registrada', 201);
        } catch (\Exception $e) {
            Log::error('Falha ao registrar contestação de comissão', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao registrar contestação', 500);
        }
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in([self::STATUS_ACCEPTED, self::STATUS_REJECTED])],
            'resolution_notes' => 'required|string|min:5|max:2000',
            'new_amount' => 'nullable|numeric|min:0',
        ]);

        $dispute = DB::table('commission_disputes')
            ->where('id', $id)
            ->where('tenant_id', $this->tenantId())
            ->first();

        if (!$dispute) {
            return $this->error('Contestação não encontrada', 404);
        }
        if ($dispute->status !== self::STATUS_OPEN) {
            return $this->error('Contestação já resolvida', 422);
        }

        DB::transaction(function () use ($id, $dispute, $validated) {
            DB::table('commission_disputes')->where('id', $id)->update([
                'status' => $validated['status'],
                'resolution_notes' => $validated['resolution_notes'],
                'resolved_by' => auth()->id(),
                'resolved_at' => now(),
                'updated_at' => now(),
            ]);

            if ($validated['status'] === self::STATUS_ACCEPTED) {
                $event = DB::table('commission_events')
                    ->where('id', $dispute->commission_event_id)
                    ->first();

                $existingNotes = (string) ($event->notes ?? '');
                $suffix = " | Ajustado via contestação #{$id}";

                $eventUpdate = [
                    'notes' => $existingNotes . $suffix,
                    'updated_at' => now(),
                ];

                if (isset($validated['new_amount'])) {
                    $eventUpdate['commission_amount'] = $validated['new_amount'];
                } else {
                    $eventUpdate['status'] = 'reversed';
                }

                DB::table('commission_events')
                    ->where('id', $dispute->commission_event_id)
                    ->update($eventUpdate);
            }
        });

        try {
            $statusLabel = $validated['status'] === self::STATUS_ACCEPTED ? 'aceita' : 'rejeitada';
            DB::table('notifications')->insert([
                'id' => \Illuminate\Support\Str::uuid(),
                'type' => 'App\\Notifications\\CommissionDisputeResolved',
                'notifiable_type' => 'App\\Models\\User',
                'notifiable_id' => $dispute->user_id,
                'data' => json_encode([
                    'title' => 'Contestação ' . ucfirst($statusLabel),
                    'message' => "Sua contestação foi {$statusLabel}: {$validated['resolution_notes']}",
                    'type' => 'commission_dispute',
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable) {
            // Non-critical
        }

        return $this->success(null, "Contestação {$validated['status']}");
    }

    public function show(int $id): JsonResponse
    {
        $dispute = DB::table('commission_disputes')
            ->where('commission_disputes.id', $id)
            ->where('commission_disputes.tenant_id', $this->tenantId())
            ->join('users', 'commission_disputes.user_id', '=', 'users.id')
            ->join('commission_events', 'commission_disputes.commission_event_id', '=', 'commission_events.id')
            ->leftJoin('work_orders', 'commission_events.work_order_id', '=', 'work_orders.id')
            ->leftJoin('users as resolver', 'commission_disputes.resolved_by', '=', 'resolver.id')
            ->select(
                'commission_disputes.*',
                'users.name as user_name',
                'commission_events.commission_amount',
                'commission_events.base_amount',
                'commission_events.work_order_id',
                'commission_events.status as event_status',
                'work_orders.os_number',
                'work_orders.number as work_order_number',
                'resolver.name as resolved_by_name'
            )
            ->first();

        if (!$dispute) {
            return $this->error('Contestação não encontrada', 404);
        }

        return $this->success($dispute);
    }

    public function destroy(int $id): JsonResponse
    {
        $dispute = DB::table('commission_disputes')
            ->where('id', $id)
            ->where('tenant_id', $this->tenantId())
            ->first();

        if (!$dispute) {
            return $this->error('Contestação não encontrada', 404);
        }

        if ($dispute->status !== self::STATUS_OPEN) {
            return $this->error('Apenas contestações abertas podem ser canceladas', 422);
        }

        $userId = auth()->id();
        $isOwner = (int) $dispute->user_id === (int) $userId;
        $isAdmin = auth()->user()->hasRole(['super_admin', 'admin']);

        if (!$isOwner && !$isAdmin) {
            return $this->error('Sem permissão para cancelar esta contestação', 403);
        }

        try {
            DB::table('commission_disputes')->where('id', $id)->delete();
            return $this->success(null, 'Contestação cancelada');
        } catch (\Exception $e) {
            Log::error('Falha ao cancelar contestação', ['error' => $e->getMessage()]);
            return $this->error('Erro ao cancelar contestação', 500);
        }
    }
}
