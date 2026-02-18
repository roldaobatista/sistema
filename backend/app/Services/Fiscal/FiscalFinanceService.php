<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use App\Models\Tenant;
use Illuminate\Support\Facades\Log;

/**
 * Financial integration: reconciliation (#21), boleto (#22),
 * split payment (#23), retentions (#24), gateway integration (#25).
 */
class FiscalFinanceService
{
    /**
     * #21 — Reconcile a fiscal note with accounts receivable.
     */
    public function reconcileWithReceivables(FiscalNote $note): array
    {
        if (! $note->isAuthorized()) {
            return ['success' => false, 'error' => 'Nota não autorizada para conciliação'];
        }

        // Create receivable entry linked to the fiscal note
        $receivableData = [
            'tenant_id' => $note->tenant_id,
            'customer_id' => $note->customer_id,
            'fiscal_note_id' => $note->id,
            'amount' => $note->total_amount,
            'description' => "{$note->type} #{$note->number}",
            'due_date' => now()->addDays(30),
            'status' => 'pending',
        ];

        $note->update([
            'payment_data' => array_merge($note->payment_data ?? [], [
                'reconciled' => true,
                'reconciled_at' => now()->toIso8601String(),
            ]),
        ]);

        Log::info('FiscalFinance: reconciled', ['note_id' => $note->id, 'amount' => $note->total_amount]);

        return ['success' => true, 'receivable' => $receivableData];
    }

    /**
     * #22 — Generate boleto data associated with the NF-e.
     */
    public function generateBoletoData(FiscalNote $note, array $boletoConfig = []): array
    {
        if (! $note->isAuthorized()) {
            return ['success' => false, 'error' => 'Nota não autorizada'];
        }

        $boletoData = [
            'valor' => $note->total_amount,
            'vencimento' => $boletoConfig['vencimento'] ?? now()->addDays(30)->format('Y-m-d'),
            'pagador' => [
                'nome' => $note->customer?->name,
                'documento' => $note->customer?->cpf_cnpj,
                'endereco' => $note->customer?->address,
            ],
            'beneficiario' => [
                'nome' => $note->tenant?->name,
                'documento' => $note->tenant?->cnpj,
            ],
            'numero_documento' => "NF{$note->number}",
            'instrucoes' => $boletoConfig['instrucoes'] ?? 'Não receber após o vencimento.',
        ];

        $note->update([
            'payment_data' => array_merge($note->payment_data ?? [], [
                'boleto' => $boletoData,
                'boleto_generated_at' => now()->toIso8601String(),
            ]),
        ]);

        return ['success' => true, 'boleto' => $boletoData];
    }

    /**
     * #23 — Register split payment for a fiscal note.
     */
    public function applySplitPayment(FiscalNote $note, array $payments): array
    {
        $totalPayments = collect($payments)->sum('valor');
        if (abs($totalPayments - $note->total_amount) > 0.01) {
            return ['success' => false, 'error' => "Soma dos pagamentos (R$ {$totalPayments}) difere do total da nota (R$ {$note->total_amount})"];
        }

        $formattedPayments = collect($payments)->map(fn($p, $i) => [
            'seq' => $i + 1,
            'forma_pagamento' => $p['forma_pagamento'],
            'valor' => $p['valor'],
            'bandeira' => $p['bandeira'] ?? null,
            'autorizacao' => $p['autorizacao'] ?? null,
        ])->values()->all();

        $note->update([
            'payment_data' => array_merge($note->payment_data ?? [], [
                'split' => $formattedPayments,
                'split_count' => count($formattedPayments),
            ]),
        ]);

        return ['success' => true, 'payments' => $formattedPayments];
    }

    /**
     * #24 — Calculate automatic tax retentions (IRRF, CSLL, INSS, PIS, COFINS).
     */
    public function calculateRetentions(array $items, Tenant $tenant): array
    {
        $totalServicos = collect($items)->sum(fn($i) => ($i['valor_unitario'] ?? 0) * ($i['quantidade'] ?? 1));

        $retentions = [];

        // IRRF — retained if service > R$ 666,66 or for certain services
        if ($totalServicos > 666.66) {
            $retentions['irrf'] = [
                'base_calculo' => $totalServicos,
                'aliquota' => 0.015, // 1.5%
                'valor' => round($totalServicos * 0.015, 2),
            ];
        }

        // INSS — retained if service > R$ 1,000 (certain service types)
        if ($totalServicos > 1000) {
            $retentions['inss'] = [
                'base_calculo' => $totalServicos,
                'aliquota' => 0.11, // 11%
                'valor' => round($totalServicos * 0.11, 2),
            ];
        }

        // CSLL, PIS, COFINS — retained if total > R$ 5,000
        if ($totalServicos > 5000) {
            $retentions['csll'] = ['base_calculo' => $totalServicos, 'aliquota' => 0.01, 'valor' => round($totalServicos * 0.01, 2)];
            $retentions['pis'] = ['base_calculo' => $totalServicos, 'aliquota' => 0.0065, 'valor' => round($totalServicos * 0.0065, 2)];
            $retentions['cofins'] = ['base_calculo' => $totalServicos, 'aliquota' => 0.03, 'valor' => round($totalServicos * 0.03, 2)];
        }

        $totalRetido = collect($retentions)->sum('valor');

        return [
            'total_servicos' => $totalServicos,
            'total_retido' => $totalRetido,
            'valor_liquido' => $totalServicos - $totalRetido,
            'retencoes' => $retentions,
        ];
    }

    /**
     * #25 — Handle auto-emission when payment is confirmed via gateway.
     */
    public function onPaymentConfirmed(int $tenantId, int $customerId, float $amount, string $transactionId): array
    {
        // Check if there's a pending scheduled emission for this customer
        $scheduled = \App\Models\FiscalScheduledEmission::where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->where('status', 'pending')
            ->first();

        if ($scheduled) {
            $scheduled->update(['status' => 'processing']);
            $automation = app(FiscalAutomationService::class);
            return $automation->processScheduledEmissions();
        }

        return [
            'success' => true,
            'action' => 'payment_recorded',
            'transaction_id' => $transactionId,
            'amount' => $amount,
            'note' => 'Nenhuma emissão agendada encontrada para este cliente',
        ];
    }
}
