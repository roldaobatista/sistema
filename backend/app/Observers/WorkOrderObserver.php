<?php

namespace App\Observers;

use App\Models\WorkOrder;
use App\Models\SlaPolicy;
use Illuminate\Support\Carbon;

class WorkOrderObserver
{
    public function creating(WorkOrder $workOrder): void
    {
        if ($workOrder->sla_policy_id) {
            $this->applySlaPolicy($workOrder);
        }
    }

    public function updating(WorkOrder $workOrder): void
    {
        // Se a política mudou, recalcula
        if ($workOrder->isDirty('sla_policy_id') && $workOrder->sla_policy_id) {
            $this->applySlaPolicy($workOrder);
        }

        // Marcar primeira resposta se status mudar de Aberta para Em Andamento
        if ($workOrder->isDirty('status') && 
            $workOrder->status !== WorkOrder::STATUS_OPEN && 
            !$workOrder->sla_responded_at) {
            $workOrder->sla_responded_at = now();
        }
    }

    protected function applySlaPolicy(WorkOrder $workOrder): void
    {
        $policy = SlaPolicy::where('id', $workOrder->sla_policy_id)
            ->where('tenant_id', $workOrder->tenant_id)
            ->first();
        if ($policy) {
            // Calcula Due Date baseado na prioridade ou tempo geral da política
            // Simplificação: usa resolution_time_minutes da política
            // Em V2 poderia ter tempos diferentes por prioridade na tabela de items da política
            $minutes = $policy->resolution_time_minutes;
            
            // Ajuste por prioridade (hardcoded logic for V1 - Pending migration to SlaPolicy rules)
            if ($workOrder->priority === WorkOrder::PRIORITY_URGENT) {
                $minutes = (int) ($minutes * 0.5); // 50% do tempo
            } elseif ($workOrder->priority === WorkOrder::PRIORITY_HIGH) {
                $minutes = (int) ($minutes * 0.8); // 80% do tempo
            }

            // Ignora fins de semana/feriados na V1 (Business Hours seria V2)
            $workOrder->sla_due_at = Carbon::now()->addMinutes($minutes);
        }
    }
}
