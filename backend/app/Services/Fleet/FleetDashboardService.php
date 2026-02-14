<?php

namespace App\Services\Fleet;

use App\Models\FleetVehicle;
use App\Models\Fleet\FuelLog;
use App\Models\Fleet\VehicleInsurance;
use App\Models\Fleet\VehicleAccident;
use App\Models\Fleet\VehicleTire;
use App\Models\VehicleInspection;
use Illuminate\Support\Facades\DB;

class FleetDashboardService
{
    public function getAdvancedDashboard(int $tenantId): array
    {
        $vehicles = FleetVehicle::where('tenant_id', $tenantId);
        $totalVehicles = $vehicles->count();

        $statusCounts = FleetVehicle::where('tenant_id', $tenantId)
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        // Consumo médio por tipo de combustível
        $avgConsumption = FuelLog::where('tenant_id', $tenantId)
            ->whereNotNull('liters')
            ->where('liters', '>', 0)
            ->select('fuel_type', DB::raw('AVG(odometer_km / NULLIF(liters, 0)) as avg_km_per_liter'))
            ->groupBy('fuel_type')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->fuel_type => round($row->avg_km_per_liter, 1)])
            ->toArray();

        // Custo/Km médio da frota
        $avgCostPerKm = FleetVehicle::where('tenant_id', $tenantId)
            ->whereNotNull('cost_per_km')
            ->where('cost_per_km', '>', 0)
            ->avg('cost_per_km');

        // Alertas consolidados
        $alerts = $this->buildAlerts($tenantId);

        // Taxa de disponibilidade
        $activeCount = $statusCounts['active'] ?? 0;
        $availabilityRate = $totalVehicles > 0 ? round(($activeCount / $totalVehicles) * 100) : 0;

        // Manutenções próximas (próximos 30 dias)
        $upcomingMaintenances = FleetVehicle::where('tenant_id', $tenantId)
            ->whereNotNull('next_maintenance')
            ->where('next_maintenance', '<=', now()->addDays(30))
            ->where('next_maintenance', '>=', now())
            ->count();

        return [
            'total_vehicles' => $totalVehicles,
            'active_count' => $activeCount,
            'maintenance_count' => $statusCounts['maintenance'] ?? 0,
            'inactive_count' => $statusCounts['inactive'] ?? 0,
            'pool_waiting_count' => 0,
            'accident_count' => VehicleAccident::where('tenant_id', $tenantId)->where('status', 'open')->count(),
            'avg_cost_per_km' => round($avgCostPerKm ?? 0, 2),
            'avg_consumption_diesel' => $avgConsumption['diesel'] ?? 0,
            'avg_consumption_gasoline' => $avgConsumption['gasoline'] ?? 0,
            'avg_consumption_flex' => $avgConsumption['flex'] ?? 0,
            'availability_rate' => $availabilityRate,
            'upcoming_maintenances' => $upcomingMaintenances,
            'alerts' => $alerts,
            'overdue_inspections' => VehicleInspection::where('tenant_id', $tenantId)->where('status', 'critical')->count(),
            'total_tools' => 0,
        ];
    }

    private function buildAlerts(int $tenantId): array
    {
        $alerts = [];

        // CNH vencendo
        $cnhAlerts = FleetVehicle::where('tenant_id', $tenantId)
            ->whereNotNull('cnh_expiry_driver')
            ->where('cnh_expiry_driver', '<=', now()->addDays(60))
            ->where('cnh_expiry_driver', '>=', now())
            ->with('assignedUser:id,name')
            ->get();

        foreach ($cnhAlerts as $v) {
            $daysLeft = now()->diffInDays($v->cnh_expiry_driver);
            $alerts[] = [
                'title' => "CNH vencendo: {$v->assignedUser?->name}",
                'description' => "Veículo {$v->plate} — CNH vence em {$v->cnh_expiry_driver->format('d/m/Y')}",
                'severity' => $daysLeft <= 15 ? 'critical' : 'warning',
                'days_left' => $daysLeft,
                'type' => 'cnh',
            ];
        }

        // CRLV vencendo
        $crlvAlerts = FleetVehicle::where('tenant_id', $tenantId)
            ->whereNotNull('crlv_expiry')
            ->where('crlv_expiry', '<=', now()->addDays(60))
            ->where('crlv_expiry', '>=', now())
            ->get();

        foreach ($crlvAlerts as $v) {
            $daysLeft = now()->diffInDays($v->crlv_expiry);
            $alerts[] = [
                'title' => "CRLV vencendo: {$v->plate}",
                'description' => "{$v->brand} {$v->model} — CRLV vence em {$v->crlv_expiry->format('d/m/Y')}",
                'severity' => $daysLeft <= 15 ? 'critical' : 'warning',
                'days_left' => $daysLeft,
                'type' => 'crlv',
            ];
        }

        // Seguros vencendo
        $insuranceAlerts = VehicleInsurance::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->where('end_date', '<=', now()->addDays(30))
            ->where('end_date', '>=', now())
            ->with('vehicle:id,plate')
            ->get();

        foreach ($insuranceAlerts as $ins) {
            $daysLeft = now()->diffInDays($ins->end_date);
            $alerts[] = [
                'title' => "Seguro vencendo: {$ins->vehicle?->plate}",
                'description' => "Apólice {$ins->policy_number} — {$ins->insurer}",
                'severity' => $daysLeft <= 7 ? 'critical' : 'warning',
                'days_left' => $daysLeft,
                'type' => 'insurance',
            ];
        }

        // Manutenção preventiva
        $maintAlerts = FleetVehicle::where('tenant_id', $tenantId)
            ->whereNotNull('next_maintenance')
            ->where('next_maintenance', '<=', now()->addDays(15))
            ->get();

        foreach ($maintAlerts as $v) {
            $daysLeft = max(0, now()->diffInDays($v->next_maintenance, false));
            $alerts[] = [
                'title' => "Manutenção pendente: {$v->plate}",
                'description' => "{$v->brand} {$v->model} — " . ($daysLeft <= 0 ? 'ATRASADA' : "em {$daysLeft} dias"),
                'severity' => $daysLeft <= 0 ? 'critical' : 'warning',
                'days_left' => max(0, $daysLeft),
                'type' => 'maintenance',
            ];
        }

        usort($alerts, fn ($a, $b) => $a['days_left'] <=> $b['days_left']);

        return $alerts;
    }
}
