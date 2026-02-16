<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CalibrationReading extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'equipment_calibration_id', 'reference_value',
        'indication_increasing', 'indication_decreasing', 'error',
        'expanded_uncertainty', 'k_factor', 'correction',
        'reading_order', 'repetition', 'unit',
    ];

    protected function casts(): array
    {
        return [
            'reference_value' => 'decimal:4',
            'indication_increasing' => 'decimal:4',
            'indication_decreasing' => 'decimal:4',
            'error' => 'decimal:4',
            'expanded_uncertainty' => 'decimal:4',
            'k_factor' => 'decimal:2',
            'correction' => 'decimal:4',
        ];
    }

    public function calibration(): BelongsTo
    {
        return $this->belongsTo(EquipmentCalibration::class, 'equipment_calibration_id');
    }

    /**
     * Calcula o erro a partir da indicação e valor de referência.
     */
    public function calculateError(): void
    {
        if ($this->indication_increasing !== null) {
            $this->error = $this->indication_increasing - $this->reference_value;
        }
        $this->correction = $this->error ? -$this->error : null;
    }
}
