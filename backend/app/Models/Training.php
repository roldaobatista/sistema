<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class Training extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'title', 'institution', 'certificate_number',
        'completion_date', 'expiry_date', 'category', 'hours', 'status', 'notes',
        'is_mandatory', 'skill_area', 'level', 'cost', 'instructor',
    ];

    protected $casts = [
        'completion_date' => 'date',
        'expiry_date' => 'date',
        'hours' => 'integer',
        'is_mandatory' => 'boolean',
        'cost' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->expiry_date && $this->expiry_date->isPast();
    }
}
