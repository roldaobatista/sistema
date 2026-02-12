<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InmetroLocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_id', 'state_registration', 'farm_name',
        'address_street', 'address_number', 'address_complement',
        'address_neighborhood', 'address_city', 'address_state', 'address_zip',
        'phone_local', 'email_local', 'latitude', 'longitude', 'distance_from_base_km',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'distance_from_base_km' => 'float',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(InmetroOwner::class, 'owner_id');
    }

    public function instruments(): HasMany
    {
        return $this->hasMany(InmetroInstrument::class, 'location_id');
    }

    public function getFullAddressAttribute(): string
    {
        return implode(', ', array_filter([
            $this->address_street,
            $this->address_number,
            $this->address_neighborhood,
            $this->address_city . '/' . $this->address_state,
        ]));
    }
}
