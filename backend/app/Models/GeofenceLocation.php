<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use App\Models\Concerns\BelongsToTenant;

class GeofenceLocation extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'latitude', 'longitude', 'radius_meters',
        'is_active', 'linked_entity_type', 'linked_entity_id', 'notes',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'radius_meters' => 'integer',
        'is_active' => 'boolean',
    ];

    public function linkedEntity(): MorphTo
    {
        return $this->morphTo();
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Calculate distance in meters from given coordinates using Haversine formula.
     */
    public function distanceFrom(float $lat, float $lng): float
    {
        $earthRadius = 6371000; // meters
        $latFrom = deg2rad($this->latitude);
        $latTo = deg2rad($lat);
        $latDelta = deg2rad($lat - $this->latitude);
        $lngDelta = deg2rad($lng - $this->longitude);

        $a = sin($latDelta / 2) * sin($latDelta / 2)
            + cos($latFrom) * cos($latTo)
            * sin($lngDelta / 2) * sin($lngDelta / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c);
    }

    /**
     * Check if coordinates are within the geofence radius.
     */
    public function isWithinRadius(float $lat, float $lng): bool
    {
        return $this->distanceFrom($lat, $lng) <= $this->radius_meters;
    }
}
