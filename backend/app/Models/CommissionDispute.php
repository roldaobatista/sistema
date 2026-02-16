<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommissionDispute extends Model
{
    use BelongsToTenant, HasFactory, Auditable;

    protected $fillable = [
        'tenant_id', 'commission_event_id', 'user_id',
        'reason', 'status', 'resolution_notes',
        'resolved_by', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
        ];
    }

    public const STATUS_OPEN = 'open';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_OPEN => ['label' => 'Aberta', 'color' => 'warning'],
        self::STATUS_ACCEPTED => ['label' => 'Aceita', 'color' => 'success'],
        self::STATUS_REJECTED => ['label' => 'Rejeitada', 'color' => 'danger'],
    ];

    public function commissionEvent(): BelongsTo
    {
        return $this->belongsTo(CommissionEvent::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }
}
