<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
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
        $query = DB::table('commission_campaigns')
            ->where('tenant_id', $this->tenantId());

        if ($request->get('active_only')) {
            $query->where('active', true)
                ->where('starts_at', '<=', now()->toDateString())
                ->where('ends_at', '>=', now()->toDateString());
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'multiplier' => 'required|numeric|min:1.01|max:5.00',
            'applies_to_role' => 'nullable|in:technician,seller,driver',
            'applies_to_calculation_type' => 'nullable|string',
            'starts_at' => 'required|date',
            'ends_at' => 'required|date|after_or_equal:starts_at',
        ]);

        try {
            $id = DB::transaction(function () use ($validated) {
                return DB::table('commission_campaigns')->insertGetId([
                    'tenant_id' => $this->tenantId(),
                    'name' => $validated['name'],
                    'multiplier' => $validated['multiplier'],
                    'applies_to_role' => $validated['applies_to_role'] ?? null,
                    'applies_to_calculation_type' => $validated['applies_to_calculation_type'] ?? null,
                    'starts_at' => $validated['starts_at'],
                    'ends_at' => $validated['ends_at'],
                    'active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            return $this->success(['id' => $id], 'Campanha criada', 201);
        } catch (\Exception $e) {
            Log::error('Falha ao criar campanha de comissão', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao criar campanha', 500);
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'multiplier' => 'sometimes|numeric|min:1.01|max:5.00',
            'applies_to_role' => 'nullable|in:technician,seller,driver',
            'applies_to_calculation_type' => 'nullable|string',
            'starts_at' => 'sometimes|date',
            'ends_at' => 'sometimes|date|after_or_equal:starts_at',
            'active' => 'sometimes|boolean',
        ]);

        $exists = DB::table('commission_campaigns')
            ->where('id', $id)
            ->where('tenant_id', $this->tenantId())
            ->exists();

        if (!$exists) {
            return $this->error('Campanha não encontrada', 404);
        }

        try {
            $validated['updated_at'] = now();

            DB::transaction(function () use ($id, $validated) {
                DB::table('commission_campaigns')
                    ->where('id', $id)
                    ->where('tenant_id', $this->tenantId())
                    ->update($validated);
            });

            return $this->success(null, 'Campanha atualizada');
        } catch (\Exception $e) {
            Log::error('Falha ao atualizar campanha de comissão', ['error' => $e->getMessage(), 'campaign_id' => $id]);
            return $this->error('Erro interno ao atualizar campanha', 500);
        }
    }

    public function destroy(int $id): JsonResponse
    {
        try {
            $deleted = DB::transaction(function () use ($id) {
                return DB::table('commission_campaigns')
                    ->where('id', $id)
                    ->where('tenant_id', $this->tenantId())
                    ->delete();
            });

            if (!$deleted) {
                return $this->error('Campanha não encontrada', 404);
            }

            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Falha ao excluir campanha de comissão', ['error' => $e->getMessage(), 'campaign_id' => $id]);
            return $this->error('Erro interno ao excluir campanha', 500);
        }
    }
}
