<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use App\Models\Concerns\Auditable;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens, HasRoles, Auditable;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'is_active',
        'tenant_id',
        'branch_id',
        'current_tenant_id',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    // Relacionamentos
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'user_tenants')
            ->withPivot('is_default')
            ->withTimestamps();
    }

    public function currentTenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'current_tenant_id');
    }

    public function hasTenantAccess(int $tenantId): bool
    {
        if ($tenantId <= 0) {
            return false;
        }

        if ((int) $this->tenant_id === $tenantId || (int) $this->current_tenant_id === $tenantId) {
            return true;
        }

        return $this->tenants()->where('tenants.id', $tenantId)->exists();
    }

    public function switchTenant(Tenant|int $tenant): self
    {
        $tenantId = $tenant instanceof Tenant ? (int) $tenant->id : (int) $tenant;

        if ($tenantId <= 0 || !$this->hasTenantAccess($tenantId)) {
            throw (new ModelNotFoundException())->setModel(Tenant::class, [$tenantId]);
        }

        $this->forceFill(['current_tenant_id' => $tenantId])->save();

        return $this->refresh();
    }
}
