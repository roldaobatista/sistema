<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\Auditable;

class Tenant extends Model
{
    use HasFactory, Auditable;

    protected $table = 'tenants';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_TRIAL = 'trial';

    public const STATUSES = [
        self::STATUS_ACTIVE => 'Ativo',
        self::STATUS_INACTIVE => 'Inativo',
        self::STATUS_TRIAL => 'Teste',
    ];

    protected $fillable = [
        'name',
        'trade_name',
        'document',
        'email',
        'phone',
        'status',
        'website',
        'state_registration',
        'city_registration',
        'address_street',
        'address_number',
        'address_complement',
        'address_neighborhood',
        'address_city',
        'address_state',
        'address_zip',
        'inmetro_config',
    ];

    protected function casts(): array
    {
        return [
            'status' => 'string',
            'inmetro_config' => 'array',
        ];
    }

    /* ── Relationships ── */

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_tenants')
            ->withPivot('is_default')
            ->withTimestamps();
    }

    public function settings(): HasMany
    {
        return $this->hasMany(TenantSetting::class);
    }

    public function numberingSequences(): HasMany
    {
        return $this->hasMany(NumberingSequence::class);
    }

    /* ── Status Helpers ── */

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isInactive(): bool
    {
        return $this->status === self::STATUS_INACTIVE;
    }

    public function isTrial(): bool
    {
        return $this->status === self::STATUS_TRIAL;
    }

    public function isAccessible(): bool
    {
        return $this->status !== self::STATUS_INACTIVE;
    }

    /* ── Accessors ── */

    public function getDisplayNameAttribute(): string
    {
        return $this->trade_name ?: $this->name;
    }

    public function getFullAddressAttribute(): ?string
    {
        $parts = array_filter([
            $this->address_street,
            $this->address_number ? "nº {$this->address_number}" : null,
            $this->address_complement,
            $this->address_neighborhood,
            $this->address_city ? "{$this->address_city}/{$this->address_state}" : null,
        ]);

        if (empty($parts)) {
            return null;
        }

        $address = implode(', ', $parts);
        if ($this->address_zip) {
            $address .= " — CEP {$this->address_zip}";
        }

        return $address;
    }

    public function getStatusLabelAttribute(): string
    {
        return self::STATUSES[$this->status] ?? $this->status;
    }
}
