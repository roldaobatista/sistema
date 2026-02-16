<?php

namespace App\Services;

use App\Models\AccountReceivable;
use App\Models\DebtRenegotiation;
use App\Models\DebtRenegotiationItem;
use Illuminate\Support\Facades\DB;

class DebtRenegotiationService
{
    /**
     * Cria uma renegociação de dívida a partir de parcelas em atraso.
     */
    public function create(array $data, array $receivableIds, int $userId): DebtRenegotiation
    {
        return DB::transaction(function () use ($data, $receivableIds, $userId) {
            $receivables = AccountReceivable::whereIn('id', $receivableIds)->get();
            $originalTotal = $receivables->sum('amount');

            $renegotiation = DebtRenegotiation::create([
                'tenant_id' => $data['tenant_id'],
                'customer_id' => $data['customer_id'],
                'original_total' => $originalTotal,
                'negotiated_total' => $data['negotiated_total'],
                'discount_amount' => $data['discount_amount'] ?? 0,
                'interest_amount' => $data['interest_amount'] ?? 0,
                'fine_amount' => $data['fine_amount'] ?? 0,
                'new_installments' => $data['new_installments'],
                'first_due_date' => $data['first_due_date'],
                'notes' => $data['notes'] ?? null,
                'status' => 'pending',
                'created_by' => $userId,
            ]);

            foreach ($receivables as $ar) {
                DebtRenegotiationItem::create([
                    'debt_renegotiation_id' => $renegotiation->id,
                    'account_receivable_id' => $ar->id,
                    'original_amount' => $ar->amount,
                ]);
            }

            return $renegotiation->load('items');
        });
    }

    /**
     * Aprova e executa a renegociação: cancela parcelas antigas, cria novas.
     */
    public function approve(DebtRenegotiation $renegotiation, int $approverId): DebtRenegotiation
    {
        return DB::transaction(function () use ($renegotiation, $approverId) {
            // Marca parcelas originais como renegociadas
            foreach ($renegotiation->items as $item) {
                $item->receivable->update(['status' => 'renegotiated']);
            }

            // Cria novas parcelas
            $installmentAmount = round($renegotiation->negotiated_total / $renegotiation->new_installments, 2);
            $remainder = $renegotiation->negotiated_total - ($installmentAmount * $renegotiation->new_installments);

            for ($i = 0; $i < $renegotiation->new_installments; $i++) {
                $amount = $installmentAmount;
                if ($i === 0) $amount += $remainder; // ajuste centavos na primeira parcela

                AccountReceivable::create([
                    'tenant_id' => $renegotiation->tenant_id,
                    'customer_id' => $renegotiation->customer_id,
                    'description' => "Renegociação #{$renegotiation->id} — Parcela " . ($i + 1) . "/{$renegotiation->new_installments}",
                    'amount' => $amount,
                    'due_date' => $renegotiation->first_due_date->copy()->addMonths($i),
                    'status' => 'pending',
                    'category' => 'renegotiation',
                ]);
            }

            $renegotiation->update([
                'status' => 'approved',
                'approved_by' => $approverId,
                'approved_at' => now(),
            ]);

            return $renegotiation->fresh();
        });
    }

    /**
     * Rejeita a renegociação.
     */
    public function reject(DebtRenegotiation $renegotiation): DebtRenegotiation
    {
        $renegotiation->update(['status' => 'rejected']);
        return $renegotiation;
    }
}
