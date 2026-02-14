<?php

namespace App\Services\Fleet;

class FuelComparisonService
{
    /**
     * Dados padrão de rendimento para comparação de combustíveis.
     * - Etanol: ~70% do rendimento da gasolina
     * - Diesel: ~30% mais eficiente que gasolina em longa distância
     */
    public function compare(float $gasolinePrice, float $ethanolPrice, ?float $dieselPrice = null): array
    {
        $ratio = $gasolinePrice > 0 ? $ethanolPrice / $gasolinePrice : 1;

        $recommendation = $ratio < 0.7 ? 'ethanol' : 'gasoline';
        $savingsPercent = abs(1 - $ratio) * 100;

        $result = [
            'gasoline_price' => round($gasolinePrice, 3),
            'ethanol_price' => round($ethanolPrice, 3),
            'ratio' => round($ratio, 3),
            'recommendation' => $recommendation,
            'recommendation_label' => $recommendation === 'ethanol' ? 'Abasteça com Etanol' : 'Abasteça com Gasolina',
            'savings_percent' => round($savingsPercent, 1),
            'threshold' => 0.7,
        ];

        if ($dieselPrice !== null) {
            $result['diesel_price'] = round($dieselPrice, 3);
            $result['diesel_cost_per_km'] = $dieselPrice > 0 ? round($dieselPrice / 8.0, 4) : 0; // ~8 km/L média diesel
            $result['gasoline_cost_per_km'] = $gasolinePrice > 0 ? round($gasolinePrice / 10.0, 4) : 0; // ~10 km/L
            $result['ethanol_cost_per_km'] = $ethanolPrice > 0 ? round($ethanolPrice / 7.0, 4) : 0; // ~7 km/L
        }

        return $result;
    }

    /**
     * Simulação de custo por viagem.
     */
    public function simulateTrip(float $distanceKm, float $avgConsumption, float $fuelPrice): array
    {
        $litersNeeded = $avgConsumption > 0 ? $distanceKm / $avgConsumption : 0;
        $totalCost = $litersNeeded * $fuelPrice;

        return [
            'distance_km' => $distanceKm,
            'avg_consumption_km_l' => $avgConsumption,
            'fuel_price' => $fuelPrice,
            'liters_needed' => round($litersNeeded, 2),
            'total_cost' => round($totalCost, 2),
            'cost_per_km' => $distanceKm > 0 ? round($totalCost / $distanceKm, 4) : 0,
        ];
    }
}
