<?php

namespace App\Http\Controllers\Api\V1\Operational;

use App\Http\Controllers\Controller;
use App\Models\ChecklistSubmission;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChecklistSubmissionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $this->authorize('technicians.checklist.view');

            $submissions = ChecklistSubmission::query()
                ->with(['checklist', 'technician', 'workOrder'])
                ->when($request->work_order_id, function ($query, $workOrderId) {
                    $query->where('work_order_id', $workOrderId);
                })
                ->when($request->technician_id, function ($query, $technicianId) {
                    $query->where('technician_id', $technicianId);
                })
                ->get();

            return response()->json($submissions);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erro ao listar submissões'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $this->authorize('technicians.checklist.create');

            DB::beginTransaction();

            $validated = $request->validate([
                'checklist_id' => 'required|exists:checklists,id',
                'work_order_id' => 'nullable|exists:work_orders,id',
                'responses' => 'required|array',
                'completed_at' => 'nullable|date',
            ]);

            $submission = ChecklistSubmission::create([
                ...$validated,
                'technician_id' => $request->user()->id,
                'completed_at' => $validated['completed_at'] ?? now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Checklist enviado com sucesso', 'data' => $submission], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Checklist submission failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno ao enviar checklist'], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(ChecklistSubmission $checklistSubmission): JsonResponse
    {
        try {
            $this->authorize('technicians.checklist.view');
            $checklistSubmission->load(['checklist', 'technician', 'workOrder']);
            return response()->json($checklistSubmission);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erro ao visualizar submissão'], 500);
        }
    }
}
