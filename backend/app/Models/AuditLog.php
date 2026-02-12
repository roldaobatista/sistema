<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AuditLog extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'user_id', 'action', 'auditable_type', 'auditable_id',
        'description', 'old_values', 'new_values', 'ip_address', 'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public const ACTIONS = [
        'created' => 'Criado',
        'updated' => 'Atualizado',
        'deleted' => 'Excluído',
        'login' => 'Login',
        'logout' => 'Logout',
        'status_changed' => 'Status Alterado',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    public static function log(string $action, string $description, ?Model $model = null, ?array $old = null, ?array $new = null): static
    {
        return static::create([
            'tenant_id' => self::resolveTenantId($model),
            'user_id' => auth()->id(),
            'action' => $action,
            'auditable_type' => $model ? get_class($model) : null,
            'auditable_id' => $model?->getKey(),
            'description' => $description,
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    private static function resolveTenantId(?Model $model): ?int
    {
        if ($model && array_key_exists('tenant_id', $model->getAttributes())) {
            $tenantId = (int) $model->getAttribute('tenant_id');
            if ($tenantId > 0) {
                return $tenantId;
            }
        }

        // Tenant events should be attributed to the tenant being changed.
        if ($model instanceof Tenant) {
            return (int) $model->getKey();
        }

        if (app()->bound('current_tenant_id')) {
            return (int) app('current_tenant_id');
        }

        $user = auth()->user();
        if ($user) {
            $tenantId = (int) ($user->current_tenant_id ?? $user->tenant_id ?? 0);
            if ($tenantId > 0) {
                return $tenantId;
            }
        }

        return null;
    }
}
