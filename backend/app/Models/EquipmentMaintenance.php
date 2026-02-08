<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EquipmentMaintenance extends Model
{
    protected $fillable = [
        'equipment_id', 'type', 'description', 'parts_replaced',
        'cost', 'downtime_hours', 'performed_by', 'work_order_id',
        'next_maintenance_at',
    ];

    protected function casts(): array
    {
        return [
            'cost' => 'decimal:2',
            'downtime_hours' => 'decimal:2',
            'next_maintenance_at' => 'date',
        ];
    }

    public function equipment(): BelongsTo { return $this->belongsTo(Equipment::class); }
    public function performer(): BelongsTo { return $this->belongsTo(User::class, 'performed_by'); }
    public function workOrder(): BelongsTo { return $this->belongsTo(WorkOrder::class); }
}
