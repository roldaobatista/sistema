<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;

class CustomerComplaint extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'customer_id', 'work_order_id', 'equipment_id',
        'description', 'category', 'severity', 'status', 'resolution',
        'assigned_to', 'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'date',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class, 'equipment_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function correctiveActions(): HasMany
    {
        return $this->hasMany(CorrectiveAction::class, 'sourceable_id')
            ->where('sourceable_type', self::class);
    }
}
