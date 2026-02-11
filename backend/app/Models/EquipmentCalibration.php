<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class EquipmentCalibration extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'equipment_id', 'calibration_date', 'next_due_date',
        'calibration_type', 'result', 'laboratory', 'certificate_number',
        'certificate_file', 'certificate_pdf_path', 'standard_used',
        'error_found', 'uncertainty', 'errors_found', 'technician_notes',
        'temperature', 'humidity', 'pressure',
        'corrections_applied', 'performed_by', 'approved_by',
        'cost', 'work_order_id', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'calibration_date' => 'date',
            'next_due_date' => 'date',
            'errors_found' => 'array',
            'error_found' => 'decimal:4',
            'uncertainty' => 'decimal:4',
            'temperature' => 'decimal:2',
            'humidity' => 'decimal:2',
            'pressure' => 'decimal:2',
            'cost' => 'decimal:2',
        ];
    }

    public function equipment(): BelongsTo { return $this->belongsTo(Equipment::class); }
    public function performer(): BelongsTo { return $this->belongsTo(User::class, 'performed_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
    public function workOrder(): BelongsTo { return $this->belongsTo(WorkOrder::class); }
}
