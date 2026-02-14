<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Check extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'bank_name', 'check_number', 'amount',
        'issue_date', 'due_date', 'type', 'status',
        'customer_id', 'supplier_id', 'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'issue_date' => 'date',
        'due_date' => 'date',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
