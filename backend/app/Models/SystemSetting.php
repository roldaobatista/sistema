<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'key', 'value', 'type', 'group'];

    public const GROUPS = [
        'general' => 'Geral',
        'os' => 'Ordens de Serviço',
        'quotes' => 'Orçamentos',
        'financial' => 'Financeiro',
        'notification' => 'Notificações',
        'whatsapp' => 'WhatsApp',
        'smtp' => 'E-mail / SMTP',
        'crm' => 'CRM',
    ];

    public function getTypedValue(): mixed
    {
        return match ($this->type) {
            'boolean' => filter_var($this->value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $this->value,
            'json' => json_decode($this->value, true),
            default => $this->value,
        };
    }

    public static function getValue(string $key, mixed $default = null): mixed
    {
        $setting = static::where('key', $key)->first();
        return $setting ? $setting->getTypedValue() : $default;
    }

    public static function setValue(string $key, mixed $value, string $type = 'string', string $group = 'general'): static
    {
        $tenantId = app()->bound('current_tenant_id')
            ? app('current_tenant_id')
            : (auth()->check() ? auth()->user()->current_tenant_id ?? auth()->user()->tenant_id : null);

        if (!$tenantId) {
            throw new \RuntimeException('Não é possível salvar configuração sem tenant_id definido.');
        }

        return static::updateOrCreate(
            ['key' => $key, 'tenant_id' => $tenantId],
            ['value' => is_array($value) ? json_encode($value) : (string) $value, 'type' => $type, 'group' => $group]
        );
    }
}
