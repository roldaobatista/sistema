<?php

namespace App\Http\Controllers\Api\V1\Technician;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CustomerLocationController extends Controller
{
    /**
     * Update the geolocation of a specific customer.
     *
     * @param Request $request
     * @param Customer $customer
     * @return JsonResponse
     */
    public function update(Request $request, Customer $customer): JsonResponse
    {
        $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
        ]);

        try {
            // Optional: verify if the technician has an active work order for this customer
            // For now, we rely on the middleware check.permission:technicians.schedule.view
            
            $customer->update([
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
            ]);

            Log::info("Customer location updated by technician", [
                'technician_id' => auth()->id(),
                'customer_id' => $customer->id,
                'lat' => $request->latitude,
                'lng' => $request->longitude
            ]);

            return response()->json([
                'message' => 'Localização do cliente atualizada com sucesso.',
                'customer_id' => $customer->id,
                'location' => [
                    'lat' => $customer->latitude,
                    'lng' => $customer->longitude
                ]
            ]);

        } catch (\Exception $e) {
            Log::error("Error updating customer location", ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar localização.'], 500);
        }
    }
}
