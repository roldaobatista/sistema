<?php

namespace App\Services;

use App\Models\AutoAssignmentRule;
use App\Models\WorkOrder;
use App\Models\ServiceCall;
use App\Models\User;
use App\Models\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class AutoAssignmentService
{
    /**
     * Auto-assign a work order based on configured rules.
     * Returns the assigned user or null if no match.
     */
    public function assignWorkOrder(WorkOrder $wo): ?User
    {
        $rules = AutoAssignmentRule::where('company_id', $wo->company_id)
            ->where('is_active', true)
            ->where('entity_type', 'work_order')
            ->orderBy('priority')
            ->get();

        foreach ($rules as $rule) {
            if (!$this->matchesConditions($wo, $rule)) continue;

            $technician = $this->findBestTechnician($wo, $rule);
            if ($technician) {
                $wo->update([
                    'assigned_to' => $technician->id,
                    'auto_assigned' => true,
                    'auto_assignment_rule_id' => $rule->id,
                ]);

                Log::info("Auto-assigned WO #{$wo->id} to {$technician->name} via rule #{$rule->id}");
                return $technician;
            }
        }

        return null;
    }

    /**
     * Auto-assign a service call.
     */
    public function assignServiceCall(ServiceCall $call): ?User
    {
        $rules = AutoAssignmentRule::where('company_id', $call->company_id)
            ->where('is_active', true)
            ->where('entity_type', 'service_call')
            ->orderBy('priority')
            ->get();

        foreach ($rules as $rule) {
            $technician = $this->findBestTechnicianForCall($call, $rule);
            if ($technician) {
                $call->update([
                    'assigned_to' => $technician->id,
                    'auto_assigned' => true,
                ]);
                return $technician;
            }
        }

        return null;
    }

    /**
     * Check if a work order matches rule conditions.
     */
    private function matchesConditions(WorkOrder $wo, AutoAssignmentRule $rule): bool
    {
        $conditions = $rule->conditions ?? [];

        if (isset($conditions['os_types']) && !in_array($wo->tipo, $conditions['os_types'])) {
            return false;
        }

        if (isset($conditions['priorities']) && !in_array($wo->prioridade, $conditions['priorities'])) {
            return false;
        }

        if (isset($conditions['customer_ids']) && !in_array($wo->customer_id, $conditions['customer_ids'])) {
            return false;
        }

        if (isset($conditions['regions']) && !in_array($wo->regiao, $conditions['regions'])) {
            return false;
        }

        return true;
    }

    /**
     * Find the best technician based on the rule's strategy.
     */
    private function findBestTechnician(WorkOrder $wo, AutoAssignmentRule $rule): ?User
    {
        $strategy = $rule->strategy ?? 'round_robin';

        $candidates = $this->getCandidates($wo->company_id, $rule);
        if ($candidates->isEmpty()) return null;

        return match ($strategy) {
            'round_robin' => $this->roundRobin($candidates, $wo->company_id),
            'least_loaded' => $this->leastLoaded($candidates, $wo->company_id),
            'skill_match' => $this->skillMatch($candidates, $wo),
            'proximity' => $this->proximity($candidates, $wo),
            default => $candidates->first(),
        };
    }

    /**
     * Find best technician for a service call.
     */
    private function findBestTechnicianForCall(ServiceCall $call, AutoAssignmentRule $rule): ?User
    {
        $candidates = $this->getCandidates($call->company_id, $rule);
        if ($candidates->isEmpty()) return null;

        $strategy = $rule->strategy ?? 'round_robin';
        return match ($strategy) {
            'round_robin' => $this->roundRobin($candidates, $call->company_id),
            'least_loaded' => $this->leastLoaded($candidates, $call->company_id),
            default => $candidates->first(),
        };
    }

    /**
     * Get eligible technician candidates from rule config.
     */
    private function getCandidates(int $tenantId, AutoAssignmentRule $rule)
    {
        $query = User::where('company_id', $tenantId)
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['tecnico', 'technician']));

        // Filter by specific techs if configured
        if (!empty($rule->technician_ids)) {
            $query->whereIn('id', $rule->technician_ids);
        }

        // Filter by skills if configured
        if (!empty($rule->required_skills)) {
            // Assumes users have a 'skills' JSON column or relation
            foreach ($rule->required_skills as $skill) {
                $query->where('skills', 'like', "%{$skill}%");
            }
        }

        // Exclude techs on leave/vacation
        $query->where(function ($q) {
            $q->whereNull('unavailable_until')
              ->orWhere('unavailable_until', '<', Carbon::now());
        });

        return $query->get();
    }

    /**
     * Round-robin strategy: assign to technician with oldest last assignment.
     */
    private function roundRobin($candidates, int $tenantId): ?User
    {
        return $candidates->sortBy(function ($tech) use ($tenantId) {
            return WorkOrder::where('company_id', $tenantId)
                ->where('assigned_to', $tech->id)
                ->where('auto_assigned', true)
                ->max('created_at') ?? '2000-01-01';
        })->first();
    }

    /**
     * Least-loaded strategy: assign to technician with fewest open WOs.
     */
    private function leastLoaded($candidates, int $tenantId): ?User
    {
        return $candidates->sortBy(function ($tech) use ($tenantId) {
            return WorkOrder::where('company_id', $tenantId)
                ->where('assigned_to', $tech->id)
                ->whereNotIn('status', ['concluida', 'cancelada', 'faturada'])
                ->count();
        })->first();
    }

    /**
     * Skill-match strategy: best matching skills for the OS type.
     */
    private function skillMatch($candidates, WorkOrder $wo): ?User
    {
        $requiredSkills = $wo->requiredSkills ?? [];
        if (empty($requiredSkills)) return $candidates->first();

        return $candidates->sortByDesc(function ($tech) use ($requiredSkills) {
            $techSkills = is_array($tech->skills) ? $tech->skills : json_decode($tech->skills ?? '[]', true);
            return count(array_intersect($techSkills, $requiredSkills));
        })->first();
    }

    /**
     * Proximity strategy: closest technician by last known location.
     */
    private function proximity($candidates, WorkOrder $wo): ?User
    {
        if (!$wo->latitude || !$wo->longitude) return $candidates->first();

        return $candidates->filter(fn ($t) => $t->last_latitude && $t->last_longitude)
            ->sortBy(function ($tech) use ($wo) {
                return $this->haversineDistance(
                    $wo->latitude, $wo->longitude,
                    $tech->last_latitude, $tech->last_longitude
                );
            })->first() ?? $candidates->first();
    }

    /**
     * Haversine distance formula (km).
     */
    private function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
