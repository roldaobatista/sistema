<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\EquipmentCalibration;
use App\Models\ServiceChecklist;
use App\Models\StandardWeight;
use App\Models\WorkOrder;
use App\Models\WorkOrderChecklistResponse;
use App\Models\Expense;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class TechSyncController extends Controller
{
    /**
     * Pull updated data for the authenticated technician.
     * GET /api/tech/sync?since=ISO_TIMESTAMP
     */
    public function pull(Request $request): JsonResponse
    {
        $since = $request->query('since', '1970-01-01T00:00:00Z');
        $sinceDate = Carbon::parse($since);
        $userId = auth()->id();

        // Work orders assigned to this technician
        $workOrders = WorkOrder::where('updated_at', '>=', $sinceDate)
            ->where(function ($q) use ($userId) {
                $q->where('performed_by', $userId)
                  ->orWhereHas('technicians', fn ($t) => $t->where('user_id', $userId));
            })
            ->select([
                'id', 'number', 'os_number', 'status', 'priority',
                'scheduled_date', 'customer_id', 'description', 'sla_due_at', 'updated_at',
            ])
            ->with(['customer:id,name,phone,address,city,latitude,longitude'])
            ->get()
            ->map(function ($wo) {
                return [
                    'id' => $wo->id,
                    'number' => $wo->number,
                    'os_number' => $wo->os_number,
                    'status' => $wo->status,
                    'priority' => $wo->priority,
                    'scheduled_date' => $wo->scheduled_date?->toISOString(),
                    'customer_id' => $wo->customer_id,
                    'customer_name' => $wo->customer?->name,
                    'customer_phone' => $wo->customer?->phone,
                    'customer_address' => $wo->customer?->address,
                    'city' => $wo->customer?->city,
                    'description' => $wo->description,
                    'sla_due_at' => $wo->sla_due_at?->toISOString(),
                    'latitude' => $wo->customer?->latitude,
                    'longitude' => $wo->customer?->longitude,
                    'updated_at' => $wo->updated_at->toISOString(),
                ];
            });

        // Equipment linked to those work orders
        $woIds = $workOrders->pluck('id');
        $equipment = Equipment::whereIn('id', function ($q) use ($woIds) {
                $q->select('equipment_id')
                  ->from('work_order_equipments')
                  ->whereIn('work_order_id', $woIds);
            })
            ->where('updated_at', '>=', $sinceDate)
            ->select([
                'id', 'customer_id', 'type', 'brand', 'model',
                'serial_number', 'capacity', 'resolution', 'location', 'updated_at',
            ])
            ->get()
            ->map(fn ($e) => [
                ...$e->toArray(),
                'updated_at' => $e->updated_at->toISOString(),
            ]);

        // Active checklists
        $checklists = ServiceChecklist::where('updated_at', '>=', $sinceDate)
            ->where('is_active', true)
            ->with('items:id,service_checklist_id,label,type,is_required,options')
            ->get()
            ->map(fn ($cl) => [
                'id' => $cl->id,
                'name' => $cl->name,
                'service_type' => $cl->service_type,
                'items' => $cl->items->map(fn ($item) => [
                    'id' => $item->id,
                    'label' => $item->label,
                    'type' => $item->type,
                    'required' => $item->is_required,
                    'options' => $item->options,
                ])->toArray(),
                'updated_at' => $cl->updated_at->toISOString(),
            ]);

        // Standard weights
        $standardWeights = StandardWeight::where('updated_at', '>=', $sinceDate)
            ->select([
                'id', 'code', 'nominal_value', 'precision_class',
                'certificate_number', 'certificate_expiry', 'updated_at',
            ])
            ->get()
            ->map(fn ($sw) => [
                ...$sw->toArray(),
                'updated_at' => $sw->updated_at->toISOString(),
            ]);

        return response()->json([
            'work_orders' => $workOrders,
            'equipment' => $equipment,
            'checklists' => $checklists,
            'standard_weights' => $standardWeights,
            'updated_at' => now()->toISOString(),
        ]);
    }

    /**
     * Receive batch mutations from offline technician.
     * POST /api/tech/sync/batch
     */
    public function batchPush(Request $request): JsonResponse
    {
        $request->validate([
            'mutations' => 'required|array',
            'mutations.*.type' => 'required|string|in:checklist_response,expense,signature,status_change',
            'mutations.*.data' => 'required|array',
        ]);

        $processed = 0;
        $conflicts = [];
        $errors = [];

        DB::beginTransaction();

        try {
            foreach ($request->input('mutations') as $mutation) {
                try {
                    match ($mutation['type']) {
                        'checklist_response' => $this->processChecklistResponse($mutation['data'], $processed, $conflicts),
                        'expense' => $this->processExpense($mutation['data'], $processed, $conflicts),
                        'signature' => $this->processSignature($mutation['data'], $processed, $conflicts),
                        'status_change' => $this->processStatusChange($mutation['data'], $processed, $conflicts),
                    };
                    $processed++;
                } catch (\Exception $e) {
                    $errors[] = [
                        'type' => $mutation['type'],
                        'id' => $mutation['data']['id'] ?? 'unknown',
                        'message' => $e->getMessage(),
                    ];
                    Log::warning('[TechSync] Mutation failed', [
                        'type' => $mutation['type'],
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[TechSync] Batch push failed', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'Sync failed',
                'processed' => 0,
                'conflicts' => [],
                'errors' => [['type' => 'batch', 'id' => 'all', 'message' => $e->getMessage()]],
            ], 500);
        }

        return response()->json([
            'processed' => $processed,
            'conflicts' => $conflicts,
            'errors' => $errors,
        ]);
    }

    /**
     * Receive a single photo upload.
     * POST /api/tech/sync/photo
     */
    public function uploadPhoto(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|image|max:5120', // 5MB
            'work_order_id' => 'required|integer|exists:work_orders,id',
            'entity_type' => 'required|string|in:checklist,expense,general',
            'entity_id' => 'nullable|string',
        ]);

        $path = $request->file('file')->store(
            "work-orders/{$request->work_order_id}/photos",
            'public'
        );

        return response()->json([
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
        ], 201);
    }

    /* ─── Private processors ─────────────────────────────── */

    private function processChecklistResponse(array $data, int &$processed, array &$conflicts): void
    {
        WorkOrderChecklistResponse::updateOrCreate(
            ['id' => $data['id'] ?? null],
            [
                'work_order_id' => $data['work_order_id'],
                'equipment_id' => $data['equipment_id'],
                'checklist_id' => $data['checklist_id'],
                'responses' => $data['responses'],
                'completed_at' => $data['completed_at'] ?? now(),
            ]
        );
    }

    private function processExpense(array $data, int &$processed, array &$conflicts): void
    {
        Expense::create([
            'tenant_id' => auth()->user()->tenant_id,
            'work_order_id' => $data['work_order_id'],
            'category' => $data['category'] ?? null,
            'description' => $data['description'],
            'amount' => $data['amount'],
            'affects_technician_cash' => $data['affects_technician_cash'] ?? false,
            'affects_net_value' => $data['affects_net_value'] ?? false,
            'created_by' => auth()->id(),
            'status' => 'pending',
        ]);
    }

    private function processSignature(array $data, int &$processed, array &$conflicts): void
    {
        $workOrder = WorkOrder::findOrFail($data['work_order_id']);

        // Decode base64 PNG and store
        $pngData = base64_decode($data['png_base64']);
        $path = "work-orders/{$data['work_order_id']}/signature.png";
        Storage::disk('public')->put($path, $pngData);

        $workOrder->update([
            'signature_path' => $path,
            'signature_signer' => $data['signer_name'] ?? null,
            'signature_at' => $data['captured_at'] ?? now(),
            'signature_ip' => request()->ip(),
        ]);
    }

    private function processStatusChange(array $data, int &$processed, array &$conflicts): void
    {
        $workOrder = WorkOrder::findOrFail($data['work_order_id']);

        // Conflict check: if server version is newer, report conflict
        if (isset($data['updated_at'])) {
            $clientUpdated = Carbon::parse($data['updated_at']);
            if ($workOrder->updated_at->gt($clientUpdated)) {
                $conflicts[] = [
                    'type' => 'status_change',
                    'id' => (string) $workOrder->id,
                    'server_updated_at' => $workOrder->updated_at->toISOString(),
                ];
                return;
            }
        }

        $workOrder->update(['status' => $data['status']]);
    }
}
