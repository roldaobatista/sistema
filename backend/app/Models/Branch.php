<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\Auditable;

class Branch extends Model
{
    use BelongsToTenant, HasFactory, Auditable;

    protected $fillable = [
        'tenant_id',
        'name',
        'code',
        'address_street',
        'address_number',
        'address_complement',
        'address_neighborhood',
        'address_city',
        'address_state',
        'address_zip',
        'phone',
        'email',
    ];

    protected function casts(): array
    {
        return [
            'tenant_id' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function numberingSequences(): HasMany
    {
        return $this->hasMany(NumberingSequence::class);
    }

    public function getFullAddressAttribute(): ?string
    {
        $parts = array_filter([
            $this->address_street,
            $this->address_number,
            $this->address_neighborhood,
            $this->address_city ? "{$this->address_city}/{$this->address_state}" : null,
        ]);

        return !empty($parts) ? implode(', ', $parts) : null;
    }
}
