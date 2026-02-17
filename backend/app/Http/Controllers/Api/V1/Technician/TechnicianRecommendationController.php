<?php

namespace App\Http\Controllers\Api\V1\Technician;

use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Models\User;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class TechnicianRecommendationController extends Controller
{
    use ResolvesCurrentTenant;

    private const WEIGHT_AVAILABILITY = 100;
    private const WEIGHT_SKILL_MATCH = 10;
    private const WEIGHT_PROXIMITY_CITY = 20;

    public function recommend(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();

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

            $technicians = User::where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->with(['skills', 'tenants'])
                ->get();

            $recommendations = $technicians->map(function ($tech) use ($service, $start, $end, $tenantId) {
                $score = 0;
                $details = [];

                $hasConflict = Schedule::hasConflict($tech->id, $start, $end, null, $tenantId);
                if (!$hasConflict) {
                    $score += self::WEIGHT_AVAILABILITY;
                    $details['availability'] = self::WEIGHT_AVAILABILITY;
                } else {
                    $details['conflict'] = true;
                    return [
                        'id' => $tech->id,
                        'name' => $tech->name,
                        'score' => -100,
                        'details' => $details
                    ];
                }

                $skillScore = 0;
                if ($service && $service->skills->isNotEmpty()) {
                    foreach ($service->skills as $requiredSkill) {
                        $techSkill = $tech->skills->firstWhere('skill_id', $requiredSkill->id);
                        if ($techSkill) {
                            $levelFactor = $techSkill->current_level / max(1, $requiredSkill->pivot->required_level);
                            $skillScore += $levelFactor * self::WEIGHT_SKILL_MATCH;
                        }
                    }
                    $details['skill_match'] = round($skillScore, 2);
                }
                $score += $skillScore;

                return [
                    'id' => $tech->id,
                    'name' => $tech->name,
                    'score' => round($score, 2),
                    'score_details' => $details,
                ];
            });

            $sorted = $recommendations->sortByDesc('score')->values();

            return response()->json(['data' => $sorted]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('TechnicianRecommendation recommend failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao recomendar técnicos'], 500);
        }
    }
}
