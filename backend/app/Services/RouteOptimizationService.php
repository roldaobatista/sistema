<?php

namespace App\Services;

use App\Models\WorkOrder;
use Illuminate\Support\Collection;

class RouteOptimizationService
{
    /**
     * Optimize route using Nearest Neighbor algorithm.
     *
     * @param Collection $workOrders List of work orders to visit.
     * @param float $startLat Starting latitude.
     * @param float $startLng Starting longitude.
     * @return Collection Sorted work orders.
     */
    public function optimize(Collection $workOrders, float $startLat, float $startLng): Collection
    {
        $pending = $workOrders->keyBy('id');
        $sorted = new Collection();
        
        $currentLat = $startLat;
        $currentLng = $startLng;

        while ($pending->isNotEmpty()) {
            $nearestId = null;
            $minDist = PHP_FLOAT_MAX;

            foreach ($pending as $id => $order) {
                // Determine target coordinates (Customer location)
                $targetLat = $order->customer->latitude ?? null;
                $targetLng = $order->customer->longitude ?? null;

                if ($targetLat === null || $targetLng === null) {
                    continue;
                }

                $dist = $this->haversine($currentLat, $currentLng, $targetLat, $targetLng);

                if ($dist < $minDist) {
                    $minDist = $dist;
                    $nearestId = $id;
                }
            }

            if ($nearestId) {
                $next = $pending[$nearestId];
                $sorted->push($next);
                $pending->forget($nearestId);
                
                // Update current location to the next stop
                $currentLat = $next->customer->latitude;
                $currentLng = $next->customer->longitude;
            } else {
                // If remaining items have no coordinates, just append them
                foreach ($pending as $item) {
                    $sorted->push($item);
                }
                break;
            }
        }

        return $sorted;
    }

    /**
     * Calculate distance between two points in km.
     */
    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371; // km

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }
}
