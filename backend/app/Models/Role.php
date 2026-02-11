<?php

namespace App\Models;

use Spatie\Permission\Models\Role as SpatieRole;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Role extends SpatieRole
{
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'name',
        'guard_name',
        'tenant_id',
    ];

    /**
     * Get the tenant that owns the role.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Override Spatie create to bypass simple name+guard uniqueness check.
     * We rely on database unique constraint (name, guard, tenant_id).
     */
    public static function create(array $attributes = [])
    {
        // Garante guard_name
        $attributes['guard_name'] = $attributes['guard_name'] ?? \Spatie\Permission\Guard::getDefaultName(static::class);

        return static::query()->create($attributes);
    }
}
