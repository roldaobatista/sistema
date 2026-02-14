<?php

namespace App\Services;

use App\Models\InmetroInstrument;
use App\Models\InmetroLocation;
use App\Models\InmetroOwner;
use App\Models\InmetroCompetitor;
use Illuminate\Support\Facades\DB;

class InmetroTerritorialService
{
    // ── Feature #7: Multi-Layer Map Data ──

    public function getLayeredMapData(int $tenantId, array $layers = ['instruments', 'competitors', 'leads']): array
    {
        $result = [];

        if (in_array('instruments', $layers)) {
            $result['instruments'] = InmetroLocation::whereHas('owner', fn($q) => $q->where('tenant_id', $tenantId))
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->with(['owner:id,name,type,lead_status,priority', 'instruments:id,location_id,current_status,next_verification_at,brand,capacity'])
                ->get()
                ->map(fn($loc) => [
                    'id' => $loc->id,
                    'lat' => (float)$loc->latitude,
                    'lng' => (float)$loc->longitude,
                    'city' => $loc->address_city,
                    'owner' => $loc->owner?->name,
                    'owner_id' => $loc->owner_id,
                    'status' => $loc->owner?->lead_status,
                    'priority' => $loc->owner?->priority,
                    'instruments' => $loc->instruments->count(),
                    'has_rejected' => $loc->instruments->contains('current_status', 'rejected'),
                    'has_expiring' => $loc->instruments->contains(fn($i) => $i->days_until_due !== null && $i->days_until_due <= 90),
                    'type' => 'instrument',
                ]);
        }

        if (in_array('competitors', $layers)) {
            $result['competitors'] = InmetroCompetitor::where('tenant_id', $tenantId)
                ->get()
                ->map(fn($c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'city' => $c->city,
                    'state' => $c->state,
                    'total_repairs' => $c->total_repairs_done,
                    'type' => 'competitor',
                ]);
        }

        if (in_array('leads', $layers)) {
            $result['hot_leads'] = InmetroOwner::where('tenant_id', $tenantId)
                ->whereNull('converted_to_customer_id')
                ->where('lead_score', '>=', 60)
                ->with('locations')
                ->get()
                ->flatMap(fn($owner) => $owner->locations
                    ->filter(fn($loc) => $loc->latitude && $loc->longitude)
                    ->map(fn($loc) => [
                        'id' => $owner->id,
                        'lat' => (float)$loc->latitude,
                        'lng' => (float)$loc->longitude,
                        'name' => $owner->name,
                        'score' => $owner->lead_score,
                        'city' => $loc->address_city,
                        'type' => 'hot_lead',
                    ])
                );
        }

        return $result;
    }

    // ── Feature #8: Route Planner ──

    public function optimizeRoute(int $tenantId, float $baseLat, float $baseLng, array $ownerIds): array
    {
        $locations = InmetroLocation::whereIn('owner_id', $ownerIds)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->with('owner:id,name,document,priority')
            ->get()
            ->map(fn($loc) => [
                'id' => $loc->id,
                'owner_id' => $loc->owner_id,
                'name' => $loc->owner?->name,
                'lat' => (float)$loc->latitude,
                'lng' => (float)$loc->longitude,
                'city' => $loc->address_city,
                'distance_km' => $this->haversineDistance($baseLat, $baseLng, (float)$loc->latitude, (float)$loc->longitude),
            ])
            ->sortBy('distance_km')
            ->values();

        // Simple nearest-neighbor optimization
        $route = [];
        $currentLat = $baseLat;
        $currentLng = $baseLng;
        $remaining = $locations->toArray();
        $totalDistance = 0;

        while (!empty($remaining)) {
            $nearest = null;
            $nearestIdx = 0;
            $nearestDist = PHP_FLOAT_MAX;

            foreach ($remaining as $idx => $loc) {
                $dist = $this->haversineDistance($currentLat, $currentLng, $loc['lat'], $loc['lng']);
                if ($dist < $nearestDist) {
                    $nearestDist = $dist;
                    $nearest = $loc;
                    $nearestIdx = $idx;
                }
            }

            $nearest['leg_distance_km'] = round($nearestDist, 1);
            $totalDistance += $nearestDist;
            $route[] = $nearest;
            $currentLat = $nearest['lat'];
            $currentLng = $nearest['lng'];
            array_splice($remaining, $nearestIdx, 1);
        }

        // Return leg back to base
        $returnDistance = !empty($route) ? $this->haversineDistance($currentLat, $currentLng, $baseLat, $baseLng) : 0;

        return [
            'stops' => count($route),
            'total_distance_km' => round($totalDistance, 1),
            'return_distance_km' => round($returnDistance, 1),
            'total_with_return_km' => round($totalDistance + $returnDistance, 1),
            'estimated_fuel_cost' => round(($totalDistance + $returnDistance) * 0.65, 2), // R$ 0.65/km avg
            'route' => $route,
            'google_maps_url' => $this->buildGoogleMapsUrl($baseLat, $baseLng, $route),
        ];
    }

    // ── Feature #9: Competitor Zones ──

    public function getCompetitorZones(int $tenantId): array
    {
        $competitors = InmetroCompetitor::where('tenant_id', $tenantId)->get();

        // Group instruments by city and find dominant competitor per city
        $cityData = DB::select("
            SELECT
                il.address_city as city,
                il.address_state as state,
                ih.executor,
                ic.id as competitor_id,
                ic.name as competitor_name,
                COUNT(DISTINCT ii.id) as instrument_count
            FROM inmetro_instruments ii
            INNER JOIN inmetro_locations il ON il.id = ii.location_id
            INNER JOIN inmetro_owners io ON io.id = il.owner_id
            LEFT JOIN inmetro_history ih ON ih.instrument_id = ii.id
            LEFT JOIN inmetro_competitors ic ON ic.id = ih.competitor_id
            WHERE io.tenant_id = ?
                AND il.address_city IS NOT NULL
            GROUP BY il.address_city, il.address_state, ih.executor, ic.id, ic.name
            ORDER BY il.address_city, instrument_count DESC
        ", [$tenantId]);

        $zones = collect($cityData)->groupBy('city')->map(function ($entries, $city) {
            $dominant = $entries->first();
            $total = $entries->sum('instrument_count');
            return [
                'city' => $city,
                'state' => $dominant->state,
                'total_instruments' => $total,
                'dominant_competitor' => $dominant->competitor_name ?? $dominant->executor ?? 'Desconhecido',
                'dominant_share' => $total > 0 ? round(($dominant->instrument_count / $total) * 100, 1) : 0,
                'competitors' => $entries->map(fn($e) => [
                    'name' => $e->competitor_name ?? $e->executor ?? 'N/A',
                    'count' => $e->instrument_count,
                    'share' => $total > 0 ? round(($e->instrument_count / $total) * 100, 1) : 0,
                ])->values(),
                'opportunity' => $dominant->competitor_name ? 'contested' : 'uncontested',
            ];
        })->values();

        return [
            'total_cities' => $zones->count(),
            'uncontested' => $zones->where('opportunity', 'uncontested')->count(),
            'zones' => $zones,
        ];
    }

    // ── Feature #10: Coverage vs Potential ──

    public function getCoverageVsPotential(int $tenantId): array
    {
        // Total instruments per city (potential)
        $potential = DB::select("
            SELECT
                il.address_city as city,
                il.address_state as state,
                COUNT(DISTINCT ii.id) as total_instruments,
                COUNT(DISTINCT io.id) as total_owners,
                SUM(CASE WHEN ii.current_status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM inmetro_instruments ii
            INNER JOIN inmetro_locations il ON il.id = ii.location_id
            INNER JOIN inmetro_owners io ON io.id = il.owner_id
            WHERE io.tenant_id = ?
                AND il.address_city IS NOT NULL
            GROUP BY il.address_city, il.address_state
            ORDER BY total_instruments DESC
        ", [$tenantId]);

        // Currently served (converted customers with OS)
        $served = DB::select("
            SELECT
                il.address_city as city,
                COUNT(DISTINCT io.id) as served_owners
            FROM inmetro_owners io
            INNER JOIN inmetro_locations il ON il.id = (
                SELECT id FROM inmetro_locations WHERE owner_id = io.id LIMIT 1
            )
            WHERE io.tenant_id = ?
                AND io.converted_to_customer_id IS NOT NULL
                AND il.address_city IS NOT NULL
            GROUP BY il.address_city
        ", [$tenantId]);

        $servedMap = collect($served)->keyBy('city');

        $analysis = collect($potential)->map(function ($city) use ($servedMap) {
            $servedCount = $servedMap->get($city->city)?->served_owners ?? 0;
            $coverage = $city->total_owners > 0
                ? round(($servedCount / $city->total_owners) * 100, 1)
                : 0;

            return [
                'city' => $city->city,
                'state' => $city->state,
                'total_instruments' => $city->total_instruments,
                'total_owners' => $city->total_owners,
                'served_owners' => $servedCount,
                'gap' => $city->total_owners - $servedCount,
                'coverage_pct' => $coverage,
                'rejected' => $city->rejected,
                'opportunity_level' => match (true) {
                    $coverage < 10 => 'very_high',
                    $coverage < 30 => 'high',
                    $coverage < 60 => 'medium',
                    default => 'low',
                },
            ];
        });

        return [
            'total_cities' => $analysis->count(),
            'avg_coverage' => round($analysis->avg('coverage_pct'), 1),
            'underserved' => $analysis->where('opportunity_level', 'very_high')->count(),
            'analysis' => $analysis->sortByDesc('gap')->values(),
        ];
    }

    // ── Feature #11: Density + Economic Viability ──

    public function getDensityViability(int $tenantId, float $baseLat, float $baseLng, float $costPerKm = 1.30): array
    {
        $cities = DB::select("
            SELECT
                il.address_city as city,
                AVG(CAST(il.latitude AS REAL)) as avg_lat,
                AVG(CAST(il.longitude AS REAL)) as avg_lng,
                COUNT(DISTINCT ii.id) as instruments,
                COUNT(DISTINCT io.id) as owners,
                SUM(io.estimated_revenue) as est_revenue
            FROM inmetro_locations il
            INNER JOIN inmetro_owners io ON io.id = il.owner_id
            INNER JOIN inmetro_instruments ii ON ii.location_id = il.id
            WHERE io.tenant_id = ?
                AND il.latitude IS NOT NULL
                AND il.address_city IS NOT NULL
            GROUP BY il.address_city
            HAVING instruments >= 1
        ", [$tenantId]);

        $viability = collect($cities)->map(function ($city) use ($baseLat, $baseLng, $costPerKm) {
            $distance = $this->haversineDistance($baseLat, $baseLng, (float)$city->avg_lat, (float)$city->avg_lng);
            $travelCost = $distance * 2 * $costPerKm; // Round trip
            $estimatedRevenue = (float)($city->est_revenue ?? $city->instruments * 500);
            $roi = $travelCost > 0 ? round(($estimatedRevenue - $travelCost) / $travelCost * 100, 1) : 0;

            return [
                'city' => $city->city,
                'instruments' => $city->instruments,
                'owners' => $city->owners,
                'distance_km' => round($distance, 1),
                'travel_cost' => round($travelCost, 2),
                'estimated_revenue' => round($estimatedRevenue, 2),
                'roi_pct' => $roi,
                'viability' => match (true) {
                    $roi >= 200 => 'excellent',
                    $roi >= 100 => 'viable',
                    $roi >= 30 => 'marginal',
                    default => 'inviable',
                },
                'density' => $city->instruments, // simplified density
            ];
        })->sortByDesc('roi_pct')->values();

        return [
            'total_cities' => $viability->count(),
            'excellent' => $viability->where('viability', 'excellent')->count(),
            'viable' => $viability->where('viability', 'viable')->count(),
            'marginal' => $viability->where('viability', 'marginal')->count(),
            'inviable' => $viability->where('viability', 'inviable')->count(),
            'cities' => $viability,
        ];
    }

    // ── Feature #12: Nearby Leads (Geofence) ──

    public function getNearbyLeads(int $tenantId, float $lat, float $lng, float $radiusKm = 50): array
    {
        $locations = InmetroLocation::whereHas('owner', function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)
                  ->whereNull('converted_to_customer_id');
            })
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->with(['owner:id,name,priority,lead_score,estimated_revenue,lead_status', 'instruments'])
            ->get()
            ->map(fn($loc) => [
                'location_id' => $loc->id,
                'owner_id' => $loc->owner_id,
                'owner_name' => $loc->owner?->name,
                'score' => $loc->owner?->lead_score ?? 0,
                'priority' => $loc->owner?->priority,
                'revenue' => $loc->owner?->estimated_revenue ?? 0,
                'city' => $loc->address_city,
                'lat' => (float)$loc->latitude,
                'lng' => (float)$loc->longitude,
                'distance_km' => $this->haversineDistance($lat, $lng, (float)$loc->latitude, (float)$loc->longitude),
                'instruments' => $loc->instruments->count(),
            ])
            ->filter(fn($loc) => $loc['distance_km'] <= $radiusKm)
            ->sortBy('distance_km')
            ->values();

        return [
            'radius_km' => $radiusKm,
            'total_nearby' => $locations->count(),
            'leads' => $locations,
        ];
    }

    // ── Private helpers ──

    private function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371; // km
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return round($earthRadius * $c, 2);
    }

    private function buildGoogleMapsUrl(float $baseLat, float $baseLng, array $route): string
    {
        $origin = "{$baseLat},{$baseLng}";
        $waypoints = collect($route)->map(fn($r) => "{$r['lat']},{$r['lng']}")->implode('|');
        return "https://www.google.com/maps/dir/{$origin}/{$waypoints}";
    }
}
