<?php

namespace App\Http\Controllers\Api\V1\Metrology;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\StandardWeight;
use App\Services\Metrology\WeightWearPredictorService;

class StandardWeightWearController extends Controller
{
    public function __construct(private WeightWearPredictorService $wearService) {}

    /**
     * Trigger wear prediction calculation and return the updated metrics.
     */
    public function predict(int $id, Request $request)
    {
        $tenantId = app('current_tenant_id') ?? $request->user()->tenant_id;
        
        $weight = StandardWeight::where('tenant_id', $tenantId)
            ->findOrFail($id);
            
        // Trigger prediction (this updates the model)
        $this->wearService->updateWearPrediction($weight);
        
        // Refresh model from DB to get updated fields
        $weight->refresh();

        return response()->json([
            'weight_id' => $weight->id,
            'name' => $weight->name ?? 'Peso Padrão',
            'wear_rate_percentage' => $weight->wear_rate_percentage,
            'expected_failure_date' => $weight->expected_failure_date,
        ]);
    }
}
