<?php

namespace App\Services\Metrology;

use App\Models\StandardWeight;
use App\Models\CalibrationReading;
use Carbon\Carbon;

class WeightWearPredictorService
{
    /**
     * Calculates and updates the wear rate and expected failure date for a standard weight.
     * This predicts when the weight will fall out of its allowed tolerance (MPE).
     */
    public function updateWearPrediction(StandardWeight $weight): void
    {
        // 1. Get historical readings for this weight (used as standard)
        // For simplicity in this POC, we'll assume there's a relationship to readings
        // or calibration events where this weight's mass value was verified.
        // In a real LIMS, this comes from the weight's own calibration certificates over time.
        
        // Mocking historical mass verifications for the demonstration logic
        // Let's assume the weight has a nominal mass of $weight->nominal_mass
        // and its mass has been slowly decreasing due to wear.
        
        $nominal = $weight->nominal_mass;
        $mpe = $this->getMaximumPermissibleError($weight); // Maximum Permissible Error (Tolerance)
        
        // If we don't have enough data, we can't predict
        // In actual implementation, fetch from $weight->calibrationHistories()
        $historicalVerifications = [
            ['date' => Carbon::now()->subMonths(24), 'measured_mass' => $nominal],
            ['date' => Carbon::now()->subMonths(12), 'measured_mass' => $nominal - ($mpe * 0.20)],
            ['date' => Carbon::now(), 'measured_mass' => $nominal - ($mpe * 0.45)],
        ];

        if (count($historicalVerifications) < 2) {
            return;
        }

        // 2. Calculate average wear rate (mass loss per day)
        $first = $historicalVerifications[0];
        $latest = end($historicalVerifications);
        
        $daysPassed = $first['date']->diffInDays($latest['date']);
        if ($daysPassed <= 0) return;

        $massLoss = $first['measured_mass'] - $latest['measured_mass'];
        $dailyWearRate = $massLoss / $daysPassed;

        // 3. Calculate wear percentage (how much of the MPE has been consumed)
        $currentError = $nominal - $latest['measured_mass'];
        $wearPercentage = ($currentError / $mpe) * 100;

        // 4. Predict expected failure date (when mass loss > MPE)
        $remainingTolerance = $mpe - $currentError;
        $expectedFailureDate = null;
        
        if ($dailyWearRate > 0) {
            $daysToFailure = $remainingTolerance / $dailyWearRate;
            $expectedFailureDate = Carbon::now()->addDays((int) $daysToFailure);
        }

        // 5. Update the metrics on the weight record
        $weight->update([
            'wear_rate_percentage' => round($wearPercentage, 2),
            'expected_failure_date' => $expectedFailureDate ? $expectedFailureDate->toDateString() : null,
        ]);
    }

    /**
     * Helper to get Maximum Permissible Error (MPE) based on OIML class
     * Simplified mock lookup for demonstration
     */
    private function getMaximumPermissibleError(StandardWeight $weight): float
    {
        // e.g. OIML class F1, 20kg -> MPE = 100mg = 0.0001kg
        // This should hit a lookup table in a real system based on OIML R 111-1
        // Returning a mock tolerance of 0.005% of nominal mass
        return $weight->nominal_mass * 0.00005; 
    }
}
