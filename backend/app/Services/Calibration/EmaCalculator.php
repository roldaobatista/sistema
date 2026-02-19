<?php

namespace App\Services\Calibration;

/**
 * Calculates Maximum Permissible Errors (EMA) per Portaria INMETRO nº 157/2022
 * and OIML R76-1:2006.
 *
 * EMA table by accuracy class and load range (in multiples of "e").
 * Verification types: initial/subsequent use ×1, in_use (supervision) uses ×2.
 */
class EmaCalculator
{
    /**
     * EMA thresholds per class.
     * Each entry: [max_multiples_of_e, ema_multiples_of_e]
     * The last entry uses PHP_FLOAT_MAX as upper bound (unbounded).
     */
    private const EMA_TABLE = [
        'I' => [
            [50000,  0.5],
            [200000, 1.0],
            [PHP_FLOAT_MAX, 1.5],
        ],
        'II' => [
            [5000,   0.5],
            [20000,  1.0],
            [100000, 1.5],
        ],
        'III' => [
            [500,  0.5],
            [2000, 1.0],
            [10000, 1.5],
        ],
        'IIII' => [
            [50,  0.5],
            [200, 1.0],
            [1000, 1.5],
        ],
    ];

    /**
     * Calculate the Maximum Permissible Error for a given measurement point.
     *
     * @param string $class          Accuracy class: I, II, III, or IIII
     * @param float  $eValue         Verification division value "e" (same unit as loadValue)
     * @param float  $loadValue      The load/mass being measured (same unit as eValue)
     * @param string $verificationType initial|subsequent|in_use
     * @return float EMA in the same unit as eValue/loadValue (absolute value, ±)
     */
    public static function calculate(
        string $class,
        float $eValue,
        float $loadValue,
        string $verificationType = 'initial'
    ): float {
        $class = strtoupper(trim($class));
        if (!isset(self::EMA_TABLE[$class])) {
            throw new \InvalidArgumentException("Unknown accuracy class: {$class}. Valid: I, II, III, IIII");
        }

        if ($eValue <= 0) {
            throw new \InvalidArgumentException("Verification division 'e' must be > 0, got: {$eValue}");
        }

        $multiplesOfE = $loadValue / $eValue;
        $emaMultiple = self::findEmaMultiple($class, $multiplesOfE);

        $ema = $emaMultiple * $eValue;

        // Portaria 157/2022: in-use (supervision) EMAs are 2× the initial/subsequent
        if ($verificationType === 'in_use') {
            $ema *= 2;
        }

        return round($ema, 6);
    }

    /**
     * Calculate EMAs for multiple measurement points at once.
     *
     * @return array<int, array{load: float, ema: float, multiples_of_e: float}>
     */
    public static function calculateForPoints(
        string $class,
        float $eValue,
        array $loadValues,
        string $verificationType = 'initial'
    ): array {
        return array_map(fn(float $load) => [
            'load' => $load,
            'ema' => self::calculate($class, $eValue, $load, $verificationType),
            'multiples_of_e' => $eValue > 0 ? round($load / $eValue, 2) : 0,
        ], $loadValues);
    }

    /**
     * Suggest measurement points based on equipment capacity.
     * Returns 5 points at 0%, 25%, 50%, 75%, 100% of capacity.
     *
     * @return array<int, array{load: float, percentage: int, ema: float}>
     */
    public static function suggestPoints(
        string $class,
        float $eValue,
        float $maxCapacity,
        string $verificationType = 'initial'
    ): array {
        $percentages = [0, 25, 50, 75, 100];
        $points = [];

        foreach ($percentages as $pct) {
            $load = round(($maxCapacity * $pct) / 100, 4);
            $points[] = [
                'load' => $load,
                'percentage' => $pct,
                'ema' => $pct === 0 ? 0.0 : self::calculate($class, $eValue, $load, $verificationType),
                'multiples_of_e' => $eValue > 0 ? round($load / $eValue, 2) : 0,
            ];
        }

        return $points;
    }

    /**
     * Suggest eccentricity test load (≈ 1/3 of max capacity).
     */
    public static function suggestEccentricityLoad(float $maxCapacity): float
    {
        return round($maxCapacity / 3, 4);
    }

    /**
     * Suggest repeatability test load (≈ 50-66% of max capacity).
     */
    public static function suggestRepeatabilityLoad(float $maxCapacity): float
    {
        return round($maxCapacity * 0.5, 4);
    }

    /**
     * Check if a given error is within the EMA (conforming).
     */
    public static function isConforming(float $error, float $ema): bool
    {
        return abs($error) <= abs($ema);
    }

    /**
     * Get available accuracy classes.
     *
     * @return string[]
     */
    public static function availableClasses(): array
    {
        return array_keys(self::EMA_TABLE);
    }

    private static function findEmaMultiple(string $class, float $multiplesOfE): float
    {
        foreach (self::EMA_TABLE[$class] as [$threshold, $emaMultiple]) {
            if ($multiplesOfE <= $threshold) {
                return $emaMultiple;
            }
        }
        // Should not reach here due to PHP_FLOAT_MAX, but safety fallback
        return 1.5;
    }
}
