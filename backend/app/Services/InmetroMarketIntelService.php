<?php

namespace App\Services;

use App\Models\InmetroCompetitor;
use App\Models\InmetroInstrument;
use App\Models\InmetroLocation;
use App\Models\InmetroOwner;
use Illuminate\Support\Facades\DB;

class InmetroMarketIntelService
{
    /**
     * Market overview: total market size, segments, growth opportunities.
     */
    public function getMarketOverview(int $tenantId): array
    {
        $totalOwners = InmetroOwner::where('tenant_id', $tenantId)->count();
        $totalInstruments = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))->count();
        $totalCompetitors = InmetroCompetitor::where('tenant_id', $tenantId)->count();

        $leads = InmetroOwner::where('tenant_id', $tenantId)->whereNull('converted_to_customer_id')->count();
        $customers = InmetroOwner::where('tenant_id', $tenantId)->whereNotNull('converted_to_customer_id')->count();
        $conversionRate = $totalOwners > 0 ? round(($customers / $totalOwners) * 100, 1) : 0;

        $overdue = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('next_verification_at')
            ->where('next_verification_at', '<', now())
            ->count();

        $expiring30 = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('next_verification_at')
            ->where('next_verification_at', '>', now())
            ->where('next_verification_at', '<=', now()->addDays(30))
            ->count();

        $expiring90 = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('next_verification_at')
            ->where('next_verification_at', '>', now())
            ->where('next_verification_at', '<=', now()->addDays(90))
            ->count();

        // Market opportunity = overdue + expiring soon (potential revenue)
        $marketOpportunity = $overdue + $expiring90;

        return [
            'total_owners' => $totalOwners,
            'total_instruments' => $totalInstruments,
            'total_competitors' => $totalCompetitors,
            'leads' => $leads,
            'customers' => $customers,
            'conversion_rate' => $conversionRate,
            'overdue' => $overdue,
            'expiring_30d' => $expiring30,
            'expiring_90d' => $expiring90,
            'market_opportunity' => $marketOpportunity,
        ];
    }

    /**
     * Competitor analysis: market share by city, competitor density, service overlap.
     */
    public function getCompetitorAnalysis(int $tenantId): array
    {
        // Competitors by city
        $competitorsByCity = InmetroCompetitor::where('tenant_id', $tenantId)
            ->select('city', DB::raw('COUNT(*) as total'))
            ->groupBy('city')
            ->orderByDesc('total')
            ->limit(20)
            ->get()
            ->map(fn($row) => ['city' => $row->city ?? 'Sem cidade', 'total' => $row->total])
            ->toArray();

        // Competitors by state
        $competitorsByState = InmetroCompetitor::where('tenant_id', $tenantId)
            ->select('state', DB::raw('COUNT(*) as total'))
            ->groupBy('state')
            ->orderByDesc('total')
            ->get()
            ->map(fn($row) => ['state' => $row->state ?? '??', 'total' => $row->total])
            ->toArray();

        // Instruments per competitor city vs our presence
        $competitorCities = InmetroCompetitor::where('tenant_id', $tenantId)
            ->pluck('city')
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        $ourPresenceInCompetitorCities = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->whereHas('locations', fn($q) => $q->whereIn('address_city', $competitorCities))
            ->count();

        // Species distribution among competitors
        $speciesDistribution = [];
        $competitors = InmetroCompetitor::where('tenant_id', $tenantId)->whereNotNull('authorized_species')->get();
        foreach ($competitors as $comp) {
            $species = $comp->authorized_species;
            if (is_array($species)) {
                foreach ($species as $s) {
                    $key = trim($s);
                    if (!empty($key)) {
                        $speciesDistribution[$key] = ($speciesDistribution[$key] ?? 0) + 1;
                    }
                }
            }
        }
        arsort($speciesDistribution);
        $speciesDistribution = array_slice($speciesDistribution, 0, 15, true);

        return [
            'by_city' => $competitorsByCity,
            'by_state' => $competitorsByState,
            'total_competitor_cities' => count($competitorCities),
            'our_presence_in_competitor_cities' => $ourPresenceInCompetitorCities,
            'species_distribution' => $speciesDistribution,
        ];
    }

    /**
     * Regional market analysis: instrument density and opportunity by city/state.
     */
    public function getRegionalAnalysis(int $tenantId): array
    {
        // Instruments by city with overdue counts
        $byCity = DB::table('inmetro_instruments')
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->select(
                'inmetro_locations.address_city as city',
                'inmetro_locations.address_state as state',
                DB::raw('COUNT(inmetro_instruments.id) as instrument_count'),
                DB::raw('COUNT(DISTINCT inmetro_locations.owner_id) as owner_count'),
                DB::raw("SUM(CASE WHEN inmetro_instruments.next_verification_at < NOW() THEN 1 ELSE 0 END) as overdue_count")
            )
            ->groupBy('inmetro_locations.address_city', 'inmetro_locations.address_state')
            ->orderByDesc('instrument_count')
            ->limit(30)
            ->get()
            ->map(fn($row) => [
                'city' => $row->city ?? 'Sem cidade',
                'state' => $row->state ?? '??',
                'instrument_count' => $row->instrument_count,
                'owner_count' => $row->owner_count,
                'overdue_count' => $row->overdue_count,
            ])
            ->toArray();

        // By state summary
        $byState = DB::table('inmetro_instruments')
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->select(
                'inmetro_locations.address_state as state',
                DB::raw('COUNT(inmetro_instruments.id) as instrument_count'),
                DB::raw('COUNT(DISTINCT inmetro_locations.owner_id) as owner_count'),
                DB::raw("SUM(CASE WHEN inmetro_instruments.next_verification_at < NOW() THEN 1 ELSE 0 END) as overdue_count")
            )
            ->groupBy('inmetro_locations.address_state')
            ->orderByDesc('instrument_count')
            ->get()
            ->map(fn($row) => [
                'state' => $row->state ?? '??',
                'instrument_count' => $row->instrument_count,
                'owner_count' => $row->owner_count,
                'overdue_count' => $row->overdue_count,
            ])
            ->toArray();

        return [
            'by_city' => $byCity,
            'by_state' => $byState,
        ];
    }

    /**
     * Brand and instrument type analysis.
     */
    public function getBrandAnalysis(int $tenantId): array
    {
        // Top brands
        $byBrand = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->select('brand', DB::raw('COUNT(*) as total'))
            ->whereNotNull('brand')
            ->where('brand', '!=', '')
            ->groupBy('brand')
            ->orderByDesc('total')
            ->limit(20)
            ->get()
            ->map(fn($row) => ['brand' => $row->brand, 'total' => $row->total])
            ->toArray();

        // By instrument type
        $byType = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->select('instrument_type', DB::raw('COUNT(*) as total'))
            ->whereNotNull('instrument_type')
            ->where('instrument_type', '!=', '')
            ->groupBy('instrument_type')
            ->orderByDesc('total')
            ->get()
            ->map(fn($row) => ['type' => $row->instrument_type, 'total' => $row->total])
            ->toArray();

        // By status
        $byStatus = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->select('current_status', DB::raw('COUNT(*) as total'))
            ->groupBy('current_status')
            ->orderByDesc('total')
            ->get()
            ->map(fn($row) => ['status' => $row->current_status ?? 'unknown', 'total' => $row->total])
            ->toArray();

        // Brand × status cross
        $brandStatus = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->select('brand', 'current_status', DB::raw('COUNT(*) as total'))
            ->whereNotNull('brand')
            ->where('brand', '!=', '')
            ->groupBy('brand', 'current_status')
            ->orderByDesc('total')
            ->limit(50)
            ->get()
            ->groupBy('brand')
            ->map(fn($group) => $group->pluck('total', 'current_status')->toArray())
            ->toArray();

        return [
            'by_brand' => $byBrand,
            'by_type' => $byType,
            'by_status' => $byStatus,
            'brand_status' => $brandStatus,
        ];
    }

    /**
     * Expiration forecast: instruments expiring in upcoming months.
     */
    public function getExpirationForecast(int $tenantId): array
    {
        $months = [];
        for ($i = 0; $i < 12; $i++) {
            $start = now()->addMonths($i)->startOfMonth();
            $end = now()->addMonths($i)->endOfMonth();

            $count = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
                ->whereNotNull('next_verification_at')
                ->whereBetween('next_verification_at', [$start, $end])
                ->count();

            $months[] = [
                'month' => $start->format('Y-m'),
                'label' => $start->translatedFormat('M/y'),
                'count' => $count,
            ];
        }

        // Already overdue
        $overdue = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('next_verification_at')
            ->where('next_verification_at', '<', now())
            ->count();

        return [
            'months' => $months,
            'overdue' => $overdue,
            'total_upcoming_12m' => array_sum(array_column($months, 'count')),
        ];
    }

    /**
     * Monthly trends: 12-month tracking of new instruments, verifications, rejections.
     */
    public function getMonthlyTrends(int $tenantId): array
    {
        $months = [];
        for ($i = 11; $i >= 0; $i--) {
            $start = now()->subMonths($i)->startOfMonth();
            $end = now()->subMonths($i)->endOfMonth();
            $monthKey = $start->format('Y-m');
            $monthLabel = $start->translatedFormat('M/y');

            // New instruments discovered
            $newInstruments = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('created_at', [$start, $end])
                ->count();

            // Verifications performed
            $verifications = DB::table('inmetro_history')
                ->join('inmetro_instruments', 'inmetro_history.instrument_id', '=', 'inmetro_instruments.id')
                ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
                ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
                ->where('inmetro_owners.tenant_id', $tenantId)
                ->where('inmetro_history.event_type', 'verification')
                ->whereBetween('inmetro_history.event_date', [$start, $end])
                ->count();

            // Rejections
            $rejections = DB::table('inmetro_history')
                ->join('inmetro_instruments', 'inmetro_history.instrument_id', '=', 'inmetro_instruments.id')
                ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
                ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
                ->where('inmetro_owners.tenant_id', $tenantId)
                ->where('inmetro_history.result', 'rejected')
                ->whereBetween('inmetro_history.event_date', [$start, $end])
                ->count();

            // Conversions (leads turned to customers)
            $conversions = InmetroOwner::where('tenant_id', $tenantId)
                ->whereNotNull('converted_to_customer_id')
                ->whereBetween('updated_at', [$start, $end])
                ->count();

            $months[] = [
                'month' => $monthKey,
                'label' => $monthLabel,
                'new_instruments' => $newInstruments,
                'verifications' => $verifications,
                'rejections' => $rejections,
                'conversions' => $conversions,
            ];
        }

        return ['months' => $months];
    }

    /**
     * Revenue ranking: top 20 owners by estimated revenue potential.
     */
    public function getRevenueRanking(int $tenantId): array
    {
        $ranking = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->whereNotNull('estimated_revenue')
            ->where('estimated_revenue', '>', 0)
            ->orderByDesc('estimated_revenue')
            ->limit(20)
            ->get()
            ->map(function ($owner) {
                $expiringCount = $owner->instruments()
                    ->whereNotNull('next_verification_at')
                    ->where('next_verification_at', '<=', now()->addDays(90))
                    ->count();

                $rejectedCount = $owner->instruments()
                    ->where('current_status', 'rejected')
                    ->count();

                return [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'document' => $owner->document,
                    'priority' => $owner->priority,
                    'estimated_revenue' => (float) $owner->estimated_revenue,
                    'total_instruments' => $owner->total_instruments,
                    'expiring_count' => $expiringCount,
                    'rejected_count' => $rejectedCount,
                    'has_phone' => !empty($owner->phone),
                    'lead_status' => $owner->lead_status,
                ];
            })
            ->toArray();

        $totalPotentialRevenue = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->sum('estimated_revenue');

        return [
            'ranking' => $ranking,
            'total_potential_revenue' => (float) $totalPotentialRevenue,
        ];
    }
}
