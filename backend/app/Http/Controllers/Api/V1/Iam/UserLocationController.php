<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserLocationController extends Controller
{
    /**
     * Atualiza a geolocalização do usuário autenticado.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function update(Request $request): JsonResponse
    {
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
    }
}
