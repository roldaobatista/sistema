<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantSetting extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'key',
        'value_json',
    ];

    protected function casts(): array
    {
        return [
            'value_json' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public static function getValue(int $tenantId, string $key, mixed $default = null): mixed
    {
        $setting = static::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('key', $key)
            ->first();

        return $setting ? $setting->value_json : $default;
    }

    public static function setValue(int $tenantId, string $key, mixed $value): static
    {
        return static::withoutGlobalScope('tenant')->updateOrCreate(
            ['tenant_id' => $tenantId, 'key' => $key],
            ['value_json' => $value]
        );
    }
}
