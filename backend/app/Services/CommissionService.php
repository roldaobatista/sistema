<?php

namespace App\Services;

use App\Models\AccountReceivable;
use App\Models\CommissionEvent;
use App\Models\CommissionRule;
use App\Models\WorkOrder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CommissionService
{
    /**
     * Gera comissões para uma OS (calcula, aplica campanhas, salva eventos).
     * Retorna array de CommissionEvent criados.
     */
    public function calculateAndGenerate(\App\Models\WorkOrder $wo): array
    {
        // 1. Verificar se já existem comissões para esta OS
        $existing = CommissionEvent::where('tenant_id', $wo->tenant_id)
            ->where('work_order_id', $wo->id)
            ->exists();

        if ($existing) {
            throw new \Exception('Comissões já geradas para esta OS.');
        }

        // 2. Carregar dependências
        $wo->loadMissing(['items', 'technicians', 'customer']);

        // 3. Preparar contexto de cálculo (valores base) — bcmath
        $context = $this->buildCalculationContext($wo);

        // 4. Identificar beneficiários (quem deve receber)
        $beneficiaries = $this->identifyBeneficiaries($wo);

        // 5. Carregar campanhas ativas
        $campaigns = $this->loadActiveCampaigns($wo->tenant_id);

        $events = [];

        // 6. Processar regras para cada beneficiário
        DB::transaction(function () use ($wo, $beneficiaries, $campaigns, $context, &$events) {
            foreach ($beneficiaries as $b) {
                $rules = CommissionRule::where('tenant_id', $wo->tenant_id)
                    ->where('user_id', $b['id'])
                    ->where('applies_to_role', $b['role'])
                    ->where('active', true)
                    ->orderByDesc('priority')
                    ->get();

                // GAP-22: Determine commercial source for seller filter
                $quoteSource = null;
                if ($b['role'] === CommissionRule::ROLE_SELLER && $wo->quote_id) {
                    $quoteSource = $wo->quote?->source;
                }

                foreach ($rules as $rule) {
                    // GAP-22: If rule has a source filter, check match
                    if ($b['role'] === CommissionRule::ROLE_SELLER && $rule->source_filter && $quoteSource) {
                        if ($rule->source_filter !== $quoteSource) {
                            continue;
                        }
                    }

                    $commissionAmount = $rule->calculateCommission((float) $wo->total, $context);

                    if (bccomp((string) $commissionAmount, '0', 2) <= 0) {
                        continue;
                    }

                    // GAP-05: Apply tech split divisor
                    $splitDivisor = $b['split_divisor'] ?? 1;
                    if ($splitDivisor > 1) {
                        $commissionAmount = bcdiv((string) $commissionAmount, (string) $splitDivisor, 2);
                    }

                    $campaignResult = $this->applyCampaignMultiplier($campaigns, $b['role'], $rule->calculation_type, (string) $commissionAmount);

                    $notes = "Regra: {$rule->name} ({$rule->calculation_type})";
                    if ($splitDivisor > 1) {
                        $notes .= " | Divisão 1/{$splitDivisor}";
                    }
                    if ($campaignResult['campaign_name']) {
                        $notes .= " | Campanha: {$campaignResult['campaign_name']} (x{$campaignResult['multiplier']})";
                    }

                    $event = CommissionEvent::create([
                        'tenant_id' => $wo->tenant_id,
                        'commission_rule_id' => $rule->id,
                        'work_order_id' => $wo->id,
                        'user_id' => $b['id'],
                        'base_amount' => $wo->total,
                        'commission_amount' => $campaignResult['final_amount'],
                        'proportion' => 1.0000,
                        'status' => CommissionEvent::STATUS_PENDING,
                        'notes' => $notes,
                    ]);

                    $events[] = $event;
                }
            }
        });

        return $events;
    }

    /**
     * Simula comissões para UI (não salva nada). Aplica campanhas ativas.
     */
    public function simulate(\App\Models\WorkOrder $wo): array
    {
        $wo->loadMissing(['items', 'technicians']);

        $context = $this->buildCalculationContext($wo);
        $beneficiaries = $this->identifyBeneficiaries($wo);
        $campaigns = $this->loadActiveCampaigns($wo->tenant_id);
        $simulations = [];

        foreach ($beneficiaries as $b) {
            $rules = CommissionRule::where('tenant_id', $wo->tenant_id)
                ->where('user_id', $b['id'])
                ->where('applies_to_role', $b['role'])
                ->where('active', true)
                ->get();

            foreach ($rules as $rule) {
                $amount = $rule->calculateCommission((float) $wo->total, $context);

                if (bccomp((string) $amount, '0', 2) <= 0) {
                    continue;
                }

                $campaignResult = $this->applyCampaignMultiplier($campaigns, $b['role'], $rule->calculation_type, (string) $amount);

                $simulations[] = [
                    'user_id' => $b['id'],
                    'user_name' => $rule->user?->name ?? 'Usuario ' . $b['id'],
                    'rule_name' => $rule->name,
                    'calculation_type' => $rule->calculation_type,
                    'applies_to_role' => $rule->applies_to_role,
                    'base_amount' => (float) $wo->total,
                    'commission_amount' => (float) $campaignResult['final_amount'],
                    'multiplier' => (float) $campaignResult['multiplier'],
                    'campaign_name' => $campaignResult['campaign_name'],
                ];
            }
        }

        return $simulations;
    }

    private function identifyBeneficiaries(\App\Models\WorkOrder $wo): array
    {
        $list = [];
        $techIds = [];

        // 1. Técnico Principal
        if ($wo->assigned_to) {
            $list[] = ['id' => $wo->assigned_to, 'role' => CommissionRule::ROLE_TECHNICIAN];
            $techIds[] = $wo->assigned_to;
        }

        // 4. Técnicos Auxiliares (N:N)
        foreach ($wo->technicians as $tech) {
            $role = $tech->pivot->role ?? CommissionRule::ROLE_TECHNICIAN;
            $exists = collect($list)->contains(fn ($item) => $item['id'] == $tech->id && $item['role'] == $role);
            if (!$exists) {
                $list[] = ['id' => $tech->id, 'role' => $role];
                if ($role === CommissionRule::ROLE_TECHNICIAN) {
                    $techIds[] = $tech->id;
                }
            }
        }

        // GAP-05: Count technicians for 50% auto-split
        $techCount = count(array_unique($techIds));

        // Mark each tech entry with the split divisor
        $list = array_map(function ($item) use ($techCount) {
            if ($item['role'] === CommissionRule::ROLE_TECHNICIAN && $techCount > 1) {
                $item['split_divisor'] = $techCount;
            } else {
                $item['split_divisor'] = 1;
            }
            return $item;
        }, $list);

        // 2. Vendedor
        if ($wo->seller_id) {
            // GAP-07: Block same person from earning both tech + seller on same OS
            $isAlsoTech = in_array($wo->seller_id, $techIds);
            if (!$isAlsoTech) {
                $list[] = ['id' => $wo->seller_id, 'role' => CommissionRule::ROLE_SELLER, 'split_divisor' => 1];
            } else {
                Log::info('CommissionService: Seller #{id} is also a technician on OS #{os}. Seller commission blocked (GAP-07).', [
                    'id' => $wo->seller_id, 'os' => $wo->os_number,
                ]);
            }
        }

        // 3. Motorista
        if ($wo->driver_id) {
            $list[] = ['id' => $wo->driver_id, 'role' => CommissionRule::ROLE_DRIVER, 'split_divisor' => 1];
        }

        return $list;
    }

    /**
     * GAP-04: Libera comissões proporcionalmente quando um pagamento é recebido.
     * Se a OS tem total R$10.000 e o pagamento é R$5.000, libera 50% da comissão.
     */
    public function releaseByPayment(AccountReceivable $ar): void
    {
        if (!$ar->work_order_id) {
            return;
        }

        DB::transaction(function () use ($ar) {
            $wo = WorkOrder::find($ar->work_order_id);
            if (!$wo || bccomp((string) $wo->total, '0', 2) <= 0) {
                return;
            }

            // Calculate proportion: payment_amount / os_total
            $proportion = bcdiv((string) $ar->amount, (string) $wo->total, 4);
            // Cap at 1.0
            if (bccomp($proportion, '1', 4) > 0) {
                $proportion = '1.0000';
            }

            $pendingEvents = CommissionEvent::where('work_order_id', $ar->work_order_id)
                ->where('tenant_id', $ar->tenant_id)
                ->where('status', CommissionEvent::STATUS_PENDING)
                ->lockForUpdate()
                ->get();

            foreach ($pendingEvents as $event) {
                // Calculate proportional commission
                $proportionalAmount = bcmul((string) $event->commission_amount, $proportion, 2);

                // Create new event for this partial release
                if (bccomp($proportion, '1', 4) < 0) {
                    // Partial payment → create a released portion, reduce original
                    $remainingAmount = bcsub((string) $event->commission_amount, $proportionalAmount, 2);

                    CommissionEvent::create([
                        'tenant_id' => $event->tenant_id,
                        'commission_rule_id' => $event->commission_rule_id,
                        'work_order_id' => $event->work_order_id,
                        'account_receivable_id' => $ar->id,
                        'user_id' => $event->user_id,
                        'base_amount' => $ar->amount,
                        'commission_amount' => $proportionalAmount,
                        'proportion' => $proportion,
                        'status' => CommissionEvent::STATUS_APPROVED,
                        'notes' => ($event->notes ?? '') . " | Liberada proporcional ({$proportion}) pgto #{$ar->id}",
                    ]);

                    // Reduce original event amount to remaining
                    $event->update([
                        'commission_amount' => $remainingAmount,
                        'notes' => ($event->notes ?? '') . " | Restante após pgto parcial #{$ar->id}",
                    ]);
                } else {
                    // Full payment → approve the event directly
                    $event->update([
                        'status' => CommissionEvent::STATUS_APPROVED,
                        'account_receivable_id' => $ar->id,
                        'proportion' => $proportion,
                        'notes' => ($event->notes ?? '') . " | Liberada por pagamento #{$ar->id} em " . now()->format('d/m/Y'),
                    ]);
                }
            }
        });
    }

    /**
     * Constrói contexto de cálculo com valores base da OS — usando bcmath.
     */
    private function buildCalculationContext(WorkOrder $wo): array
    {
        $expensesTotal = \App\Models\Expense::where('tenant_id', $wo->tenant_id)
            ->where('work_order_id', $wo->id)
            ->where('status', \App\Models\Expense::STATUS_APPROVED)
            ->sum('amount');

        $itemsCost = '0';
        foreach ($wo->items as $item) {
            $itemsCost = bcadd($itemsCost, bcmul((string) $item->cost_price, (string) $item->quantity, 2), 2);
        }

        $productsTotal = '0';
        $servicesTotal = '0';
        foreach ($wo->items as $item) {
            if ($item->type === 'product') {
                $productsTotal = bcadd($productsTotal, (string) $item->total, 2);
            } else {
                $servicesTotal = bcadd($servicesTotal, (string) $item->total, 2);
            }
        }

        return [
            'gross' => (float) $wo->total,
            'expenses' => (float) $expensesTotal,
            'displacement' => (float) ($wo->displacement_value ?? 0),
            'products_total' => (float) $productsTotal,
            'services_total' => (float) $servicesTotal,
            'cost' => (float) $itemsCost,
        ];
    }

    /**
     * Carrega campanhas ativas para o tenant.
     */
    private function loadActiveCampaigns(int $tenantId): Collection
    {
        return DB::table('commission_campaigns')
            ->where('tenant_id', $tenantId)
            ->where('active', true)
            ->where('starts_at', '<=', now()->toDateString())
            ->where('ends_at', '>=', now()->toDateString())
            ->get();
    }

    /**
     * Aplica o maior multiplicador de campanha aplicável — bcmath.
     */
    private function applyCampaignMultiplier(Collection $campaigns, string $role, string $calculationType, string $baseAmount): array
    {
        $multiplier = '1';
        $campaignName = null;

        foreach ($campaigns as $campaign) {
            if ($campaign->applies_to_role && $campaign->applies_to_role !== $role) {
                continue;
            }
            if (isset($campaign->applies_to_calculation_type) && $campaign->applies_to_calculation_type && $campaign->applies_to_calculation_type !== $calculationType) {
                continue;
            }
            if (bccomp((string) $campaign->multiplier, $multiplier, 2) > 0) {
                $multiplier = (string) $campaign->multiplier;
                $campaignName = $campaign->name;
            }
        }

        return [
            'final_amount' => bcmul($baseAmount, $multiplier, 2),
            'multiplier' => $multiplier,
            'campaign_name' => $campaignName,
        ];
    }
}
