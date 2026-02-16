<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionDispute;
use App\Models\CommissionEvent;
use App\Models\Role;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class CommissionDisputeController extends Controller
{
    use ApiResponseTrait;

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = CommissionDispute::with(['user:id,name', 'commissionEvent.workOrder:id,os_number,number'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('user_id'), fn ($q, $u) => $q->where('user_id', $u))
            ->when($request->get('os_number'), function ($q) use ($request) {
                $term = '%' . $request->get('os_number') . '%';
                $q->whereHas('commissionEvent.workOrder', fn ($wq) => $wq->where('os_number', 'like', $term)->orWhere('number', 'like', $term));
            })
            ->orderByDesc('created_at');

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'commission_event_id' => [
                'required',
                Rule::exists('commission_events', 'id')->where(fn ($q) => $q->where('tenant_id', $this->tenantId())),
            ],
            'reason' => 'required|string|min:10|max:2000',
        ]);

        $existing = CommissionDispute::where('commission_event_id', $validated['commission_event_id'])
            ->where('status', CommissionDispute::STATUS_OPEN)
            ->exists();

        if ($existing) {
            return $this->error('Já existe uma contestação aberta para este evento', 422);
        }

        try {
            $dispute = DB::transaction(function () use ($validated) {
                $dispute = CommissionDispute::create([
                    'commission_event_id' => $validated['commission_event_id'],
                    'user_id' => auth()->id(),
                    'reason' => $validated['reason'],
                    'status' => CommissionDispute::STATUS_OPEN,
                ]);

                $event = CommissionEvent::find($validated['commission_event_id']);
                DB::table('notifications')->insert([
                    'id' => \Illuminate\Support\Str::uuid(),
                    'type' => 'App\\Notifications\\CommissionDisputed',
                    'notifiable_type' => 'App\\Models\\User',
                    'notifiable_id' => $event->user_id ?? auth()->id(),
                    'data' => json_encode([
                        'title' => 'Comissão contestada',
                        'message' => "Uma contestação foi aberta: {$validated['reason']}",
                        'type' => 'commission_dispute',
                        'dispute_id' => $dispute->id,
                    ]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return $dispute;
            });

            return $this->success(['id' => $dispute->id], 'Contestação registrada', 201);
        } catch (\Exception $e) {
            Log::error('Falha ao registrar contestação de comissão', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao registrar contestação', 500);
        }
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in([CommissionDispute::STATUS_ACCEPTED, CommissionDispute::STATUS_REJECTED])],
            'resolution_notes' => 'required|string|min:5|max:2000',
            'new_amount' => 'nullable|numeric|min:0',
        ]);

        $dispute = CommissionDispute::find($id);

        if (!$dispute) {
            return $this->error('Contestação não encontrada', 404);
        }
        if (!$dispute->isOpen()) {
            return $this->error('Contestação já resolvida', 422);
        }

        DB::transaction(function () use ($dispute, $validated) {
            $dispute->update([
                'status' => $validated['status'],
                'resolution_notes' => $validated['resolution_notes'],
                'resolved_by' => auth()->id(),
                'resolved_at' => now(),
            ]);

            if ($validated['status'] === CommissionDispute::STATUS_ACCEPTED) {
                $event = $dispute->commissionEvent;

                $suffix = " | Ajustado via contestação #{$dispute->id}";

                if (isset($validated['new_amount'])) {
                    $event->update([
                        'commission_amount' => $validated['new_amount'],
                        'notes' => ($event->notes ?? '') . $suffix,
                    ]);
                } else {
                    $event->update([
                        'status' => CommissionEvent::STATUS_REVERSED,
                        'notes' => ($event->notes ?? '') . $suffix,
                    ]);
                }
            }
        });

        try {
            $statusLabel = $validated['status'] === CommissionDispute::STATUS_ACCEPTED ? 'aceita' : 'rejeitada';
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
        $dispute = CommissionDispute::with([
            'user:id,name',
            'commissionEvent.workOrder:id,os_number,number',
            'resolver:id,name',
        ])->find($id);

        if (!$dispute) {
            return $this->error('Contestação não encontrada', 404);
        }

        return $this->success($dispute);
    }

    public function destroy(int $id): JsonResponse
    {
        $dispute = CommissionDispute::find($id);

        if (!$dispute) {
            return $this->error('Contestação não encontrada', 404);
        }

        if (!$dispute->isOpen()) {
            return $this->error('Apenas contestações abertas podem ser canceladas', 422);
        }

        $userId = auth()->id();
        $isOwner = (int) $dispute->user_id === (int) $userId;
        $isAdmin = auth()->user()->hasRole([Role::SUPER_ADMIN, Role::ADMIN]);

        if (!$isOwner && !$isAdmin) {
            return $this->error('Sem permissão para cancelar esta contestação', 403);
        }

        try {
            $dispute->delete();
            return $this->success(null, 'Contestação cancelada');
        } catch (\Exception $e) {
            Log::error('Falha ao cancelar contestação', ['error' => $e->getMessage()]);
            return $this->error('Erro ao cancelar contestação', 500);
        }
    }
}
