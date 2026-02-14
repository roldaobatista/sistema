<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;

class FleetVehicle extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'plate', 'brand', 'model', 'year', 'color', 'type', 'fuel_type',
        'odometer_km', 'renavam', 'chassis', 'crlv_expiry', 'insurance_expiry',
        'next_maintenance', 'tire_change_date', 'purchase_value', 'assigned_user_id',
        'status', 'notes', 'avg_fuel_consumption', 'cost_per_km', 'cnh_expiry_driver'
    ];

    protected $casts = [
        'crlv_expiry' => 'date',
        'insurance_expiry' => 'date',
        'next_maintenance' => 'date',
        'tire_change_date' => 'date',
        'purchase_value' => 'decimal:2',
        'odometer_km' => 'integer',
        'year' => 'integer',
    ];

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(VehicleInspection::class);
    }

    public function fines(): HasMany
    {
        return $this->hasMany(TrafficFine::class);
    }

    public function fuelingLogs(): HasMany
    {
        return $this->hasMany(FuelingLog::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function tools(): HasMany
    {
        return $this->hasMany(ToolInventory::class);
    }

    public function tires(): HasMany
    {
        return $this->hasMany(\App\Models\Fleet\VehicleTire::class, 'fleet_vehicle_id');
    }

    public function fuelLogs(): HasMany
    {
        return $this->hasMany(\App\Models\Fleet\FuelLog::class, 'fleet_vehicle_id');
    }

    public function poolRequests(): HasMany
    {
        return $this->hasMany(\App\Models\Fleet\VehiclePoolRequest::class, 'fleet_vehicle_id');
    }

    public function accidents(): HasMany
    {
        return $this->hasMany(\App\Models\Fleet\VehicleAccident::class, 'fleet_vehicle_id');
    }

    public function getAverageConsumptionAttribute(): ?float
    {
        $logs = $this->fuelingLogs()->orderBy('created_at', 'desc')->take(10)->get();
        if ($logs->count() < 2) return null;
        $totalKm = $logs->first()->odometer_km - $logs->last()->odometer_km;
        $totalLiters = $logs->sum('liters');
        return $totalLiters > 0 ? round($totalKm / $totalLiters, 2) : null;
    }
}
