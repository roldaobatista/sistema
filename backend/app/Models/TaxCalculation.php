<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class TaxCalculation extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'work_order_id', 'invoice_id',
        'tax_type', 'base_amount', 'rate', 'tax_amount',
        'regime', 'calculated_by',
    ];

    protected $casts = [
        'base_amount' => 'decimal:2',
        'rate' => 'decimal:4',
        'tax_amount' => 'decimal:2',
    ];
}
