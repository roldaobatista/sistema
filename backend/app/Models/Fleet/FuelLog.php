<?php

namespace App\Models\Fleet;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FuelLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'fleet_vehicle_id',
        'driver_id',
        'date',
        'odometer_km',
        'liters',
        'price_per_liter',
        'total_value',
        'fuel_type',
        'gas_station',
        'consumption_km_l',
        'receipt_path',
    ];

    public function vehicle()
    {
        return $this->belongsTo(\App\Models\FleetVehicle::class, 'fleet_vehicle_id');
    }

    public function driver()
    {
        return $this->belongsTo(\App\Models\User::class, 'driver_id');
    }
}
