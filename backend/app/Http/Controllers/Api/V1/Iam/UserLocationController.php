<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class UserLocationController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'latitude' => ['required', 'numeric', 'between:-90,90'],
                'longitude' => ['required', 'numeric', 'between:-180,180'],
            ]);

            $user = $request->user();

            $user->forceFill([
                'location_lat' => $validated['latitude'],
                'location_lng' => $validated['longitude'],
                'location_updated_at' => now(),
            ])->save();

            broadcast(new \App\Events\TechnicianLocationUpdated($user));

            return response()->json([
                'message' => 'Localização atualizada com sucesso.',
                'location' => [
                    'lat' => $user->location_lat,
                    'lng' => $user->location_lng,
                    'updated_at' => $user->location_updated_at,
                ],
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('UserLocation update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar localização'], 500);
        }
    }
}
