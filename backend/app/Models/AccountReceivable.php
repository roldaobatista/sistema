<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class AccountReceivable extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $table = 'accounts_receivable';

    protected $fillable = [
        'tenant_id', 'customer_id', 'work_order_id', 'created_by',
        'description', 'amount', 'amount_paid', 'due_date', 'paid_at',
        'status', 'payment_method', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'due_date' => 'date',
            'paid_at' => 'date',
        ];
    }

    public const STATUS_PENDING = 'pending';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_PAID = 'paid';
    public const STATUS_OVERDUE = 'overdue';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_PENDING => ['label' => 'Pendente', 'color' => 'warning'],
        self::STATUS_PARTIAL => ['label' => 'Parcial', 'color' => 'info'],
        self::STATUS_PAID => ['label' => 'Pago', 'color' => 'success'],
        self::STATUS_OVERDUE => ['label' => 'Vencido', 'color' => 'danger'],
        self::STATUS_CANCELLED => ['label' => 'Cancelado', 'color' => 'default'],
    ];

    public const PAYMENT_METHODS = [
        'dinheiro' => 'Dinheiro',
        'pix' => 'PIX',
        'cartao_credito' => 'Cartão Crédito',
        'cartao_debito' => 'Cartão Débito',
        'boleto' => 'Boleto',
        'transferencia' => 'Transferência',
    ];

    public function recalculateStatus(): void
    {
        if ($this->amount_paid >= $this->amount) {
            $this->update(['status' => self::STATUS_PAID, 'paid_at' => now()]);
        } elseif ($this->amount_paid > 0) {
            $this->update(['status' => self::STATUS_PARTIAL]);
        } elseif ($this->due_date && $this->due_date->isPast() && in_array($this->status, [self::STATUS_PENDING, self::STATUS_PARTIAL])) {
            $this->update(['status' => self::STATUS_OVERDUE]);
        }
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }
}
