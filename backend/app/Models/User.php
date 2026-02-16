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
use App\Models\Tenant;
use App\Models\Branch;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens, HasRoles, Auditable;

    protected $fillable = [
        'name',
        'email',
        'email_verified_at',
        'phone',
        'password',
        'is_active',
        'tenant_id',
        'branch_id',
        'current_tenant_id',
        'last_login_at',
        'location_lat',
        'location_lng',
        'location_updated_at',
        'status',
        'denied_permissions',
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
            'location_lat' => 'float',
            'location_lng' => 'float',
            'location_updated_at' => 'datetime',
            'denied_permissions' => 'array',
        ];
    }

    /**
     * Returns the list of explicitly denied permissions for this user.
     */
    public function getDeniedPermissionsList(): array
    {
        return $this->denied_permissions ?? [];
    }

    /**
     * Check if a specific permission is denied for this user.
     */
    public function isPermissionDenied(string $permission): bool
    {
        return in_array($permission, $this->getDeniedPermissionsList(), true);
    }

    /**
     * Get effective permissions: all granted minus denied.
     */
    public function getEffectivePermissions(): \Illuminate\Support\Collection
    {
        $denied = $this->getDeniedPermissionsList();

        return $this->getAllPermissions()
            ->filter(fn ($perm) => !in_array($perm->name, $denied, true));
    }

    // Relacionamentos
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function subordinates()
    {
        return $this->hasMany(User::class, 'manager_id');
    }

    public function skills()
    {
        return $this->hasMany(UserSkill::class);
    }

    public function performanceReviews()
    {
        return $this->hasMany(PerformanceReview::class, 'user_id'); // as reviewee
    }

    public function reviewsGiven()
    {
        return $this->hasMany(PerformanceReview::class, 'reviewer_id');
    }

    public function receivedFeedback()
    {
        return $this->hasMany(ContinuousFeedback::class, 'to_user_id');
    }

    public function sentFeedback()
    {
        return $this->hasMany(ContinuousFeedback::class, 'from_user_id');
    }

    public function timeClockEntries()
    {
        return $this->hasMany(TimeClockEntry::class);
    }

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

