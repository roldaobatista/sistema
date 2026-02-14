<?php

namespace App\Models\Fleet;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Fleet\FleetVehicle;

class VehicleTire extends Model
{
    /** @use HasFactory<\Database\Factories\Fleet\VehicleTireFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'fleet_vehicle_id',
        'serial_number',
        'brand',
        'model',
        'position',
        'tread_depth',
        'retread_count',
        'installed_at',
        'installed_km',
        'status',
    ];

    public function vehicle()
    {
        return $this->belongsTo(\App\Models\FleetVehicle::class, 'fleet_vehicle_id');
    }
}
