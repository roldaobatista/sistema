<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkOrderSignature extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'work_order_id',
        'signer_name',
        'signer_document',
        'signer_type',
        'signature_data',
        'signed_at',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
    ];

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
