<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InmetroCompetitor extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'cnpj', 'authorization_number',
        'phone', 'email', 'address', 'city', 'state',
        'authorized_species', 'mechanics',
        'max_capacity', 'accuracy_classes', 'authorization_valid_until',
        'total_repairs_done', 'last_repair_date', 'website',
    ];

    protected function casts(): array
    {
        return [
            'authorized_species' => 'array',
            'mechanics' => 'array',
            'accuracy_classes' => 'array',
            'authorization_valid_until' => 'date',
            'last_repair_date' => 'date',
        ];
    }

    public function repairs(): HasMany
    {
        return $this->hasMany(CompetitorInstrumentRepair::class, 'competitor_id');
    }

    public function historyEntries(): HasMany
    {
        return $this->hasMany(InmetroHistory::class, 'competitor_id');
    }

    public function scopeByCity($query, string $city)
    {
        return $query->where('city', $city);
    }

    public function scopeByState($query, string $state)
    {
        return $query->where('state', $state);
    }
}
