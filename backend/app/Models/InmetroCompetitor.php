<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class InmetroCompetitor extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'cnpj', 'authorization_number',
        'phone', 'email', 'address', 'city', 'state',
        'authorized_species', 'mechanics',
    ];

    protected function casts(): array
    {
        return [
            'authorized_species' => 'array',
            'mechanics' => 'array',
        ];
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
