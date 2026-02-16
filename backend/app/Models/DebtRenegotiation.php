<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DebtRenegotiation extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'customer_id', 'original_total', 'negotiated_total',
        'discount_amount', 'interest_amount', 'fine_amount',
        'new_installments', 'first_due_date', 'notes', 'status',
        'created_by', 'approved_by', 'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'original_total' => 'decimal:2',
            'negotiated_total' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'interest_amount' => 'decimal:2',
            'fine_amount' => 'decimal:2',
            'first_due_date' => 'date',
            'approved_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }

    public function items(): HasMany
    {
        return $this->hasMany(DebtRenegotiationItem::class);
    }
}
