<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExpenseStatusHistory extends Model
{
    protected $table = 'expense_status_history';

    protected $fillable = [
        'expense_id',
        'changed_by',
        'from_status',
        'to_status',
        'reason',
    ];

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
