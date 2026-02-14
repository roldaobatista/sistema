<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;

class TimeClockEntry extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'clock_in', 'clock_out',
        'latitude_in', 'longitude_in', 'latitude_out', 'longitude_out',
        'type', 'notes',
        // v2 fields
        'selfie_path', 'liveness_score', 'liveness_passed',
        'geofence_location_id', 'geofence_distance_meters',
        'device_info', 'ip_address', 'clock_method',
        'approval_status', 'approved_by', 'rejection_reason',
        'work_order_id',
    ];

    protected $casts = [
        'clock_in' => 'datetime',
        'clock_out' => 'datetime',
        'latitude_in' => 'decimal:7',
        'longitude_in' => 'decimal:7',
        'latitude_out' => 'decimal:7',
        'longitude_out' => 'decimal:7',
        'liveness_score' => 'decimal:2',
        'liveness_passed' => 'boolean',
        'geofence_distance_meters' => 'integer',
        'device_info' => 'array',
    ];

    // ─── Relationships ──────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function geofenceLocation(): BelongsTo
    {
        return $this->belongsTo(GeofenceLocation::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(TimeClockAdjustment::class);
    }

    // ─── Scopes ─────────────────────────────────────────────────

    public function scopeOpen($query)
    {
        return $query->whereNull('clock_out');
    }

    public function scopePendingApproval($query)
    {
        return $query->where('approval_status', 'pending');
    }

    public function scopeTodayForUser($query, int $userId)
    {
        return $query->where('user_id', $userId)
            ->whereDate('clock_in', today());
    }

    public function scopeForDateRange($query, string $from, string $to)
    {
        return $query->whereDate('clock_in', '>=', $from)
            ->whereDate('clock_in', '<=', $to);
    }

    // ─── Accessors ──────────────────────────────────────────────

    public function getDurationMinutesAttribute(): ?int
    {
        if (!$this->clock_out) return null;
        return $this->clock_in->diffInMinutes($this->clock_out);
    }

    public function getDurationHoursAttribute(): ?float
    {
        if (!$this->clock_out) return null;
        return round($this->clock_in->diffInMinutes($this->clock_out) / 60, 2);
    }

    public function getIsWithinGeofenceAttribute(): bool
    {
        return $this->geofence_distance_meters !== null
            && $this->geofence_location_id !== null
            && $this->geofenceLocation
            && $this->geofence_distance_meters <= $this->geofenceLocation->radius_meters;
    }

    public function getIsOpenAttribute(): bool
    {
        return $this->clock_out === null;
    }
}
