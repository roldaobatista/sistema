<?php
namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Fleet\VehiclePoolRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class VehiclePoolController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $query = VehiclePoolRequest::where('tenant_id', $request->user()->tenant_id)
                ->with(['user:id,name', 'vehicle:id,plate,model']);

            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            if ($request->filled('user_id')) {
                $query->where('user_id', $request->user_id);
            }

            return response()->json($query->latest()->paginate($request->per_page ?? 15));
        } catch (\Exception $e) {
            Log::error('VehiclePool index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar solicitações de veículo'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'fleet_vehicle_id' => 'nullable|exists:fleet_vehicles,id',
                'requested_start' => 'required|date',
                'requested_end' => 'required|date|after:requested_start',
                'purpose' => 'nullable|string',
            ]);

            $validated['tenant_id'] = $request->user()->tenant_id;
            $validated['user_id'] = $request->user()->id;
            $validated['status'] = 'pending';

            $poolRequest = VehiclePoolRequest::create($validated);

            DB::commit();
            return response()->json(['message' => 'Solicitação criada', 'data' => $poolRequest], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehiclePool store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar solicitação'], 500);
        }
    }

    public function show(VehiclePoolRequest $requestModel): JsonResponse
    {
        try {
            if ($requestModel->tenant_id != auth()->user()->tenant_id) abort(403);
            return response()->json($requestModel->load(['user', 'vehicle']));
        } catch (\Exception $e) {
            Log::error('VehiclePool show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar solicitação'], 500);
        }
    }

    public function updateStatus(Request $request, $id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $poolRequest = VehiclePoolRequest::where('tenant_id', $request->user()->tenant_id)
                ->findOrFail($id);

            $validated = $request->validate([
                'status' => ['required', Rule::in(['approved', 'rejected', 'in_use', 'completed', 'cancelled'])],
                'actual_start' => 'nullable|date',
                'actual_end' => 'nullable|date',
                'fleet_vehicle_id' => 'nullable|exists:fleet_vehicles,id',
            ]);

            $poolRequest->update($validated);

            DB::commit();
            return response()->json(['message' => 'Status atualizado', 'data' => $poolRequest]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehiclePool updateStatus failed', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['message' => 'Erro ao atualizar status'], 500);
        }
    }

    public function destroy($id): JsonResponse
    {
        try {
            $poolRequest = VehiclePoolRequest::where('tenant_id', auth()->user()->tenant_id)
                ->findOrFail($id);

            if ($poolRequest->status != 'pending') {
                return response()->json(['message' => 'Apenas solicitações pendentes podem ser excluídas'], 422);
            }

            $poolRequest->delete();
            return response()->json(['message' => 'Solicitação excluída']);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => 'Solicitação não encontrada'], 404);
        } catch (\Exception $e) {
            Log::error('VehiclePool destroy failed', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['message' => 'Erro ao excluir solicitação'], 500);
        }
    }
}
