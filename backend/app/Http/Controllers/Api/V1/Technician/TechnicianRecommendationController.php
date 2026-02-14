<?php

namespace App\Http\Controllers\Api\V1\Technician;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Models\User;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class TechnicianRecommendationController extends Controller
{
    private const WEIGHT_AVAILABILITY = 100;
    private const WEIGHT_SKILL_MATCH = 10;
    private const WEIGHT_PROXIMITY_CITY = 20;

    public function recommend(Request $request)
    {
        $tenantId = (int) ($request->user()->current_tenant_id ?? $request->user()->tenant_id);
        
        $validated = $request->validate([
            'service_id' => 'nullable|exists:services,id',
            'start' => 'required|date',
            'end' => 'required|date|after:start',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
        ]);

        $service = null;
        if (!empty($validated['service_id'])) {
            $service = Service::with('skills')->find($validated['service_id']);
        }
        
        $start = $validated['start'];
        $end = $validated['end'];

        // 1. Get all active technicians for this tenant
        $technicians = User::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->with(['skills', 'tenants'])
            // Filter by role/position if needed (skipping for now based on generic User model)
            ->get();

        // 2. Calculate score for each technician
        $recommendations = $technicians->map(function ($tech) use ($service, $start, $end, $tenantId) {
            $score = 0;
            $details = [];

            // A. Availability Check
            $hasConflict = Schedule::hasConflict($tech->id, $start, $end, null, $tenantId);
            if (!$hasConflict) {
                $score += self::WEIGHT_AVAILABILITY;
                $details['availability'] = self::WEIGHT_AVAILABILITY;
            } else {
                $details['conflict'] = true;
                return [
                    'id' => $tech->id,
                    'name' => $tech->name,
                    'score' => -100, // Penalize heavily
                    'details' => $details
                ];
            }

            // B. Skills Match (Only if service is provided)
            $skillScore = 0;
            if ($service && $service->skills->isNotEmpty()) {
                foreach ($service->skills as $requiredSkill) {
                    $techSkill = $tech->skills->firstWhere('skill_id', $requiredSkill->id);
                    if ($techSkill) {
                        // Points for having the skill + bonus for level
                        // E.g. Level 3 required, Tech has 4 -> (4/3) * 10
                        $levelFactor = $techSkill->current_level / max(1, $requiredSkill->pivot->required_level);
                        $skillScore += $levelFactor * self::WEIGHT_SKILL_MATCH;
                    }
                }
                $details['skill_match'] = round($skillScore, 2);
            }
            $score += $skillScore;

            // C. Proximity (Simplified: Same City check if address present)
            // Ideally use Haversine formula if lat/lng available on tech's last location
            // For MVP: Check if tech has schedules nearby in the same day (not implemented here) or home base.
            
            return [
                'id' => $tech->id,
                'name' => $tech->name,
                'score' => round($score, 2),
                'score_details' => $details,
            ];
        });

        // 3. Sort by score descending
        $sorted = $recommendations->sortByDesc('score')->values();

        return response()->json([
            'data' => $sorted
        ]);
    }
}
