<?php

namespace App\Observers;

use App\Models\AccountReceivable;
use App\Models\CommissionEvent;
use App\Models\CommissionRule;
use App\Models\CrmActivity;
use App\Models\CrmDeal;
use App\Models\Notification;
use App\Models\Quote;
use App\Models\WorkOrder;

class CrmObserver
{
    /**
     * WorkOrder status changed to completed → log activity + schedule follow-up.
     */
    public function workOrderUpdated(WorkOrder $wo): void
    {
        if (!$wo->wasChanged('status') || !$wo->customer_id) {
            return;
        }

        $status = $wo->status;
        $fromStatus = $wo->getOriginal('status');
        $statusLabels = WorkOrder::STATUSES;

        // Notify creator + assignee about status change
        $notifyUserIds = array_unique(array_filter([$wo->created_by, $wo->assigned_to]));
        $toLabel = $statusLabels[$status]['label'] ?? $status;
        $fromLabel = $statusLabels[$fromStatus]['label'] ?? $fromStatus;
        foreach ($notifyUserIds as $uid) {
            Notification::notify($wo->tenant_id, $uid, 'os_status_changed',
                "OS {$wo->number}: {$toLabel}",
                [
                    'message' => "Status alterado de {$fromLabel} para {$toLabel}",
                    'icon' => 'file-text',
                    'color' => $statusLabels[$status]['color'] ?? 'info',
                    'link' => "/os/{$wo->id}",
                    'notifiable_type' => WorkOrder::class,
                    'notifiable_id' => $wo->id,
                ]
            );
        }

        if ($status === WorkOrder::STATUS_COMPLETED) {
            CrmActivity::logSystemEvent(
                $wo->tenant_id,
                $wo->customer_id,
                "OS {$wo->os_number} concluída",
                null,
                $wo->assigned_to,
                [
                    'work_order_id' => $wo->id,
                    'total' => (float) $wo->total,
                ]
            );

            // Schedule follow-up activity in 7 days if value > 500
            if ($wo->total > 500) {
                CrmActivity::create([
                    'tenant_id' => $wo->tenant_id,
                    'type' => 'tarefa',
                    'customer_id' => $wo->customer_id,
                    'user_id' => $wo->assigned_to ?? $wo->created_by ?? 1,
                    'title' => "Follow-up pós-serviço: OS {$wo->os_number}",
                    'description' => "Ligar para o cliente para verificar satisfação após OS concluída (valor: R$ {$wo->total})",
                    'scheduled_at' => now()->addDays(7),
                    'is_automated' => true,
                    'channel' => 'telefone',
                    'metadata' => ['work_order_id' => $wo->id],
                ]);
            }

            // Update last_contact_at + health score
            $wo->customer?->update(['last_contact_at' => now()]);
            $wo->customer?->recalculateHealthScore();

            // ── Auto-generate invoice (AccountReceivable) ──
            if ($wo->total > 0 && !AccountReceivable::where('work_order_id', $wo->id)->exists()) {
                AccountReceivable::create([
                    'tenant_id'    => $wo->tenant_id,
                    'customer_id'  => $wo->customer_id,
                    'work_order_id'=> $wo->id,
                    'created_by'   => $wo->assigned_to ?? $wo->created_by ?? 1,
                    'description'  => "OS {$wo->number}",
                    'amount'       => $wo->total,
                    'due_date'     => now()->addDays(30),
                ]);
            }

            // ── Auto-generate commission (multi-technician) ──
            if ($wo->total > 0 && !CommissionEvent::where('work_order_id', $wo->id)->exists()) {
                $technicianIds = $wo->technicians()->pluck('users.id');
                if ($technicianIds->isEmpty() && $wo->assigned_to) {
                    $technicianIds = collect([$wo->assigned_to]);
                }

                foreach ($technicianIds as $techId) {
                    $rules = CommissionRule::where('tenant_id', $wo->tenant_id)
                        ->where('is_active', true)
                        ->where(function ($q) use ($techId) {
                            $q->whereNull('user_id')->orWhere('user_id', $techId);
                        })
                        ->get();

                    foreach ($rules as $rule) {
                        $amount = $rule->calculate($wo);
                        if ($amount > 0) {
                            CommissionEvent::create([
                                'tenant_id'          => $wo->tenant_id,
                                'user_id'            => $techId,
                                'work_order_id'      => $wo->id,
                                'commission_rule_id' => $rule->id,
                                'base_value'         => $wo->total,
                                'commission_amount'  => $amount,
                                'status'             => 'pending',
                            ]);
                            break; // primeira regra aplicável por técnico
                        }
                    }
                }
            }
        }

        if ($status === WorkOrder::STATUS_DELIVERED) {
            CrmActivity::logSystemEvent(
                $wo->tenant_id,
                $wo->customer_id,
                "OS {$wo->os_number} entregue ao cliente",
                null,
                $wo->assigned_to,
                ['work_order_id' => $wo->id]
            );
            $wo->customer?->recalculateHealthScore();
        }
    }

    /**
     * Quote approved → mark linked deal as won + log activity.
     * Quote rejected → log activity "Entender motivo" in 3 days.
     */
    public function quoteUpdated(Quote $quote): void
    {
        if (!$quote->customer_id) {
            return;
        }

        // Quote approved
        if ($quote->wasChanged('approved_at') && $quote->approved_at) {
            CrmActivity::logSystemEvent(
                $quote->tenant_id,
                $quote->customer_id,
                "Orçamento {$quote->quote_number} aprovado — R$ " . number_format((float) $quote->total, 2, ',', '.'),
                null,
                $quote->seller_id,
                ['quote_id' => $quote->id, 'total' => (float) $quote->total]
            );

            // Find linked open deal and mark as won
            $deal = CrmDeal::where('quote_id', $quote->id)
                ->where('status', 'open')
                ->first();

            if ($deal) {
                $deal->markAsWon();

                CrmActivity::logSystemEvent(
                    $quote->tenant_id,
                    $quote->customer_id,
                    "Deal \"{$deal->title}\" ganho automaticamente (orçamento aprovado)",
                    $deal->id,
                    $quote->seller_id,
                    ['quote_id' => $quote->id, 'deal_id' => $deal->id]
                );
            }

            // Update customer last_contact_at
            $quote->customer?->update(['last_contact_at' => now()]);
        }

        // Quote rejected
        if ($quote->wasChanged('rejected_at') && $quote->rejected_at) {
            CrmActivity::logSystemEvent(
                $quote->tenant_id,
                $quote->customer_id,
                "Orçamento {$quote->quote_number} rejeitado" . ($quote->rejection_reason ? ": {$quote->rejection_reason}" : ''),
                null,
                $quote->seller_id,
                ['quote_id' => $quote->id, 'reason' => $quote->rejection_reason]
            );

            // Schedule "understand reason" activity in 3 days
            CrmActivity::create([
                'tenant_id' => $quote->tenant_id,
                'type' => 'tarefa',
                'customer_id' => $quote->customer_id,
                'user_id' => $quote->seller_id ?? 1,
                'title' => "Entender motivo rejeição: Orc. {$quote->quote_number}",
                'description' => "O orçamento foi rejeitado" . ($quote->rejection_reason ? " (motivo: {$quote->rejection_reason})" : '') . ". Ligar para entender e tentar reverter.",
                'scheduled_at' => now()->addDays(3),
                'is_automated' => true,
                'channel' => 'telefone',
                'metadata' => ['quote_id' => $quote->id],
            ]);

            // Find linked deal and mark as lost
            $deal = CrmDeal::where('quote_id', $quote->id)
                ->where('status', 'open')
                ->first();

            if ($deal) {
                $deal->markAsLost($quote->rejection_reason ?? 'Orçamento rejeitado');
            }
        }
    }
}
