<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentReceipt extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'payment_id', 'receipt_number', 'pdf_path', 'generated_by',
    ];

    public function payment(): BelongsTo { return $this->belongsTo(Payment::class); }
    public function generator(): BelongsTo { return $this->belongsTo(User::class, 'generated_by'); }
}
