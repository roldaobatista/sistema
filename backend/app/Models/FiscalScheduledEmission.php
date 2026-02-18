<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FiscalScheduledEmission extends Model
{
    protected $fillable = [
        'tenant_id', 'type', 'work_order_id', 'quote_id', 'customer_id',
        'payload', 'scheduled_at', 'status', 'fiscal_note_id',
        'error_message', 'created_by',
    ];

    protected $casts = [
        'payload' => 'array',
        'scheduled_at' => 'datetime',
    ];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function customer() { return $this->belongsTo(Customer::class); }
    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function quote() { return $this->belongsTo(Quote::class); }
    public function fiscalNote() { return $this->belongsTo(FiscalNote::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }

    public function scopePending($q) { return $q->where('status', 'pending'); }
    public function scopeReady($q) { return $q->pending()->where('scheduled_at', '<=', now()); }
}
