<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FundTransfer extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable;

    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_COMPLETED => ['label' => 'Concluída', 'color' => 'success'],
        self::STATUS_CANCELLED => ['label' => 'Cancelada', 'color' => 'danger'],
    ];

    public const PAYMENT_METHODS = [
        'pix' => 'PIX',
        'ted' => 'TED',
        'doc' => 'DOC',
        'dinheiro' => 'Dinheiro',
        'transferencia' => 'Transferência',
    ];

    protected $fillable = [
        'tenant_id', 'bank_account_id', 'to_user_id', 'amount',
        'transfer_date', 'payment_method', 'description',
        'account_payable_id', 'technician_cash_transaction_id',
        'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'transfer_date' => 'date',
        ];
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function accountPayable(): BelongsTo
    {
        return $this->belongsTo(AccountPayable::class);
    }

    public function cashTransaction(): BelongsTo
    {
        return $this->belongsTo(TechnicianCashTransaction::class, 'technician_cash_transaction_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
