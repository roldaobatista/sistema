<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ServiceCallTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ServiceCallTemplateController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(): JsonResponse
    {
        return response()->json(
            ServiceCallTemplate::where('tenant_id', $this->tenantId())
                ->orderBy('name')
                ->get()
        );
    }

    public function activeList(): JsonResponse
    {
        return response()->json(
            ServiceCallTemplate::where('tenant_id', $this->tenantId())
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'priority', 'observations', 'equipment_ids'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'priority' => 'required|string|in:low,normal,high,urgent',
            'observations' => 'nullable|string|max:2000',
            'equipment_ids' => 'nullable|array',
            'equipment_ids.*' => 'integer',
            'is_active' => 'boolean',
        ]);

        try {
            $template = ServiceCallTemplate::create([
                ...$validated,
                'tenant_id' => $this->tenantId(),
            ]);

            return response()->json($template, 201);
        } catch (\Throwable $e) {
            Log::error('ServiceCallTemplate create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar template'], 500);
        }
    }

    public function update(Request $request, ServiceCallTemplate $serviceCallTemplate): JsonResponse
    {
        if ((int) $serviceCallTemplate->tenant_id !== $this->tenantId()) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'priority' => 'sometimes|string|in:low,normal,high,urgent',
            'observations' => 'nullable|string|max:2000',
            'equipment_ids' => 'nullable|array',
            'equipment_ids.*' => 'integer',
            'is_active' => 'boolean',
        ]);

        try {
            $serviceCallTemplate->update($validated);
            return response()->json($serviceCallTemplate);
        } catch (\Throwable $e) {
            Log::error('ServiceCallTemplate update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar template'], 500);
        }
    }

    public function destroy(ServiceCallTemplate $serviceCallTemplate): JsonResponse
    {
        if ((int) $serviceCallTemplate->tenant_id !== $this->tenantId()) {
            abort(403);
        }

        $serviceCallTemplate->delete();
        return response()->json(null, 204);
    }
}
