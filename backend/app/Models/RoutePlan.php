<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class RoutePlan extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'technician_id', 'plan_date', 'stops',
        'total_distance_km', 'estimated_duration_min', 'status',
    ];

    protected $casts = [
        'plan_date' => 'date',
        'stops' => 'array',
        'total_distance_km' => 'decimal:2',
        'estimated_duration_min' => 'integer',
    ];

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }
}
