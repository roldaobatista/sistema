<?php

namespace App\Services;

use App\Models\WorkOrder;
use App\Models\User;
use Carbon\Carbon;

class RoutingOptimizationService
{
    /**
     * Otimiza uma rota diária para um técnico (TSP heurístico simples para POC)
     */
    public function optimizeDailyPlan(int $tenantId, int $techId, string $date)
    {
        $parsedDate = Carbon::parse($date);
        
        // 1. Busca as OSs do técnico no dia
        $workOrders = WorkOrder::where('tenant_id', $tenantId)
            ->where('assigned_to', $techId)
            ->whereDate('scheduled_date', $parsedDate->toDateString())
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get();

        if ($workOrders->isEmpty()) {
            return [];
        }

        // Simulação de ponto de partida (Centro da Empresa ou Local Atual)
        // Por simplicidade, assumindo que o técnico parte do endereço da 1ª OS temporariamente
        $currentLat = $workOrders->first()->latitude;
        $currentLng = $workOrders->first()->longitude;
        
        $unvisited = $workOrders->all();
        $optimizedPath = [];

        // Simple Nearest Neighbor Heuristic
        while (!empty($unvisited)) {
            $nearestIndex = null;
            $nearestDistance = PHP_FLOAT_MAX;

            foreach ($unvisited as $index => $wo) {
                $distance = $this->calculateDistance($currentLat, $currentLng, $wo->latitude, $wo->longitude);
                if ($distance < $nearestDistance) {
                    $nearestDistance = $distance;
                    $nearestIndex = $index;
                }
            }

            if ($nearestIndex !== null) {
                $nextStop = $unvisited[$nearestIndex];
                $optimizedPath[] = [
                    'work_order_id' => $nextStop->id,
                    'number' => $nextStop->number,
                    'customer' => $nextStop->customer->name ?? 'N/A',
                    'distance_km' => round($nearestDistance, 2),
                    'lat' => $nextStop->latitude,
                    'lng' => $nextStop->longitude,
                ];
                $currentLat = $nextStop->latitude;
                $currentLng = $nextStop->longitude;
                unset($unvisited[$nearestIndex]);
            }
        }

        $totalDistance = array_sum(array_column($optimizedPath, 'distance_km'));
        $totalDuration = round(($totalDistance / 40) * 60) + (count($optimizedPath) * 30); // simplistic estimate

        \Illuminate\Support\Facades\DB::table('routes_planning')->updateOrInsert(
            [
                'tenant_id' => $tenantId,
                'tech_id' => $techId,
                'date' => $parsedDate->toDateString(),
            ],
            [
                'optimized_path_json' => json_encode($optimizedPath),
                'total_distance_km' => $totalDistance,
                'total_duration_minutes' => $totalDuration,
                'status' => 'optimized',
                'updated_at' => now(),
                // 'created_at' => now() // handled securely elsewhere or just use DB expressions
            ]
        );

        return $optimizedPath;
    }

    /**
     * Calcula distância em KM pela Fórmula de Haversine
     */
    private function calculateDistance($lat1, $lon1, $lat2, $lon2) {
        $earthRadius = 6371; // km
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        
        $a = sin($dLat/2) * sin($dLat/2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * 
             sin($dLon/2) * sin($dLon/2);
             
        $c = 2 * atan2(sqrt($a), sqrt(1-$a));
        return $earthRadius * $c;
    }
}
