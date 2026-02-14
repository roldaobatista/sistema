<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Rma extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'reference', 'customer_id', 'product_id',
        'serial_number', 'reason', 'status', 'resolution',
        'received_at', 'resolved_at', 'notes',
    ];

    protected $casts = [
        'received_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
