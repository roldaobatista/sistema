<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
        'cost', 'work_order_id', 'notes', 'eccentricity_data',
        'certificate_template_id', 'conformity_declaration',
        'max_permissible_error', 'max_error_found', 'mass_unit', 'calibration_method',
        // Wizard / ISO 17025 fields
        'received_date', 'issued_date', 'calibration_location',
        'calibration_location_type', 'before_adjustment_data', 'after_adjustment_data',
        'verification_type', 'verification_division_e', 'prefilled_from_id',
    ];

    protected function casts(): array
    {
        return [
            'calibration_date' => 'date',
            'next_due_date' => 'date',
            'received_date' => 'date',
            'issued_date' => 'date',
            'errors_found' => 'array',
            'error_found' => 'decimal:4',
            'uncertainty' => 'decimal:4',
            'temperature' => 'decimal:2',
            'humidity' => 'decimal:2',
            'pressure' => 'decimal:2',
            'cost' => 'decimal:2',
            'eccentricity_data' => 'array',
            'before_adjustment_data' => 'array',
            'after_adjustment_data' => 'array',
            'verification_division_e' => 'decimal:6',
        ];
    }

    public function equipment(): BelongsTo { return $this->belongsTo(Equipment::class); }
    public function performer(): BelongsTo { return $this->belongsTo(User::class, 'performed_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
    public function workOrder(): BelongsTo { return $this->belongsTo(WorkOrder::class); }

    public function standardWeights(): BelongsToMany
    {
        return $this->belongsToMany(
            StandardWeight::class,
            'calibration_standard_weight',
            'equipment_calibration_id',
            'standard_weight_id'
        )->withTimestamps();
    }

    public function readings(): HasMany
    {
        return $this->hasMany(CalibrationReading::class);
    }

    public function excentricityTests(): HasMany
    {
        return $this->hasMany(ExcentricityTest::class);
    }

    public function repeatabilityTests(): HasMany
    {
        return $this->hasMany(RepeatabilityTest::class);
    }

    public function prefilledFrom(): BelongsTo
    {
        return $this->belongsTo(self::class, 'prefilled_from_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(CertificateTemplate::class, 'certificate_template_id');
    }
}
