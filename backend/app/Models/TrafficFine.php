<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class TrafficFine extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'fleet_vehicle_id', 'driver_id', 'fine_date', 'infraction_code',
        'description', 'amount', 'points', 'status', 'due_date',
    ];

    protected $casts = [
        'fine_date' => 'date',
        'due_date' => 'date',
        'amount' => 'decimal:2',
        'points' => 'integer',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(FleetVehicle::class, 'fleet_vehicle_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }
}
