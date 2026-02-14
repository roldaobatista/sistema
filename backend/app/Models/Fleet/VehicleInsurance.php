<?php

namespace App\Models\Fleet;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\FleetVehicle;

class VehicleInsurance extends Model
{
    use SoftDeletes;

    protected $table = 'vehicle_insurances';

    protected $fillable = [
        'tenant_id',
        'fleet_vehicle_id',
        'insurer',
        'policy_number',
        'coverage_type',
        'premium_value',
        'deductible_value',
        'start_date',
        'end_date',
        'broker_name',
        'broker_phone',
        'status',
        'notes',
    ];

    protected $casts = [
        'premium_value' => 'decimal:2',
        'deductible_value' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(FleetVehicle::class, 'fleet_vehicle_id');
    }

    public function isExpired(): bool
    {
        return $this->end_date->isPast();
    }

    public function isExpiringSoon(int $days = 30): bool
    {
        return !$this->isExpired() && $this->end_date->diffInDays(now()) <= $days;
    }
}
