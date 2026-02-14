<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

// ─── Tool Model ──────────────────────────────────────────────

class ToolCheckout extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'tool_id', 'user_id', 'checked_out_at', 'checked_in_at',
        'condition_out', 'condition_in', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'checked_out_at' => 'datetime',
            'checked_in_at' => 'datetime',
        ];
    }

    public function tool(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Product::class, 'tool_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}

// ─── Controller ──────────────────────────────────────────────

class ToolTrackingController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    /**
     * GET /tools/checkouts — list active and recent checkouts.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ToolCheckout::where('tenant_id', $this->tenantId())
            ->with(['tool:id,name,code', 'user:id,name']);

        if ($request->boolean('active_only', false)) {
            $query->whereNull('checked_in_at');
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        $perPage = min((int) $request->input('per_page', 30), 100);

        return response()->json(
            $query->orderByDesc('checked_out_at')->paginate($perPage)
        );
    }

    /**
     * POST /tools/checkout — check out a tool to a technician.
     */
    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tool_id' => 'required|exists:products,id',
            'user_id' => 'required|exists:users,id',
            'condition_out' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        // Check if already checked out
        $existing = ToolCheckout::where('tenant_id', $this->tenantId())
            ->where('tool_id', $validated['tool_id'])
            ->whereNull('checked_in_at')
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Esta ferramenta já está emprestada para ' . ($existing->user?->name ?? 'N/A'),
            ], 422);
        }

        DB::beginTransaction();
        try {
            $checkout = ToolCheckout::create([
                'tenant_id' => $this->tenantId(),
                'tool_id' => $validated['tool_id'],
                'user_id' => $validated['user_id'],
                'checked_out_at' => now(),
                'condition_out' => $validated['condition_out'] ?? 'Bom',
                'notes' => $validated['notes'] ?? null,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Ferramenta retirada com sucesso',
                'data' => $checkout->load(['tool:id,name,code', 'user:id,name']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Tool checkout failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar retirada'], 500);
        }
    }

    /**
     * POST /tools/checkin/{checkout} — return a tool.
     */
    public function checkin(Request $request, int $checkoutId): JsonResponse
    {
        $checkout = ToolCheckout::where('tenant_id', $this->tenantId())
            ->findOrFail($checkoutId);

        if ($checkout->checked_in_at) {
            return response()->json(['message' => 'Esta ferramenta já foi devolvida'], 422);
        }

        $validated = $request->validate([
            'condition_in' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        $checkout->update([
            'checked_in_at' => now(),
            'condition_in' => $validated['condition_in'] ?? 'Bom',
            'notes' => $validated['notes'] ?? $checkout->notes,
        ]);

        return response()->json([
            'message' => 'Ferramenta devolvida com sucesso',
            'data' => $checkout->fresh()->load(['tool:id,name,code', 'user:id,name']),
        ]);
    }

    /**
     * GET /tools/overdue — tools checked out for more than X days.
     */
    public function overdue(Request $request): JsonResponse
    {
        $days = (int) $request->input('days', 7);

        $overdue = ToolCheckout::where('tenant_id', $this->tenantId())
            ->whereNull('checked_in_at')
            ->where('checked_out_at', '<', now()->subDays($days))
            ->with(['tool:id,name,code', 'user:id,name'])
            ->orderBy('checked_out_at')
            ->get();

        return response()->json(['data' => $overdue]);
    }
}
