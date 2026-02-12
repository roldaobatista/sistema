<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SlaPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SlaPolicyController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();

        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $policies = SlaPolicy::where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $policies]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'response_time_minutes' => 'required|integer|min:1',
            'resolution_time_minutes' => 'required|integer|min:1',
            'priority' => 'required|string|in:low,medium,high,critical',
            'is_active' => 'boolean',
        ]);

        $data['tenant_id'] = $tenantId;
        $policy = SlaPolicy::create($data);

        return response()->json(['data' => $policy], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $policy = SlaPolicy::where('tenant_id', $tenantId)->findOrFail($id);
        return response()->json(['data' => $policy]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $policy = SlaPolicy::where('tenant_id', $tenantId)->findOrFail($id);
        
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'response_time_minutes' => 'integer|min:1',
            'resolution_time_minutes' => 'integer|min:1',
            'priority' => 'string|in:low,medium,high,critical',
            'is_active' => 'boolean',
        ]);

        $policy->update($data);

        return response()->json(['data' => $policy]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $policy = SlaPolicy::where('tenant_id', $tenantId)->findOrFail($id);
        $policy->delete();

        return response()->json(['message' => 'Política SLA excluída com sucesso']);
    }
}
