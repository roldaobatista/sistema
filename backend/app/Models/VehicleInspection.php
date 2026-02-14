<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class VehicleInspection extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'fleet_vehicle_id', 'inspector_id', 'inspection_date',
        'odometer_km', 'checklist_data', 'status', 'observations',
    ];

    protected $casts = [
        'inspection_date' => 'date',
        'checklist_data' => 'array',
        'odometer_km' => 'integer',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(FleetVehicle::class, 'fleet_vehicle_id');
    }

    public function inspector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inspector_id');
    }
}
