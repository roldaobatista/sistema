<?php

namespace App\Services;

use App\Models\InmetroLocation;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class InmetroGeocodingService
{
    /**
     * Geocode a location using Nominatim (OpenStreetMap) API.
     * Free, no API key needed. Rate limited to 1 request/second.
     */
    public function geocodeLocation(InmetroLocation $location): bool
    {
        if ($location->latitude && $location->longitude) {
            return true;
        }

        $address = $this->buildAddressString($location);
        if (empty($address)) {
            return false;
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders(['User-Agent' => 'SolutionCalibracoes/1.0'])
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q' => $address,
                    'format' => 'json',
                    'limit' => 1,
                    'countrycodes' => 'br',
                ]);

            if ($response->successful() && !empty($response->json())) {
                $result = $response->json()[0];
                $location->update([
                    'latitude' => (float) $result['lat'],
                    'longitude' => (float) $result['lon'],
                ]);
                return true;
            }

            // Fallback: try city + state only
            $fallback = "{$location->address_city}, {$location->address_state}, Brasil";
            $response = Http::timeout(10)
                ->withHeaders(['User-Agent' => 'SolutionCalibracoes/1.0'])
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q' => $fallback,
                    'format' => 'json',
                    'limit' => 1,
                    'countrycodes' => 'br',
                ]);

            if ($response->successful() && !empty($response->json())) {
                $result = $response->json()[0];
                $location->update([
                    'latitude' => (float) $result['lat'],
                    'longitude' => (float) $result['lon'],
                ]);
                return true;
            }
        } catch (\Exception $e) {
            Log::warning('Geocoding failed', [
                'location_id' => $location->id,
                'error' => $e->getMessage(),
            ]);
        }

        return false;
    }

    /**
     * Geocode all locations without coordinates for a tenant.
     * Respects Nominatim 1 req/s rate limit.
     */
    public function geocodeAll(int $tenantId, int $limit = 100): array
    {
        $stats = ['processed' => 0, 'geocoded' => 0, 'failed' => 0, 'skipped' => 0];

        $locations = InmetroLocation::whereHas('owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->where(function ($q) {
                $q->whereNull('latitude')->orWhereNull('longitude');
            })
            ->limit($limit)
            ->get();

        foreach ($locations as $location) {
            $stats['processed']++;

            if (empty($location->address_city)) {
                $stats['skipped']++;
                continue;
            }

            $success = $this->geocodeLocation($location);
            if ($success) {
                $stats['geocoded']++;
            } else {
                $stats['failed']++;
            }

            // Rate limit: 1 request per second for Nominatim
            usleep(1100000);
        }

        return $stats;
    }

    /**
     * Calculate distance from a base point to all locations.
     */
    public function calculateDistances(int $tenantId, float $baseLat, float $baseLng): int
    {
        $updated = 0;

        $locations = InmetroLocation::whereHas('owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get();

        foreach ($locations as $location) {
            $distance = $this->haversineDistance($baseLat, $baseLng, $location->latitude, $location->longitude);
            $location->update(['distance_from_base_km' => round($distance, 1)]);
            $updated++;
        }

        return $updated;
    }

    /**
     * Get map data: all geolocated locations with instruments for a tenant.
     */
    public function getMapData(int $tenantId): array
    {
        $locations = InmetroLocation::whereHas('owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->with(['owner:id,name,document,priority,lead_status,converted_to_customer_id', 'instruments'])
            ->get();

        $markers = $locations->map(function ($loc) {
            $instruments = $loc->instruments;
            $overdue = $instruments->filter(fn($i) =>
                $i->next_verification_at && $i->next_verification_at->isPast()
            )->count();
            $expiring30 = $instruments->filter(fn($i) =>
                $i->next_verification_at && $i->next_verification_at->isFuture() &&
                $i->next_verification_at->diffInDays(now()) <= 30
            )->count();

            return [
                'id' => $loc->id,
                'lat' => $loc->latitude,
                'lng' => $loc->longitude,
                'city' => $loc->address_city,
                'state' => $loc->address_state,
                'farm_name' => $loc->farm_name,
                'distance_km' => $loc->distance_from_base_km,
                'owner_name' => $loc->owner?->name,
                'owner_document' => $loc->owner?->document,
                'owner_priority' => $loc->owner?->priority,
                'lead_status' => $loc->owner?->lead_status,
                'is_customer' => $loc->owner?->converted_to_customer_id !== null,
                'instrument_count' => $instruments->count(),
                'overdue' => $overdue,
                'expiring_30d' => $expiring30,
            ];
        });

        $byCity = $markers->groupBy('city')->map(fn($group) => [
            'count' => $group->count(),
            'instruments' => $group->sum('instrument_count'),
            'overdue' => $group->sum('overdue'),
        ])->sortByDesc('instruments')->take(20);

        $totalWithoutGeo = InmetroLocation::whereHas('owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->where(fn($q) => $q->whereNull('latitude')->orWhereNull('longitude'))
            ->count();

        return [
            'markers' => $markers->values()->toArray(),
            'total_geolocated' => $markers->count(),
            'total_without_geo' => $totalWithoutGeo,
            'by_city' => $byCity->toArray(),
        ];
    }

    private function buildAddressString(InmetroLocation $location): string
    {
        $parts = array_filter([
            $location->address_street,
            $location->address_number,
            $location->address_neighborhood,
            $location->address_city,
            $location->address_state,
            'Brasil',
        ]);
        return implode(', ', $parts);
    }

    private function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }
}
