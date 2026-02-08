<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Notification extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'type', 'title', 'message',
        'icon', 'color', 'link', 'notifiable_type', 'notifiable_id',
        'data', 'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    // ─── Scopes ──────────────

    public function scopeUnread($q)
    {
        return $q->whereNull('read_at');
    }

    // ─── Relationships ──────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function notifiable(): MorphTo
    {
        return $this->morphTo();
    }

    // ─── Factory Methods ──────────────

    public static function notify(int $tenantId, int $userId, string $type, string $title, array $opts = []): static
    {
        return static::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $opts['message'] ?? null,
            'icon' => $opts['icon'] ?? null,
            'color' => $opts['color'] ?? null,
            'link' => $opts['link'] ?? null,
            'notifiable_type' => $opts['notifiable_type'] ?? null,
            'notifiable_id' => $opts['notifiable_id'] ?? null,
            'data' => $opts['data'] ?? null,
        ]);
    }

    public static function calibrationDue(Equipment $eq, int $userId, int $daysRemaining): static
    {
        $overdue = $daysRemaining < 0;
        return static::notify(
            $eq->tenant_id,
            $userId,
            $overdue ? 'calibration_overdue' : 'calibration_due',
            $overdue
                ? "Calibração vencida: {$eq->code} ({$eq->brand} {$eq->model})"
                : "Calibração vencendo em {$daysRemaining}d: {$eq->code}",
            [
                'icon' => $overdue ? 'alert-triangle' : 'clock',
                'color' => $overdue ? 'red' : 'amber',
                'link' => "/equipamentos/{$eq->id}",
                'notifiable_type' => Equipment::class,
                'notifiable_id' => $eq->id,
                'data' => ['days_remaining' => $daysRemaining, 'equipment_code' => $eq->code],
            ]
        );
    }

    // ─── CRM Factory Methods ──────────────

    public static function crmDealCreated(CrmDeal $deal, int $userId): static
    {
        return static::notify(
            $deal->tenant_id,
            $userId,
            'crm_deal_created',
            "Novo deal: {$deal->title}",
            [
                'icon' => 'handshake',
                'color' => 'brand',
                'link' => "/crm/pipeline/{$deal->pipeline_id}",
                'notifiable_type' => CrmDeal::class,
                'notifiable_id' => $deal->id,
                'message' => "Deal criado para {$deal->customer?->name} — R$ " . number_format((float) $deal->value, 2, ',', '.'),
                'data' => ['deal_id' => $deal->id, 'customer_name' => $deal->customer?->name],
            ]
        );
    }

    public static function crmFollowUpDue(CrmActivity $activity, int $userId): static
    {
        return static::notify(
            $activity->tenant_id,
            $userId,
            'crm_follow_up_due',
            "Follow-up pendente: {$activity->title}",
            [
                'icon' => 'phone',
                'color' => 'amber',
                'link' => $activity->customer_id ? "/crm/clientes/{$activity->customer_id}" : null,
                'notifiable_type' => CrmActivity::class,
                'notifiable_id' => $activity->id,
                'message' => $activity->customer?->name
                    ? "Cliente: {$activity->customer->name}"
                    : null,
                'data' => [
                    'activity_id' => $activity->id,
                    'customer_id' => $activity->customer_id,
                    'scheduled_at' => $activity->scheduled_at?->toISOString(),
                ],
            ]
        );
    }

    public static function crmHealthAlert(Customer $customer, int $userId): static
    {
        return static::notify(
            $customer->tenant_id,
            $userId,
            'crm_health_alert',
            "Health Score crítico: {$customer->name} ({$customer->health_score}/100)",
            [
                'icon' => 'heart-pulse',
                'color' => 'red',
                'link' => "/crm/clientes/{$customer->id}",
                'notifiable_type' => Customer::class,
                'notifiable_id' => $customer->id,
                'message' => "Cliente com risco de churn — health score abaixo de 50",
                'data' => [
                    'customer_id' => $customer->id,
                    'health_score' => $customer->health_score,
                ],
            ]
        );
    }
}

