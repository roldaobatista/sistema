<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EquipmentCalibration extends Model
{
    protected $fillable = [
        'equipment_id', 'calibration_date', 'next_due_date',
        'calibration_type', 'result', 'laboratory', 'certificate_number',
        'certificate_file', 'uncertainty', 'errors_found',
        'corrections_applied', 'performed_by', 'approved_by',
        'cost', 'work_order_id', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'calibration_date' => 'date',
            'next_due_date' => 'date',
            'errors_found' => 'array',
            'cost' => 'decimal:2',
        ];
    }

    public function equipment(): BelongsTo { return $this->belongsTo(Equipment::class); }
    public function performer(): BelongsTo { return $this->belongsTo(User::class, 'performed_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
    public function workOrder(): BelongsTo { return $this->belongsTo(WorkOrder::class); }
}
