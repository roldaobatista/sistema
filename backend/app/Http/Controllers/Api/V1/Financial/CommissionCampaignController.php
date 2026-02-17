<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionCampaign;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CommissionCampaignController extends Controller
{
    use ApiResponseTrait;

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = CommissionCampaign::where('tenant_id', $this->tenantId());

        if ($request->get('active_only') || $request->get('active')) {
            $query->active();
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'multiplier' => 'required|numeric|min:1.01|max:5.00',
            'applies_to_role' => 'nullable|in:tecnico,vendedor,motorista',
            'applies_to_calculation_type' => 'nullable|string',
            'starts_at' => 'required|date',
            'ends_at' => 'required|date|after_or_equal:starts_at',
        ]);

        try {
            $campaign = DB::transaction(function () use ($validated) {
                return CommissionCampaign::create([
                    ...$validated,
                    'tenant_id' => $this->tenantId(),
                    'active' => true,
                ]);
            });

            return $this->success(['id' => $campaign->id], 'Campanha criada', 201);
        } catch (\Exception $e) {
            Log::error('Falha ao criar campanha de comissão', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao criar campanha', 500);
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $campaign = CommissionCampaign::where('tenant_id', $this->tenantId())->find($id);

        if (!$campaign) {
            return $this->error('Campanha não encontrada', 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'multiplier' => 'sometimes|numeric|min:1.01|max:5.00',
            'applies_to_role' => 'nullable|in:tecnico,vendedor,motorista',
            'applies_to_calculation_type' => 'nullable|string',
            'starts_at' => 'sometimes|date',
            'ends_at' => 'sometimes|date|after_or_equal:starts_at',
            'active' => 'sometimes|boolean',
        ]);

        try {
            DB::transaction(function () use ($campaign, $validated) {
                $campaign->update($validated);
            });

            return $this->success(null, 'Campanha atualizada');
        } catch (\Exception $e) {
            Log::error('Falha ao atualizar campanha de comissão', ['error' => $e->getMessage(), 'campaign_id' => $id]);
            return $this->error('Erro interno ao atualizar campanha', 500);
        }
    }

    public function destroy(int $id): JsonResponse
    {
        $campaign = CommissionCampaign::where('tenant_id', $this->tenantId())->find($id);

        if (!$campaign) {
            return $this->error('Campanha não encontrada', 404);
        }

        try {
            DB::transaction(fn () => $campaign->delete());
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Falha ao excluir campanha de comissão', ['error' => $e->getMessage(), 'campaign_id' => $id]);
            return $this->error('Erro interno ao excluir campanha', 500);
        }
    }
}
