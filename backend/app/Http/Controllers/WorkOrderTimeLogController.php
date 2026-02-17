use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Models\WorkOrderTimeLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WorkOrderTimeLogController extends Controller
{
    use ResolvesCurrentTenant;
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'work_order_id' => 'required|exists:work_orders,id'
        ]);

        $logs = WorkOrderTimeLog::where('work_order_id', $request->work_order_id)
            ->with('user:id,name')
            ->orderBy('started_at', 'desc')
            ->get();

        return response()->json(['data' => $logs]);
    }

    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'activity_type' => 'required|string|in:travel,work,setup,pause',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'description' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            // Finish any open logs for this technician/WO combo
            WorkOrderTimeLog::where('user_id', $request->user()->id)
                ->whereNull('ended_at')
                ->update([
                    'ended_at' => now(),
                    'duration_seconds' => DB::raw('TIMESTAMPDIFF(SECOND, started_at, NOW())')
                ]);

            $log = WorkOrderTimeLog::create([
                ...$validated,
                'tenant_id' => $this->resolvedTenantId(),
                'user_id' => $request->user()->id,
                'started_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Timer iniciado', 'data' => $log], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Time log start failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao iniciar timer'], 500);
        }
    }

    public function stop(Request $request, WorkOrderTimeLog $workOrderTimeLog): JsonResponse
    {
        try {
            if ($workOrderTimeLog->ended_at) {
                return response()->json(['message' => 'Timer já foi finalizado'], 422);
            }

            $workOrderTimeLog->update([
                'ended_at' => now(),
                'duration_seconds' => now()->diffInSeconds($workOrderTimeLog->started_at),
                'latitude' => $request->latitude ?? $workOrderTimeLog->latitude,
                'longitude' => $request->longitude ?? $workOrderTimeLog->longitude,
            ]);

            return response()->json(['message' => 'Timer parado', 'data' => $workOrderTimeLog]);
        } catch (\Exception $e) {
            Log::error('Time log stop failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao parar timer'], 500);
        }
    }
}
