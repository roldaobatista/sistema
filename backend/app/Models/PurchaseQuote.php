<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseQuote extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'reference', 'title', 'notes', 'status',
        'deadline', 'approved_supplier_id', 'created_by',
    ];

    protected $casts = [
        'deadline' => 'date',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseQuoteItem::class);
    }

    public function suppliers(): HasMany
    {
        return $this->hasMany(PurchaseQuoteSupplier::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
