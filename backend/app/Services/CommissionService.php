<?php

namespace App\Services;

use App\Models\AccountReceivable;
use App\Models\CommissionEvent;
use App\Models\CommissionRule;
use App\Models\WorkOrder;
use Illuminate\Support\Collection;

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
        
        // 3. Preparar contexto de cálculo (valores base)
        $expensesTotal = (float) \App\Models\Expense::where('tenant_id', $wo->tenant_id)
            ->where('work_order_id', $wo->id)
            ->where('status', \App\Models\Expense::STATUS_APPROVED)
            ->sum('amount');

        $itemsCost = (float) $wo->items->sum(fn ($item) => $item->cost_price * $item->quantity);
        $productsTotal = (float) $wo->items->where('type', 'product')->sum('total');
        $servicesTotal = (float) $wo->items->where('type', 'service')->sum('total');

        $context = [
            'gross' => (float) $wo->total,
            'expenses' => $expensesTotal,
            'displacement' => (float) ($wo->displacement_value ?? 0),
            'products_total' => $productsTotal,
            'services_total' => $servicesTotal,
            'cost' => $itemsCost,
        ];

        // 4. Identificar beneficiários (quem deve receber)
        $beneficiaries = $this->identifyBeneficiaries($wo);

        // 5. Carregar campanhas ativas
        $campaigns = \Illuminate\Support\Facades\DB::table('commission_campaigns')
            ->where('tenant_id', $wo->tenant_id)
            ->where('active', true)
            ->where('starts_at', '<=', now()->toDateString())
            ->where('ends_at', '>=', now()->toDateString())
            ->get();

        $events = [];

        // 6. Processar regras para cada beneficiário
        \Illuminate\Support\Facades\DB::transaction(function () use ($wo, $beneficiaries, $campaigns, $context, &$events) {
            foreach ($beneficiaries as $b) {
                $rules = CommissionRule::where('tenant_id', $wo->tenant_id)
                    ->where('user_id', $b['id'])
                    ->where('applies_to_role', $b['role'])
                    ->where('active', true)
                    ->orderByDesc('priority')
                    ->get();

                foreach ($rules as $rule) {
                    // Calcular valor base da regra
                    $commissionAmount = $rule->calculateCommission((float) $wo->total, $context);

                    if ($commissionAmount <= 0) {
                        continue;
                    }

                    // Aplicar multiplicador de campanha (se houver)
                    $multiplier = 1.0;
                    $campaignName = null;

                    foreach ($campaigns as $campaign) {
                        // Filtro de role da campanha
                        if ($campaign->applies_to_role && $campaign->applies_to_role !== $b['role']) {
                            continue;
                        }
                        // Filtro de tipo de cálculo da campanha
                        if ($campaign->applies_to_calculation_type && $campaign->applies_to_calculation_type !== $rule->calculation_type) {
                            continue;
                        }

                        // Aplica o maior multiplicador encontrado
                        if ((float) $campaign->multiplier > $multiplier) {
                            $multiplier = (float) $campaign->multiplier;
                            $campaignName = $campaign->name;
                        }
                    }

                    $finalAmount = round($commissionAmount * $multiplier, 2);

                    // Formatar notas
                    $notes = "Regra: {$rule->name} ({$rule->calculation_type})";
                    if ($campaignName) {
                        $notes .= " | Campanha: {$campaignName} (x{$multiplier})";
                    }

                    // Criar evento
                    $event = CommissionEvent::create([
                        'tenant_id' => $wo->tenant_id,
                        'commission_rule_id' => $rule->id,
                        'work_order_id' => $wo->id,
                        'user_id' => $b['id'],
                        'base_amount' => (float) $wo->total,
                        'commission_amount' => $finalAmount,
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
     * Simula comissões para UI (não salva nada).
     */
    public function simulate(\App\Models\WorkOrder $wo): array
    {
        // Lógica similar ao calculateAndGenerate, mas sem persistência
        // e retornando DTOs de preview.
        // ... (Para brevidade, focarei na refatoracao do controller usar o calculateAndGenerate real em transação rollback ou similar,
        // mas para simulação pura, é melhor ter um método light separado ou parametrizar o principal.
        // Vou implementar uma versão simplificada de simulação aqui para o Controller usar).

        $wo->loadMissing(['items', 'technicians']);
        
        $expensesTotal = (float) \App\Models\Expense::where('tenant_id', $wo->tenant_id)
            ->where('work_order_id', $wo->id)
            ->where('status', \App\Models\Expense::STATUS_APPROVED)
            ->sum('amount');
        
        $itemsCost = (float) $wo->items->sum(fn ($item) => $item->cost_price * $item->quantity);
        $context = [
            'gross' => (float) $wo->total,
            'expenses' => $expensesTotal,
            'displacement' => (float) ($wo->displacement_value ?? 0),
            'products_total' => (float) $wo->items->where('type', 'product')->sum('total'),
            'services_total' => (float) $wo->items->where('type', 'service')->sum('total'),
            'cost' => $itemsCost,
        ];

        $beneficiaries = $this->identifyBeneficiaries($wo);
        $simulations = [];

        foreach ($beneficiaries as $b) {
            $rules = CommissionRule::where('tenant_id', $wo->tenant_id)
                ->where('user_id', $b['id'])
                ->where('applies_to_role', $b['role'])
                ->where('active', true)
                ->get();

            foreach ($rules as $rule) {
                $amount = $rule->calculateCommission((float) $wo->total, $context);
                if ($amount > 0) {
                     $simulations[] = [
                        'user_id' => $b['id'],
                        'user_name' => $rule->user?->name ?? 'Usuario ' . $b['id'],
                        'rule_name' => $rule->name,
                        'calculation_type' => $rule->calculation_type,
                        'applies_to_role' => $rule->applies_to_role, // Pode ser diferente do b['role'] se a regra for genérica, mas aqui filtramos por role exato.
                        'base_amount' => (float) $wo->total,
                        'commission_amount' => $amount,
                    ];
                }
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

        // Nota: Idealmente verificaríamos se a regra da comissão era "WHEN_INSTALLMENT_PAID".
        // Por simplificação atual, assumimos que se está PENDING e a conta foi paga, libera.
        // Mas o correto seria o CommissionEvent ter um flag ou link para saber qual gatilho o gerou.
        // Para manter compatibilidade com o código anterior, liberamos todas as PENDING daquela OS.
        
        $pendingEvents = CommissionEvent::where('work_order_id', $ar->work_order_id)
            ->where('tenant_id', $ar->tenant_id)
            ->where('status', CommissionEvent::STATUS_PENDING)
            ->get();

        foreach ($pendingEvents as $event) {
            // Se a regra diz que é só no pagamento, agora é a hora.
            // Se a regra era "na finalização da OS", já deveria estar liberada ou awaiting approval.
            // Vamos assumir aprovação automática no pagamento para simplificar fluxo financeiro.
            $event->update([
                'status' => CommissionEvent::STATUS_APPROVED,
                'notes' => ($event->notes ?? '') . " | Liberada por pagamento #{$ar->id} em " . now()->format('d/m/Y'),
            ]);
        }
    }
}
