<?php

namespace App\Models\Fleet;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VehicleAccident extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'fleet_vehicle_id',
        'driver_id',
        'occurrence_date',
        'location',
        'description',
        'third_party_involved',
        'third_party_info',
        'police_report_number',
        'photos',
        'estimated_cost',
        'status',
    ];

    protected $casts = [
        'photos' => 'array',
        'third_party_involved' => 'boolean',
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
