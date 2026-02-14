<?php

namespace App\Services\Fleet;

use App\Models\FleetVehicle;
use App\Models\Fleet\FuelLog;
use App\Models\Fleet\VehicleAccident;
use App\Models\VehicleInspection;
use Illuminate\Support\Facades\DB;

class DriverScoringService
{
    private const MAX_SCORE = 100;

    /**
     * Calcula pontuação de 0-100 para um motorista baseado em: multas, acidentes, inspeções, consumo.
     */
    public function calculateScore(int $driverId, int $tenantId): array
    {
        $score = self::MAX_SCORE;
        $breakdown = [];

        // Multas nos últimos 12 meses (cada multa = -5 pontos, max -30)
        $finesCount = DB::table('traffic_fines')
            ->where('tenant_id', $tenantId)
            ->where('driver_id', $driverId)
            ->where('infraction_date', '>=', now()->subYear())
            ->count();
        $finesPenalty = min($finesCount * 5, 30);
        $score -= $finesPenalty;
        $breakdown['fines'] = ['count' => $finesCount, 'penalty' => -$finesPenalty, 'label' => 'Multas'];

        // Acidentes nos últimos 12 meses (cada acidente = -15 pontos, max -30)
        $accidentsCount = VehicleAccident::where('tenant_id', $tenantId)
            ->where('driver_id', $driverId)
            ->where('accident_date', '>=', now()->subYear())
            ->count();
        $accidentsPenalty = min($accidentsCount * 15, 30);
        $score -= $accidentsPenalty;
        $breakdown['accidents'] = ['count' => $accidentsCount, 'penalty' => -$accidentsPenalty, 'label' => 'Acidentes'];

        // Inspeções completadas OK nos últimos 6 meses (cada = +2 pontos, max +10)
        $okInspections = VehicleInspection::where('tenant_id', $tenantId)
            ->where('inspector_id', $driverId)
            ->where('status', 'ok')
            ->where('inspection_date', '>=', now()->subMonths(6))
            ->count();
        $inspectionBonus = min($okInspections * 2, 10);
        $score += $inspectionBonus;
        $breakdown['inspections'] = ['count' => $okInspections, 'bonus' => $inspectionBonus, 'label' => 'Inspeções OK'];

        // Eficiência de combustível (acima da média = +5, abaixo = -5)
        $driverAvg = FuelLog::where('tenant_id', $tenantId)
            ->where('driver_id', $driverId)
            ->where('liters', '>', 0)
            ->avg(DB::raw('odometer_km / NULLIF(liters, 0)'));

        $fleetAvg = FuelLog::where('tenant_id', $tenantId)
            ->where('liters', '>', 0)
            ->avg(DB::raw('odometer_km / NULLIF(liters, 0)'));

        $fuelScore = 0;
        if ($driverAvg && $fleetAvg) {
            $fuelScore = $driverAvg >= $fleetAvg ? 5 : -5;
        }
        $score += $fuelScore;
        $breakdown['fuel_efficiency'] = [
            'driver_avg' => round($driverAvg ?? 0, 1),
            'fleet_avg' => round($fleetAvg ?? 0, 1),
            'score' => $fuelScore,
            'label' => 'Eficiência Combustível',
        ];

        $score = max(0, min(100, $score));

        return [
            'driver_id' => $driverId,
            'score' => $score,
            'grade' => $this->scoreToGrade($score),
            'breakdown' => $breakdown,
            'calculated_at' => now()->toDateTimeString(),
        ];
    }

    private function scoreToGrade(int $score): string
    {
        return match (true) {
            $score >= 90 => 'A',
            $score >= 75 => 'B',
            $score >= 60 => 'C',
            $score >= 40 => 'D',
            default => 'F',
        };
    }

    /**
     * Ranking de motoristas por score.
     */
    public function getRanking(int $tenantId, int $limit = 20): array
    {
        $drivers = DB::table('users')
            ->where('tenant_id', $tenantId)
            ->whereExists(function ($q) use ($tenantId) {
                $q->select(DB::raw(1))
                    ->from('fleet_vehicles')
                    ->where('tenant_id', $tenantId)
                    ->whereColumn('assigned_user_id', 'users.id');
            })
            ->select('id', 'name')
            ->limit($limit)
            ->get();

        $scores = $drivers->map(fn ($d) => $this->calculateScore($d->id, $tenantId));

        return $scores->sortByDesc('score')->values()->toArray();
    }
}
