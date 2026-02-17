<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierContract extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'supplier_id', 'title', 'description',
        'value', 'start_date', 'end_date', 'status',
        'auto_renew', 'payment_frequency', 'alert_days_before',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
        'auto_renew' => 'boolean',
        'alert_days_before' => 'integer',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }
}
