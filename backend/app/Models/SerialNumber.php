<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SerialNumber extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'product_id', 'serial', 'batch_number',
        'status', 'location', 'notes',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
