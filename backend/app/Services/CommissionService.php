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

                foreach ($rules as $rule) {
                    $commissionAmount = $rule->calculateCommission((float) $wo->total, $context);

                    if (bccomp((string) $commissionAmount, '0', 2) <= 0) {
                        continue;
                    }

                    $campaignResult = $this->applyCampaignMultiplier($campaigns, $b['role'], $rule->calculation_type, (string) $commissionAmount);

                    $notes = "Regra: {$rule->name} ({$rule->calculation_type})";
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

        // 1. Técnico Principal
        if ($wo->assigned_to) {
            $list[] = ['id' => $wo->assigned_to, 'role' => CommissionRule::ROLE_TECHNICIAN];
        }

        // 2. Vendedor
        if ($wo->seller_id) {
             // Evita duplicar se for a mesma pessoa, mas papeis diferentes podem acumular comissao?
             // Geralmente sim (ex: tecnico que vendeu). Deixaremos acumular.
            $list[] = ['id' => $wo->seller_id, 'role' => CommissionRule::ROLE_SELLER];
        }

        // 3. Motorista
        if ($wo->driver_id) {
            $list[] = ['id' => $wo->driver_id, 'role' => CommissionRule::ROLE_DRIVER];
        }

        // 4. Técnicos Auxiliares (N:N)
        foreach ($wo->technicians as $tech) {
            $role = $tech->pivot->role ?? CommissionRule::ROLE_TECHNICIAN;
            
            // Verifica se já não adicionamos este user com este role (ex: assigned_to tbm está na pivot)
            $exists = collect($list)->contains(fn ($item) => $item['id'] == $tech->id && $item['role'] == $role);
            
            if (!$exists) {
                $list[] = ['id' => $tech->id, 'role' => $role];
            }
        }

        return $list;
    }

    /**
     * Libera comissões quando uma conta a receber é paga (se a regra for 'ao receber').
     */
    public function releaseByPayment(AccountReceivable $ar): void
    {
        if (!$ar->work_order_id) {
            return;
        }

        DB::transaction(function () use ($ar) {
            $pendingEvents = CommissionEvent::where('work_order_id', $ar->work_order_id)
                ->where('tenant_id', $ar->tenant_id)
                ->where('status', CommissionEvent::STATUS_PENDING)
                ->lockForUpdate()
                ->get();

            foreach ($pendingEvents as $event) {
                $event->update([
                    'status' => CommissionEvent::STATUS_APPROVED,
                    'notes' => ($event->notes ?? '') . " | Liberada por pagamento #{$ar->id} em " . now()->format('d/m/Y'),
                ]);
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
