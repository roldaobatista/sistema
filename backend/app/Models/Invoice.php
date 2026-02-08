<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id', 'work_order_id', 'customer_id', 'created_by',
        'invoice_number', 'nf_number', 'status', 'total',
        'issued_at', 'due_date', 'observations', 'items',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
            'issued_at' => 'date',
            'due_date' => 'date',
            'items' => 'array',
        ];
    }

    public static function nextNumber(int $tenantId): string
    {
        $last = static::withTrashed()->where('tenant_id', $tenantId)->max('invoice_number');
        $seq = $last ? (int) str_replace('NF-', '', $last) + 1 : 1;
        return 'NF-' . str_pad($seq, 6, '0', STR_PAD_LEFT);
    }

    public function workOrder(): BelongsTo { return $this->belongsTo(WorkOrder::class); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
