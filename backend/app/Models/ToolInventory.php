<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class ToolInventory extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'serial_number', 'category', 'assigned_to',
        'fleet_vehicle_id', 'calibration_due', 'status', 'value', 'notes',
    ];

    protected $casts = [
        'calibration_due' => 'date',
        'value' => 'decimal:2',
    ];

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(FleetVehicle::class, 'fleet_vehicle_id');
    }

    public function getIsCalibrationDueAttribute(): bool
    {
        return $this->calibration_due && $this->calibration_due->lte(now()->addMonth());
    }
}
