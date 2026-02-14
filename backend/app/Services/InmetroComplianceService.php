<?php

namespace App\Services;

use App\Models\InmetroComplianceChecklist;
use App\Models\InmetroInstrument;
use App\Models\InmetroOwner;
use Illuminate\Support\Facades\DB;

class InmetroComplianceService
{
    // ── Feature #35: Compliance Checklist by Instrument Type ──

    public function getChecklists(int $tenantId, ?string $instrumentType = null): array
    {
        $query = InmetroComplianceChecklist::where('tenant_id', $tenantId)->active();
        if ($instrumentType) {
            $query->forType($instrumentType);
        }
        return $query->get()->toArray();
    }

    public function createChecklist(array $data, int $tenantId): InmetroComplianceChecklist
    {
        return InmetroComplianceChecklist::create([
            'tenant_id' => $tenantId,
            'instrument_type' => $data['instrument_type'],
            'regulation_reference' => $data['regulation_reference'] ?? null,
            'title' => $data['title'],
            'items' => $data['items'],
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function updateChecklist(int $id, array $data, int $tenantId): InmetroComplianceChecklist
    {
        $checklist = InmetroComplianceChecklist::where('tenant_id', $tenantId)->findOrFail($id);
        $checklist->update($data);
        return $checklist->fresh();
    }

    // ── Feature #36: Regulatory Traceability ──

    public function getRegulatoryTraceability(int $instrumentId, int $tenantId): array
    {
        $instrument = InmetroInstrument::with(['history', 'location.owner'])
            ->whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->findOrFail($instrumentId);

        // Find applicable checklist
        $checklist = InmetroComplianceChecklist::where('tenant_id', $tenantId)
            ->forType($instrument->instrument_type ?? 'general')
            ->active()
            ->first();

        return [
            'instrument' => [
                'id' => $instrument->id,
                'inmetro_number' => $instrument->inmetro_number,
                'type' => $instrument->instrument_type,
                'brand' => $instrument->brand,
                'model' => $instrument->model,
            ],
            'owner' => $instrument->location->owner?->name,
            'applicable_regulation' => $checklist?->regulation_reference ?? 'N/A',
            'checklist' => $checklist?->items ?? [],
            'verification_history' => $instrument->history->map(fn($h) => [
                'date' => $h->event_date?->toDateString(),
                'type' => $h->event_type,
                'status' => $h->status,
                'executor' => $h->executor,
                'seal' => $h->seal_number ?? null,
            ]),
            'traceability_chain' => [
                'regulation' => $checklist?->regulation_reference ?? 'Portaria INMETRO aplicável',
                'procedure' => 'Procedimento de calibração ISO 17025',
                'standards' => 'Padrões rastreáveis (ver certificado)',
                'certificate' => "A emitir — Instrumento #{$instrument->inmetro_number}",
            ],
        ];
    }

    // ── Feature #38: Regulatory Impact Simulator ──

    public function simulateRegulatoryImpact(int $tenantId, array $params): array
    {
        $currentPeriodMonths = $params['current_period_months'] ?? 12;
        $newPeriodMonths = $params['new_period_months'] ?? 6;
        $affectedTypes = $params['affected_types'] ?? [];

        $query = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId));

        if (!empty($affectedTypes)) {
            $query->whereIn('instrument_type', $affectedTypes);
        }

        $totalInstruments = $query->count();
        $avgRevenuePerCalibration = 2500; // configurable

        $currentCalibrationsPerYear = $totalInstruments * (12 / $currentPeriodMonths);
        $newCalibrationsPerYear = $totalInstruments * (12 / $newPeriodMonths);
        $deltaCal = $newCalibrationsPerYear - $currentCalibrationsPerYear;

        $revenueImpact = $deltaCal * $avgRevenuePerCalibration;

        // Affected owners
        $affectedOwners = InmetroOwner::where('tenant_id', $tenantId)
            ->whereHas('locations.instruments', function ($q) use ($affectedTypes) {
                if (!empty($affectedTypes)) $q->whereIn('instrument_type', $affectedTypes);
            })
            ->count();

        return [
            'scenario' => [
                'current_period' => "{$currentPeriodMonths} months",
                'new_period' => "{$newPeriodMonths} months",
                'affected_types' => $affectedTypes ?: ['all'],
            ],
            'impact' => [
                'total_instruments' => $totalInstruments,
                'affected_owners' => $affectedOwners,
                'current_calibrations_year' => round($currentCalibrationsPerYear),
                'new_calibrations_year' => round($newCalibrationsPerYear),
                'delta_calibrations' => round($deltaCal),
                'revenue_impact' => round($revenueImpact, 2),
                'direction' => $revenueImpact > 0 ? 'positive' : ($revenueImpact < 0 ? 'negative' : 'neutral'),
            ],
            'recommendation' => $revenueImpact > 0
                ? 'Mudança regulatória favorável — preparar capacidade para mais calibrações'
                : 'Mudança regulatória desfavorável — avaliar impacto financeiro e ajustar estratégia',
        ];
    }

    // ── Feature #30: Corporate Group Detection ──

    public function detectCorporateGroups(int $tenantId): array
    {
        $groups = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('cnpj_root')
            ->where('cnpj_root', '!=', '')
            ->selectRaw('cnpj_root, COUNT(*) as branch_count, SUM(estimated_revenue) as total_revenue, GROUP_CONCAT(name) as names')
            ->groupBy('cnpj_root')
            ->having('branch_count', '>', 1)
            ->orderByDesc('total_revenue')
            ->get();

        return [
            'total_groups' => $groups->count(),
            'groups' => $groups->map(fn($g) => [
                'cnpj_root' => $g->cnpj_root,
                'branches' => $g->branch_count,
                'names' => explode(',', $g->names),
                'total_revenue' => round($g->total_revenue, 2),
                'approach' => 'Abordar como conta corporativa — propor contrato guarda-chuva',
            ]),
        ];
    }

    // ── Feature #33: Segment Classification (also in ProspectionService) ──

    public function getInstrumentTypes(int $tenantId): array
    {
        return InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->selectRaw('instrument_type, COUNT(*) as cnt')
            ->groupBy('instrument_type')
            ->orderByDesc('cnt')
            ->get()
            ->toArray();
    }

    // ── Feature #44: Data Anomaly Detection ──

    public function detectAnomalies(int $tenantId): array
    {
        $anomalies = [];

        // Owners with suspiciously many instruments
        $avgInstruments = InmetroOwner::where('tenant_id', $tenantId)->avg('total_instruments') ?: 3;
        $threshold = $avgInstruments * 5;

        $tooMany = InmetroOwner::where('tenant_id', $tenantId)
            ->where('total_instruments', '>', $threshold)
            ->get();

        foreach ($tooMany as $owner) {
            $anomalies[] = [
                'type' => 'excessive_instruments',
                'severity' => 'medium',
                'entity' => 'owner',
                'entity_id' => $owner->id,
                'name' => $owner->name,
                'detail' => "Owner has {$owner->total_instruments} instruments (avg: " . round($avgInstruments) . ")",
            ];
        }

        // Instruments with no location data
        $noLocation = InmetroInstrument::whereHas('location', fn($q) => $q->whereNull('address_city'))
            ->whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->count();

        if ($noLocation > 0) {
            $anomalies[] = [
                'type' => 'missing_location',
                'severity' => 'low',
                'entity' => 'instruments',
                'detail' => "{$noLocation} instruments without city data",
            ];
        }

        // Owners with duplicate documents
        $duplicates = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('document')
            ->selectRaw('document, COUNT(*) as cnt')
            ->groupBy('document')
            ->having('cnt', '>', 1)
            ->get();

        foreach ($duplicates as $dup) {
            $anomalies[] = [
                'type' => 'duplicate_document',
                'severity' => 'high',
                'entity' => 'owner',
                'detail' => "Document {$dup->document} appears {$dup->cnt} times",
            ];
        }

        return [
            'total_anomalies' => count($anomalies),
            'by_severity' => [
                'high' => collect($anomalies)->where('severity', 'high')->count(),
                'medium' => collect($anomalies)->where('severity', 'medium')->count(),
                'low' => collect($anomalies)->where('severity', 'low')->count(),
            ],
            'anomalies' => $anomalies,
        ];
    }

    // ── Feature #46: Renewal Probability ──

    public function getRenewalProbability(int $tenantId): array
    {
        $customers = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->with('convertedCustomer')
            ->get();

        $predictions = $customers->map(function ($owner) {
            $customer = $owner->convertedCustomer;
            if (!$customer) return null;

            $factors = [];
            $score = 50; // Base

            // Factor: number of past work orders
            $woCount = DB::table('work_orders')->where('customer_id', $customer->id)->count();
            if ($woCount >= 3) { $score += 20; $factors[] = 'Multiple past OS (+20)'; }
            elseif ($woCount >= 1) { $score += 10; $factors[] = 'Has past OS (+10)'; }
            else { $score -= 10; $factors[] = 'No past OS (-10)'; }

            // Factor: instruments expiring soon
            $expiring = InmetroInstrument::whereHas('location', fn($q) => $q->where('inmetro_owner_id', $owner->id))
                ->whereNotNull('next_verification_at')
                ->where('next_verification_at', '<=', now()->addDays(90))->count();
            if ($expiring > 0) { $score += 15; $factors[] = "Instruments expiring soon (+15)"; }

            // Factor: recent contact
            if ($owner->last_contacted_at && $owner->last_contacted_at->diffInDays(now()) < 30) {
                $score += 10;
                $factors[] = 'Recent contact (+10)';
            }

            // Factor: no rejected instruments
            $rejected = InmetroInstrument::whereHas('location', fn($q) => $q->where('inmetro_owner_id', $owner->id))
                ->where('current_status', 'rejected')->count();
            if ($rejected > 0) { $score -= 10; $factors[] = 'Has rejected instruments (-10)'; }

            return [
                'owner_id' => $owner->id,
                'customer_id' => $customer->id,
                'customer_name' => $customer->trade_name ?? $owner->name,
                'probability' => min(100, max(0, $score)),
                'risk_level' => match (true) {
                    $score >= 70 => 'low_risk',
                    $score >= 40 => 'medium_risk',
                    default => 'high_risk',
                },
                'factors' => $factors,
                'instruments' => $owner->total_instruments,
                'expiring_soon' => $expiring ?? 0,
            ];
        })->filter()->sortBy('probability')->values();

        return [
            'total_customers' => $predictions->count(),
            'high_risk' => $predictions->where('risk_level', 'high_risk')->count(),
            'medium_risk' => $predictions->where('risk_level', 'medium_risk')->count(),
            'low_risk' => $predictions->where('risk_level', 'low_risk')->count(),
            'predictions' => $predictions,
        ];
    }
}
