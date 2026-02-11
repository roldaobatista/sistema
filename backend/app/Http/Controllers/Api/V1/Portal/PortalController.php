<?php

namespace App\Http\Controllers\Api\V1\Portal;

use App\Events\QuoteApproved;
use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\Quote;
use App\Models\ServiceCall;
use App\Models\User;
use Illuminate\Http\Request;

class PortalController extends Controller
{
    /**
     * Listar Ordens de Servico do cliente logado.
     */
    public function workOrders(Request $request)
    {
        $user = $request->user();

        $workOrders = \App\Models\WorkOrder::where('tenant_id', $user->tenant_id)
            ->where('customer_id', $user->customer_id)
            ->with(['equipment', 'items', 'statusHistory'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($workOrders);
    }

    /**
     * Listar Orcamentos do cliente.
     */
    public function quotes(Request $request)
    {
        $user = $request->user();

        $quotes = \App\Models\Quote::where('tenant_id', $user->tenant_id)
            ->where('customer_id', $user->customer_id)
            ->with([
                'seller:id,name',
                'equipments.equipment:id,brand,model,serial_number',
                'equipments.items.product:id,name',
                'equipments.items.service:id,name',
            ])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($quotes);
    }

    /**
     * Aprovar ou rejeitar orcamento pelo portal.
     */
    public function updateQuoteStatus(Request $request, int $id)
    {
        $user = $request->user();

        $quote = \App\Models\Quote::where('tenant_id', $user->tenant_id)
            ->where('customer_id', $user->customer_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'action' => 'required|in:approve,reject',
            'comments' => 'nullable|string|max:500',
        ]);

        if ($quote->status !== Quote::STATUS_SENT) {
            return response()->json(['message' => 'Este orcamento nao pode mais ser alterado.'], 422);
        }

        if ($quote->isExpired()) {
            return response()->json(['message' => 'Este orcamento esta expirado.'], 422);
        }

        if ($validated['action'] === 'approve') {
            $quote->update([
                'status' => Quote::STATUS_APPROVED,
                'approved_at' => now(),
                'rejection_reason' => null,
            ]);

            $actor = $quote->seller ?: User::where('tenant_id', $quote->tenant_id)->orderBy('id')->first();
            if ($actor) {
                QuoteApproved::dispatch($quote, $actor);
            }
        } else {
            $quote->update([
                'status' => Quote::STATUS_REJECTED,
                'rejected_at' => now(),
                'rejection_reason' => $validated['comments'] ?? null,
            ]);
        }

        return response()->json([
            'message' => "Orcamento {$quote->status} com sucesso.",
            'data' => $quote->fresh(),
        ]);
    }

    /**
     * Listar faturas em aberto.
     */
    public function financials(Request $request)
    {
        $user = $request->user();

        $financials = \App\Models\AccountReceivable::where('tenant_id', $user->tenant_id)
            ->where('customer_id', $user->customer_id)
            ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL])
            ->orderBy('due_date')
            ->get();

        return response()->json($financials);
    }

    /**
     * Abrir novo chamado.
     */
    public function newServiceCall(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'equipment_id' => 'nullable|exists:equipments,id',
            'description' => 'required|string|min:10',
            'priority' => 'nullable|in:low,normal,high,urgent',
        ]);

        // Verifica se equipamento pertence ao cliente no mesmo tenant.
        if (!empty($validated['equipment_id'])) {
            $exists = \App\Models\Equipment::where('tenant_id', $user->tenant_id)
                ->where('id', $validated['equipment_id'])
                ->where('customer_id', $user->customer_id)
                ->exists();

            if (!$exists) {
                return response()->json(['message' => 'Equipamento invalido.'], 403);
            }
        }

        try {
            $serviceCall = ServiceCall::create([
                'tenant_id' => $user->tenant_id,
                'call_number' => ServiceCall::nextNumber($user->tenant_id),
                'customer_id' => $user->customer_id,
                'created_by' => $user->id,
                'status' => ServiceCall::STATUS_OPEN,
                'priority' => $validated['priority'] ?? 'normal',
                'observations' => $validated['description'],
            ]);

            if (!empty($validated['equipment_id'])) {
                $serviceCall->equipments()->attach($validated['equipment_id'], [
                    'observations' => $validated['description'],
                ]);
            }

            event(new \App\Events\ServiceCallCreated($serviceCall, $user));

            return response()->json($serviceCall->load('equipments:id,brand,model,serial_number'), 201);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao abrir chamado. Tente novamente.'], 500);
        }
    }
}
