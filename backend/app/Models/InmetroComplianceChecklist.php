<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InmetroComplianceChecklist extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'instrument_type', 'regulation_reference',
        'title', 'items', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForType($query, string $type)
    {
        return $query->where('instrument_type', $type);
    }
}
