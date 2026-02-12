<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use App\Traits\SyncsWithCentral;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class AccountPayable extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable, SyncsWithCentral;

    protected $table = 'accounts_payable';

    protected $fillable = [
        'tenant_id', 'created_by', 'supplier_id', 'category_id',
        'chart_of_account_id',
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

    public const CATEGORIES = [
        'fornecedor' => 'Fornecedor',
        'aluguel' => 'Aluguel',
        'salario' => 'Salário',
        'imposto' => 'Imposto',
        'servico' => 'Serviço',
        'manutencao' => 'Manutenção',
        'outros' => 'Outros',
    ];

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

    public function recalculateStatus(): void
    {
        $amount = (float) $this->amount;
        $amountPaid = (float) $this->amount_paid;
        $remaining = round($amount - $amountPaid, 2);

        if ($remaining <= 0) {
            $status = self::STATUS_PAID;
            $paidAt = $this->paid_at ?? now();
        } elseif ($this->due_date && $this->due_date->isPast()) {
            $status = self::STATUS_OVERDUE;
            $paidAt = null;
        } elseif ($amountPaid > 0) {
            $status = self::STATUS_PARTIAL;
            $paidAt = null;
        } else {
            $status = self::STATUS_PENDING;
            $paidAt = null;
        }

        $hasChanged = $this->status !== $status
            || (($this->paid_at?->toDateString()) !== ($paidAt?->toDateString()));

        if ($hasChanged) {
            $this->forceFill([
                'status' => $status,
                'paid_at' => $paidAt,
            ])->saveQuietly();
        }
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function supplierRelation(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function categoryRelation(): BelongsTo
    {
        return $this->belongsTo(AccountPayableCategory::class, 'category_id');
    }

    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'chart_of_account_id');
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    public function centralSyncData(): array
    {
        $statusMap = [
            self::STATUS_PENDING => \App\Enums\CentralItemStatus::ABERTO,
            self::STATUS_PARTIAL => \App\Enums\CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_PAID => \App\Enums\CentralItemStatus::CONCLUIDO,
            self::STATUS_OVERDUE => \App\Enums\CentralItemStatus::ABERTO,
            self::STATUS_CANCELLED => \App\Enums\CentralItemStatus::CANCELADO,
        ];

        return [
            'status' => $statusMap[$this->status] ?? \App\Enums\CentralItemStatus::ABERTO,
        ];
    }
}
