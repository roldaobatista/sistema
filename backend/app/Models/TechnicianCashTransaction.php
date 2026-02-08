<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TechnicianCashTransaction extends Model
{
    protected $fillable = [
        'fund_id', 'type', 'amount', 'balance_after',
        'expense_id', 'work_order_id', 'created_by',
        'description', 'transaction_date',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'balance_after' => 'decimal:2',
            'transaction_date' => 'date',
        ];
    }

    public function fund(): BelongsTo { return $this->belongsTo(TechnicianCashFund::class, 'fund_id'); }
    public function expense(): BelongsTo { return $this->belongsTo(Expense::class); }
    public function workOrder(): BelongsTo { return $this->belongsTo(WorkOrder::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
