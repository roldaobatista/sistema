<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseQuotation extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'reference', 'supplier_id', 'status',
        'total_amount', 'notes', 'valid_until',
        'requested_by', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'valid_until' => 'date',
        'approved_at' => 'datetime',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'supplier_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseQuotationItem::class);
    }
}
