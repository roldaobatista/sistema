<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeightAssignment extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'standard_weight_id', 'assigned_to_user_id',
        'assigned_to_vehicle_id', 'assignment_type', 'assigned_at',
        'returned_at', 'assigned_by', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'returned_at' => 'datetime',
        ];
    }

    public function weight(): BelongsTo { return $this->belongsTo(StandardWeight::class, 'standard_weight_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to_user_id'); }
    public function vehicle(): BelongsTo { return $this->belongsTo(FleetVehicle::class, 'assigned_to_vehicle_id'); }
    public function assignedBy(): BelongsTo { return $this->belongsTo(User::class, 'assigned_by'); }

    public function scopeActive($query) { return $query->whereNull('returned_at'); }
}
