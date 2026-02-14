<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;

class CollectionRule extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'is_active', 'steps',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'steps' => 'array',
    ];

    public function actions(): HasMany
    {
        return $this->hasMany(CollectionAction::class);
    }
}
