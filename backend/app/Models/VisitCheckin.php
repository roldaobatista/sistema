<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VisitCheckin extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'user_id', 'activity_id',
        'checkin_at', 'checkin_lat', 'checkin_lng', 'checkin_address', 'checkin_photo',
        'checkout_at', 'checkout_lat', 'checkout_lng', 'checkout_photo',
        'duration_minutes', 'distance_from_client_meters', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'checkin_at' => 'datetime',
            'checkout_at' => 'datetime',
            'checkin_lat' => 'float',
            'checkin_lng' => 'float',
            'checkout_lat' => 'float',
            'checkout_lng' => 'float',
            'distance_from_client_meters' => 'float',
        ];
    }

    const STATUSES = [
        'checked_in' => 'Em Visita',
        'checked_out' => 'Finalizada',
        'cancelled' => 'Cancelada',
    ];

    public function scopeActive($q) { return $q->where('status', 'checked_in'); }
    public function scopeCompleted($q) { return $q->where('status', 'checked_out'); }
    public function scopeByUser($q, int $userId) { return $q->where('user_id', $userId); }
    public function scopeToday($q) { return $q->whereDate('checkin_at', today()); }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function activity(): BelongsTo { return $this->belongsTo(CrmActivity::class); }
    public function report(): HasOne { return $this->hasOne(VisitReport::class, 'checkin_id'); }
    public function survey(): HasOne { return $this->hasOne(VisitSurvey::class, 'checkin_id'); }
    public function routeStop(): HasOne { return $this->hasOne(VisitRouteStop::class, 'checkin_id'); }

    public function checkout(float $lat = null, float $lng = null, string $photo = null): void
    {
        $this->update([
            'checkout_at' => now(),
            'checkout_lat' => $lat,
            'checkout_lng' => $lng,
            'checkout_photo' => $photo,
            'status' => 'checked_out',
            'duration_minutes' => (int) $this->checkin_at->diffInMinutes(now()),
        ]);
    }
}
