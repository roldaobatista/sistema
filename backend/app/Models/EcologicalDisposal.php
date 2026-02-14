<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class EcologicalDisposal extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'product_id', 'quantity', 'disposal_method',
        'certificate_number', 'disposal_company', 'status',
        'disposed_at', 'notes', 'created_by',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'disposed_at' => 'datetime',
    ];
}
