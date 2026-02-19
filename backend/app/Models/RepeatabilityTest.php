<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepeatabilityTest extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'equipment_calibration_id', 'load_value', 'unit',
        'measurement_1', 'measurement_2', 'measurement_3', 'measurement_4',
        'measurement_5', 'measurement_6', 'measurement_7', 'measurement_8',
        'measurement_9', 'measurement_10',
        'mean', 'std_deviation', 'uncertainty_type_a',
    ];

    protected function casts(): array
    {
        return [
            'load_value' => 'decimal:4',
            'measurement_1' => 'decimal:4',
            'measurement_2' => 'decimal:4',
            'measurement_3' => 'decimal:4',
            'measurement_4' => 'decimal:4',
            'measurement_5' => 'decimal:4',
            'measurement_6' => 'decimal:4',
            'measurement_7' => 'decimal:4',
            'measurement_8' => 'decimal:4',
            'measurement_9' => 'decimal:4',
            'measurement_10' => 'decimal:4',
            'mean' => 'decimal:4',
            'std_deviation' => 'decimal:6',
            'uncertainty_type_a' => 'decimal:6',
        ];
    }

    public function calibration(): BelongsTo
    {
        return $this->belongsTo(EquipmentCalibration::class, 'equipment_calibration_id');
    }

    /**
     * Get all non-null measurements as an array of floats.
     */
    public function getMeasurements(): array
    {
        $values = [];
        for ($i = 1; $i <= 10; $i++) {
            $field = "measurement_{$i}";
            if ($this->{$field} !== null) {
                $values[] = (float) $this->{$field};
            }
        }
        return $values;
    }

    /**
     * Calculate mean, standard deviation, and type A uncertainty from measurements.
     */
    public function calculateStatistics(): void
    {
        $values = $this->getMeasurements();
        $n = count($values);

        if ($n < 2) {
            $this->mean = $n === 1 ? $values[0] : null;
            $this->std_deviation = null;
            $this->uncertainty_type_a = null;
            return;
        }

        $mean = array_sum($values) / $n;
        $this->mean = round($mean, 4);

        $sumSquaredDiffs = array_reduce(
            $values,
            fn(float $carry, float $v) => $carry + ($v - $mean) ** 2,
            0.0
        );
        $stdDev = sqrt($sumSquaredDiffs / ($n - 1));
        $this->std_deviation = round($stdDev, 6);

        // Type A uncertainty = s / √n
        $this->uncertainty_type_a = round($stdDev / sqrt($n), 6);
    }
}
