<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TollIntegrationController extends Controller
{
    use ResolvesCurrentTenant;

    public function index(Request $request): JsonResponse
    {
        $query = DB::table('toll_records')
            ->where('toll_records.tenant_id', $this->resolvedTenantId())
            ->join('fleet_vehicles', 'toll_records.fleet_vehicle_id', '=', 'fleet_vehicles.id')
            ->select(
                'toll_records.*',
                'fleet_vehicles.plate',
                'fleet_vehicles.model',
                'fleet_vehicles.brand'
            );

        if ($request->filled('fleet_vehicle_id')) {
            $query->where('toll_records.fleet_vehicle_id', $request->fleet_vehicle_id);
        }

        if ($request->filled('date_from')) {
            $query->where('toll_records.passage_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('toll_records.passage_date', '<=', $request->date_to);
        }

        return response()->json($query->orderByDesc('passage_date')->paginate($request->per_page ?? 20));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fleet_vehicle_id' => 'required|exists:fleet_vehicles,id',
            'passage_date' => 'required|date',
            'toll_plaza' => 'required|string|max:150',
            'highway' => 'nullable|string|max:100',
            'value' => 'required|numeric|min:0',
            'tag_number' => 'nullable|string|max:50',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
        ]);

        $validated['tenant_id'] = $this->resolvedTenantId();
        $validated['created_at'] = now();
        $validated['updated_at'] = now();

        try {
            DB::beginTransaction();
            $id = DB::table('toll_records')->insertGetId($validated);

            // Atualiza totalização no veículo
            DB::table('fleet_vehicles')
                ->where('id', $validated['fleet_vehicle_id'])
                ->increment('total_toll_cost', $validated['value']);

            DB::commit();
            return response()->json(['message' => 'Pedágio registrado', 'data' => ['id' => $id]], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao registrar pedágio', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno'], 500);
        }
    }

    public function summary(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $summary = DB::table('toll_records')
            ->where('toll_records.tenant_id', $tenantId)
            ->join('fleet_vehicles', 'toll_records.fleet_vehicle_id', '=', 'fleet_vehicles.id')
            ->select(
                'fleet_vehicles.id',
                'fleet_vehicles.plate',
                'fleet_vehicles.model',
                DB::raw('COUNT(*) as total_passages'),
                DB::raw('SUM(toll_records.value) as total_value'),
                DB::raw('AVG(toll_records.value) as avg_value')
            )
            ->when($request->filled('month'), fn ($q) => $q->whereMonth('passage_date', $request->month))
            ->when($request->filled('year'), fn ($q) => $q->whereYear('passage_date', $request->year))
            ->groupBy('fleet_vehicles.id', 'fleet_vehicles.plate', 'fleet_vehicles.model')
            ->orderByDesc('total_value')
            ->get();

        $grandTotal = $summary->sum('total_value');

        return response()->json([
            'data' => $summary,
            'grand_total' => round($grandTotal, 2),
        ]);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $record = DB::table('toll_records')
            ->where('id', $id)
            ->where('tenant_id', $this->resolvedTenantId())
            ->first();

        if (!$record) abort(404);

        DB::beginTransaction();
        DB::table('toll_records')->where('id', $id)->delete();
        DB::table('fleet_vehicles')->where('id', $record->fleet_vehicle_id)->decrement('total_toll_cost', $record->value);
        DB::commit();

        return response()->json(null, 204);
    }
}
