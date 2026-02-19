<?php

namespace App\Services\Calibration;

use App\Models\Equipment;
use App\Models\EquipmentCalibration;
use App\Models\RepeatabilityTest;

/**
 * Orchestrates the calibration wizard flow:
 * - Pre-fill from previous calibration (memory)
 * - Suggest measurement points
 * - Calculate repeatability statistics
 * - Calculate expanded uncertainty
 * - Validate ISO 17025 completeness
 */
class CalibrationWizardService
{
    /**
     * Pre-fill data from the most recent calibration of the same equipment.
     * Returns ~90% of the data needed, leaving only new readings for the technician.
     */
    public function prefillFromPrevious(Equipment $equipment): ?array
    {
        $lastCalibration = EquipmentCalibration::where('equipment_id', $equipment->id)
            ->whereNotNull('certificate_number')
            ->orderByDesc('calibration_date')
            ->with(['readings', 'excentricityTests', 'standardWeights', 'repeatabilityTests'])
            ->first();

        if (!$lastCalibration) {
            return null;
        }

        return [
            'prefilled_from_id' => $lastCalibration->id,
            'prefilled_from_date' => $lastCalibration->calibration_date?->format('Y-m-d'),
            'prefilled_from_certificate' => $lastCalibration->certificate_number,

            // Environmental conditions (likely similar)
            'temperature' => $lastCalibration->temperature,
            'humidity' => $lastCalibration->humidity,
            'pressure' => $lastCalibration->pressure,

            // Location & method
            'calibration_location' => $lastCalibration->calibration_location,
            'calibration_location_type' => $lastCalibration->calibration_location_type,
            'calibration_method' => $lastCalibration->calibration_method,
            'calibration_type' => $lastCalibration->calibration_type,
            'laboratory' => $lastCalibration->laboratory,
            'mass_unit' => $lastCalibration->mass_unit ?? 'kg',
            'verification_type' => $lastCalibration->verification_type,
            'verification_division_e' => $lastCalibration->verification_division_e,

            // Standard weights used (IDs for re-selection)
            'standard_weight_ids' => $lastCalibration->standardWeights->pluck('id')->toArray(),
            'standard_weights' => $lastCalibration->standardWeights->map(fn($w) => [
                'id' => $w->id,
                'code' => $w->code,
                'nominal_value' => $w->nominal_value,
                'unit' => $w->unit,
                'precision_class' => $w->precision_class,
                'certificate_number' => $w->certificate_number,
                'certificate_expiry' => $w->certificate_expiry?->format('Y-m-d'),
            ])->toArray(),

            // Measurement points structure (without values — only reference points)
            'reading_points' => $lastCalibration->readings
                ->unique('reference_value')
                ->sortBy('reading_order')
                ->map(fn($r) => [
                    'reference_value' => (float) $r->reference_value,
                    'unit' => $r->unit,
                    'k_factor' => (float) $r->k_factor,
                ])->values()->toArray(),

            // Eccentricity config (positions used, not values)
            'eccentricity_load' => $lastCalibration->excentricityTests->first()?->applied_load,
            'eccentricity_positions' => $lastCalibration->excentricityTests
                ->pluck('position_label')->toArray(),

            // Repeatability config
            'repeatability_load' => $lastCalibration->repeatabilityTests->first()?->load_value,
            'repeatability_count' => $lastCalibration->repeatabilityTests->first()
                ? count($lastCalibration->repeatabilityTests->first()->getMeasurements())
                : 5,
        ];
    }

    /**
     * Suggest measurement points based on equipment characteristics.
     */
    public function suggestMeasurementPoints(Equipment $equipment): array
    {
        $capacity = (float) ($equipment->capacity ?? 0);
        $eValue = (float) ($equipment->resolution ?? $equipment->division ?? 0);
        $class = $equipment->precision_class ?? 'III';

        if ($capacity <= 0 || $eValue <= 0) {
            return [];
        }

        return EmaCalculator::suggestPoints($class, $eValue, $capacity);
    }

    /**
     * Calculate repeatability statistics from raw measurements.
     *
     * @return array{mean: float, std_deviation: float, uncertainty_type_a: float, n: int}
     */
    public function calculateRepeatability(array $measurements): array
    {
        $values = array_filter($measurements, fn($v) => $v !== null && $v !== '');
        $values = array_map('floatval', array_values($values));
        $n = count($values);

        if ($n < 2) {
            return [
                'mean' => $n === 1 ? $values[0] : null,
                'std_deviation' => null,
                'uncertainty_type_a' => null,
                'n' => $n,
            ];
        }

        $mean = array_sum($values) / $n;
        $sumSqDiffs = array_reduce(
            $values,
            fn(float $carry, float $v) => $carry + ($v - $mean) ** 2,
            0.0
        );
        $stdDev = sqrt($sumSqDiffs / ($n - 1));
        $uncertaintyA = $stdDev / sqrt($n);

        return [
            'mean' => round($mean, 4),
            'std_deviation' => round($stdDev, 6),
            'uncertainty_type_a' => round($uncertaintyA, 6),
            'n' => $n,
        ];
    }

    /**
     * Calculate expanded uncertainty U = k × u_combined.
     *
     * @param float $uncertaintyA  Type A uncertainty (from repeatability)
     * @param float $resolution    Equipment resolution (contributes to type B)
     * @param float $weightUncertainty Uncertainty from standard weights
     * @param float $k Coverage factor (default 2 for ~95.45%)
     */
    public function calculateExpandedUncertainty(
        float $uncertaintyA,
        float $resolution,
        float $weightUncertainty = 0,
        float $k = 2.0
    ): array {
        // Type B from resolution: u_B = resolution / (2√3)
        $uncertaintyBResolution = $resolution / (2 * sqrt(3));

        // Combined standard uncertainty
        $uCombined = sqrt(
            $uncertaintyA ** 2
            + $uncertaintyBResolution ** 2
            + $weightUncertainty ** 2
        );

        $expanded = $k * $uCombined;

        return [
            'uncertainty_type_a' => round($uncertaintyA, 6),
            'uncertainty_type_b_resolution' => round($uncertaintyBResolution, 6),
            'uncertainty_weight' => round($weightUncertainty, 6),
            'combined_uncertainty' => round($uCombined, 6),
            'k_factor' => $k,
            'expanded_uncertainty' => round($expanded, 6),
        ];
    }

    /**
     * Validate that a calibration has all 16 fields required by ISO 17025:2017 §7.8.
     *
     * @return array{valid: bool, missing: string[], filled: string[]}
     */
    public function validateIso17025(EquipmentCalibration $calibration): array
    {
        $calibration->loadMissing(['equipment.customer', 'readings', 'performer', 'approver']);

        $checks = [
            'title' => true, // Always "Certificado de Calibração"
            'laboratory_name' => !empty($calibration->laboratory),
            'calibration_location' => !empty($calibration->calibration_location) || !empty($calibration->calibration_location_type),
            'certificate_number' => !empty($calibration->certificate_number),
            'client_name' => !empty($calibration->equipment?->customer?->name),
            'calibration_method' => !empty($calibration->calibration_method),
            'item_identification' => !empty($calibration->equipment?->serial_number) || !empty($calibration->equipment?->code),
            'calibration_date' => !empty($calibration->calibration_date),
            'scope_declaration' => true, // Hardcoded in template
            'measurement_results' => $calibration->readings->count() > 0,
            'authorizer_signature' => !empty($calibration->performed_by),
            'measurement_uncertainty' => $calibration->readings->whereNotNull('expanded_uncertainty')->count() > 0,
            'environmental_conditions' => !empty($calibration->temperature) || !empty($calibration->humidity),
            'traceability_declaration' => true, // Hardcoded in template
            'before_after_adjustment' => true, // Optional per ISO — only required if adjustment was made
            'conformity_declaration' => !empty($calibration->conformity_declaration) || $calibration->max_permissible_error !== null,
        ];

        $missing = array_keys(array_filter($checks, fn(bool $v) => !$v));
        $filled = array_keys(array_filter($checks, fn(bool $v) => $v));

        return [
            'valid' => empty($missing),
            'total' => count($checks),
            'filled_count' => count($filled),
            'missing' => $missing,
            'filled' => $filled,
        ];
    }
}
