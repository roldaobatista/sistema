<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class AccountPayable extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $table = 'accounts_payable';

    protected $fillable = [
        'tenant_id', 'created_by', 'supplier_id', 'supplier', 'category', 'category_id',
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

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }
}
