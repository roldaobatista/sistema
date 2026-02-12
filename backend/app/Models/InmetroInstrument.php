<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InmetroInstrument extends Model
{
    use HasFactory;

    protected $fillable = [
        'location_id', 'inmetro_number', 'serial_number',
        'brand', 'model', 'capacity', 'instrument_type',
        'current_status', 'last_verification_at', 'next_verification_at',
        'last_executor', 'source',
    ];

    protected function casts(): array
    {
        return [
            'last_verification_at' => 'date',
            'next_verification_at' => 'date',
        ];
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(InmetroLocation::class, 'location_id');
    }

    public function owner()
    {
        return $this->hasOneThrough(
            InmetroOwner::class,
            InmetroLocation::class,
            'id',
            'id',
            'location_id',
            'owner_id'
        );
    }

    public function history(): HasMany
    {
        return $this->hasMany(InmetroHistory::class, 'instrument_id')->orderByDesc('event_date');
    }

    public function getDaysUntilDueAttribute(): ?int
    {
        if (!$this->next_verification_at) {
            return null;
        }
        return (int) now()->startOfDay()->diffInDays($this->next_verification_at, false);
    }

    public function getPriorityAttribute(): string
    {
        $days = $this->days_until_due;
        if ($days === null) return 'unknown';
        if ($days <= 0) return 'overdue';
        if ($days <= 30) return 'urgent';
        if ($days <= 60) return 'high';
        if ($days <= 90) return 'normal';
        return 'low';
    }

    public function getStatusBadgeAttribute(): string
    {
        return match ($this->current_status) {
            'approved' => 'Aprovado',
            'rejected' => 'Reprovado',
            'repaired' => 'Reparado',
            default => 'Desconhecido',
        };
    }

    public function scopeExpiringSoon($query, int $days = 90)
    {
        return $query->whereNotNull('next_verification_at')
            ->where('next_verification_at', '<=', now()->addDays($days))
            ->where('next_verification_at', '>', now());
    }

    public function scopeOverdue($query)
    {
        return $query->whereNotNull('next_verification_at')
            ->where('next_verification_at', '<', now());
    }

    public function scopeByCity($query, string $city)
    {
        return $query->whereHas('location', fn($q) => $q->where('address_city', $city));
    }
}
