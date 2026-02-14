<?php

namespace App\Models\Fleet;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VehiclePoolRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'fleet_vehicle_id',
        'requested_start',
        'requested_end',
        'actual_start',
        'actual_end',
        'purpose',
        'status',
    ];

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(\App\Models\FleetVehicle::class, 'fleet_vehicle_id');
    }
}
