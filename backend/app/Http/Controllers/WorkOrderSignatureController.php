use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Models\WorkOrderSignature;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WorkOrderSignatureController extends Controller
{
    use ResolvesCurrentTenant;
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'work_order_id' => 'required|exists:work_orders,id'
        ]);

        $signatures = WorkOrderSignature::where('work_order_id', $request->work_order_id)
            ->orderBy('signed_at', 'desc')
            ->get();

        return response()->json(['data' => $signatures]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'signer_name' => 'required|string|max:255',
            'signer_document' => 'nullable|string|max:20',
            'signer_type' => 'required|string|in:customer,technician',
            'signature_data' => 'required|string', // Base64
        ]);

        try {
            DB::beginTransaction();

            $signature = WorkOrderSignature::create([
                ...$validated,
                'tenant_id' => $this->resolvedTenantId(),
                'signed_at' => now(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Assinatura registrada com sucesso', 'data' => $signature], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Signature store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar assinatura'], 500);
        }
    }
}
