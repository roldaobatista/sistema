<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InmetroOwner extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'document', 'name', 'trade_name', 'type',
        'phone', 'phone2', 'email', 'contact_source', 'contact_enriched_at',
        'lead_status', 'priority', 'converted_to_customer_id', 'notes',
        'estimated_revenue', 'total_instruments',
    ];

    protected function casts(): array
    {
        return [
            'contact_enriched_at' => 'datetime',
            'estimated_revenue' => 'decimal:2',
        ];
    }

    public function locations(): HasMany
    {
        return $this->hasMany(InmetroLocation::class, 'owner_id');
    }

    public function instruments()
    {
        return $this->hasManyThrough(InmetroInstrument::class, InmetroLocation::class, 'owner_id', 'location_id');
    }

    public function convertedCustomer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'converted_to_customer_id');
    }

    public function scopeLeads($query)
    {
        return $query->whereNull('converted_to_customer_id');
    }

    public function scopeConverted($query)
    {
        return $query->whereNotNull('converted_to_customer_id');
    }

    public function scopeByPriority($query, string $priority)
    {
        return $query->where('priority', $priority);
    }

    public function scopeCritical($query)
    {
        return $query->where('priority', 'critical');
    }

    public function scopeWithRejectedInstruments($query)
    {
        return $query->whereHas('instruments', fn ($q) => $q->where('current_status', 'rejected'));
    }

    public function scopeWithExpiringInstruments($query, int $days = 90)
    {
        return $query->whereHas('instruments', function ($q) use ($days) {
            $q->whereNotNull('next_verification_at')
              ->where('next_verification_at', '<=', now()->addDays($days));
        });
    }

    public function getInstrumentCountAttribute(): int
    {
        return $this->instruments()->count();
    }

    public function getRejectedCountAttribute(): int
    {
        return $this->instruments()->where('current_status', 'rejected')->count();
    }

    public function getExpiringCountAttribute(): int
    {
        return $this->instruments()
            ->where('next_verification_at', '<=', now()->addDays(90))
            ->count();
    }

    public function getUrgentCountAttribute(): int
    {
        return $this->instruments()
            ->where('next_verification_at', '<=', now()->addDays(30))
            ->count();
    }
}
