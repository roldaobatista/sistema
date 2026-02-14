<?php

namespace App\Services;

use App\Models\InmetroCompetitorSnapshot;
use App\Models\InmetroLeadInteraction;
use App\Models\InmetroOwner;
use App\Models\InmetroInstrument;
use App\Models\InmetroWinLoss;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;

class InmetroReportingService
{
    // ── Feature #23: Executive Dashboard with ROI ──

    public function getExecutiveDashboard(int $tenantId): array
    {
        $totalLeads = InmetroOwner::where('tenant_id', $tenantId)->count();
        $converted = InmetroOwner::where('tenant_id', $tenantId)->whereNotNull('converted_to_customer_id')->count();

        // Revenue from INMETRO-sourced customers
        $customerIds = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->pluck('converted_to_customer_id');

        $revenueFromInmetro = DB::table('work_orders')
            ->whereIn('customer_id', $customerIds)
            ->where('tenant_id', $tenantId)
            ->sum('total_amount');

        $conversionRate = $totalLeads > 0 ? round(($converted / $totalLeads) * 100, 1) : 0;

        $totalContacts = InmetroLeadInteraction::where('tenant_id', $tenantId)->count();
        $costPerConversion = $converted > 0 ? round($totalContacts * 5 / $converted, 2) : 0; // estimated cost per contact

        $monthlyConversions = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->where('updated_at', '>=', now()->subMonths(12))
            ->selectRaw("strftime('%Y-%m', updated_at) as month, COUNT(*) as cnt")
            ->groupByRaw("strftime('%Y-%m', updated_at)")
            ->orderBy('month')
            ->pluck('cnt', 'month');

        return [
            'kpis' => [
                'total_leads' => $totalLeads,
                'converted' => $converted,
                'conversion_rate' => $conversionRate,
                'active_leads' => InmetroOwner::where('tenant_id', $tenantId)->whereNull('converted_to_customer_id')->count(),
                'hot_leads' => InmetroOwner::where('tenant_id', $tenantId)->where('lead_score', '>=', 70)->count(),
                'total_contacts' => $totalContacts,
            ],
            'roi' => [
                'revenue_from_inmetro' => round($revenueFromInmetro, 2),
                'cost_per_conversion' => $costPerConversion,
                'roi_estimate' => $costPerConversion > 0 ? round(($revenueFromInmetro / max(1, $converted * $costPerConversion)) * 100, 1) : 0,
            ],
            'monthly_conversions' => $monthlyConversions,
        ];
    }

    // ── Feature #24: Revenue Forecast ──

    public function getRevenueForecast(int $tenantId, int $months = 6): array
    {
        $historicalRate = $this->getHistoricalConversionRate($tenantId);
        $avgTicket = $this->getAverageTicket($tenantId);

        $forecast = [];
        for ($i = 1; $i <= $months; $i++) {
            $monthStart = now()->addMonths($i)->startOfMonth();
            $monthEnd = now()->addMonths($i)->endOfMonth();

            $expiringInstruments = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId)->whereNull('converted_to_customer_id'))
                ->whereNotNull('next_verification_at')
                ->whereBetween('next_verification_at', [$monthStart, $monthEnd])
                ->count();

            $expectedConversions = round($expiringInstruments * $historicalRate, 1);
            $expectedRevenue = round($expectedConversions * $avgTicket, 2);

            $forecast[] = [
                'month' => $monthStart->format('Y-m'),
                'month_label' => $monthStart->translatedFormat('M/Y'),
                'expiring_instruments' => $expiringInstruments,
                'expected_conversions' => $expectedConversions,
                'expected_revenue' => $expectedRevenue,
                'confidence' => match (true) {
                    $i <= 2 => 'high',
                    $i <= 4 => 'medium',
                    default => 'low',
                },
            ];
        }

        return [
            'historical_conversion_rate' => round($historicalRate * 100, 1),
            'avg_ticket' => round($avgTicket, 2),
            'total_expected_revenue' => round(collect($forecast)->sum('expected_revenue'), 2),
            'months' => collect($forecast)->pluck('month_label')->toArray(),
            'forecast' => $forecast,
        ];
    }

    // ── Feature #25: Conversion Funnel ──

    public function getConversionFunnel(int $tenantId): array
    {
        $total = InmetroOwner::where('tenant_id', $tenantId)->count();

        $stages = [
            'imported' => InmetroOwner::where('tenant_id', $tenantId)->count(),
            'new_lead' => InmetroOwner::where('tenant_id', $tenantId)->where('lead_status', 'new')->count(),
            'contacted' => InmetroOwner::where('tenant_id', $tenantId)->where('lead_status', 'contacted')->count(),
            'negotiating' => InmetroOwner::where('tenant_id', $tenantId)->where('lead_status', 'negotiating')->count(),
            'converted' => InmetroOwner::where('tenant_id', $tenantId)->where('lead_status', 'converted')->count(),
            'lost' => InmetroOwner::where('tenant_id', $tenantId)->where('lead_status', 'lost')->count(),
        ];

        // With work orders
        $customerIds = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->pluck('converted_to_customer_id');

        $withOS = DB::table('work_orders')
            ->whereIn('customer_id', $customerIds)
            ->where('tenant_id', $tenantId)
            ->distinct('customer_id')
            ->count('customer_id');

        $stages['with_work_order'] = $withOS;

        // Conversion rates between stages
        $rates = [];
        $keys = array_keys($stages);
        for ($i = 1; $i < count($keys); $i++) {
            $prevKey = $keys[$i - 1];
            $currKey = $keys[$i];
            $prevVal = $stages[$prevKey] ?: 1;
            $rates["{$prevKey}_to_{$currKey}"] = round(($stages[$currKey] / $prevVal) * 100, 1);
        }

        return [
            'stages' => $stages,
            'conversion_rates' => $rates,
            'overall_rate' => $total > 0 ? round(($stages['converted'] / $total) * 100, 1) : 0,
        ];
    }

    // ── Feature #27: Multi-Sheet Excel Export ──

    public function getExportData(int $tenantId): array
    {
        return [
            'summary' => $this->getExecutiveDashboard($tenantId),
            'leads' => InmetroOwner::where('tenant_id', $tenantId)
                ->whereNull('converted_to_customer_id')
                ->withCount('instruments')
                ->orderByDesc('lead_score')
                ->limit(500)
                ->get()
                ->toArray(),
            'instruments' => InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
                ->with('location:id,address_city,address_state')
                ->limit(2000)
                ->get()
                ->toArray(),
            'funnel' => $this->getConversionFunnel($tenantId),
        ];
    }

    // ── Feature #28: Year over Year Comparison ──

    public function getYearOverYear(int $tenantId): array
    {
        $currentYear = now()->year;
        $previousYear = $currentYear - 1;

        $metrics = [];
        foreach ([$previousYear, $currentYear] as $year) {
            $yearStart = "{$year}-01-01";
            $yearEnd = "{$year}-12-31";

            $newLeads = InmetroOwner::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$yearStart, $yearEnd])
                ->count();

            $conversions = InmetroOwner::where('tenant_id', $tenantId)
                ->where('lead_status', 'converted')
                ->whereBetween('updated_at', [$yearStart, $yearEnd])
                ->count();

            $contacts = InmetroLeadInteraction::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$yearStart, $yearEnd])
                ->count();

            $metrics[$year] = [
                'year' => $year,
                'new_leads' => $newLeads,
                'conversions' => $conversions,
                'contacts' => $contacts,
                'conversion_rate' => $newLeads > 0 ? round(($conversions / $newLeads) * 100, 1) : 0,
            ];
        }

        $deltas = [
            'leads_delta' => ($metrics[$previousYear]['new_leads'] ?? 0) > 0
                ? round((($metrics[$currentYear]['new_leads'] - $metrics[$previousYear]['new_leads']) / $metrics[$previousYear]['new_leads']) * 100, 1)
                : 0,
            'conversion_delta' => ($metrics[$previousYear]['conversions'] ?? 0) > 0
                ? round((($metrics[$currentYear]['conversions'] - $metrics[$previousYear]['conversions']) / $metrics[$previousYear]['conversions']) * 100, 1)
                : 0,
        ];

        return [
            'current_year' => $currentYear,
            'previous_year' => $previousYear,
            'metrics' => $metrics,
            'deltas' => $deltas,
            'trend' => $deltas['conversion_delta'] > 0 ? 'growing' : ($deltas['conversion_delta'] < 0 ? 'declining' : 'stable'),
        ];
    }

    // ── Helpers ──

    private function getHistoricalConversionRate(int $tenantId): float
    {
        $total = InmetroOwner::where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subYear())
            ->count();
        $converted = InmetroOwner::where('tenant_id', $tenantId)
            ->where('lead_status', 'converted')
            ->where('updated_at', '>=', now()->subYear())
            ->count();

        return $total > 0 ? $converted / $total : 0.05;
    }

    private function getAverageTicket(int $tenantId): float
    {
        $customerIds = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->pluck('converted_to_customer_id');

        $avg = DB::table('work_orders')
            ->whereIn('customer_id', $customerIds)
            ->where('tenant_id', $tenantId)
            ->avg('total_amount');

        return $avg ?: 2500; // Default fallback
    }
}
