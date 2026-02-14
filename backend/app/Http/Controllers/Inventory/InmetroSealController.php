<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Models\InmetroSeal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class InmetroSealController extends Controller
{
    /**
     * Listagem global de selos (Admin)
     */
    public function index(Request $request)
    {
        $query = InmetroSeal::with(['assignedTo', 'workOrder', 'equipment'])
            ->where('tenant_id', Auth::user()->tenant_id);

        if ($request->search) {
            $query->where('number', 'like', "%{$request->search}%");
        }

        if ($request->type) {
            $query->where('type', $request->type);
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->technician_id) {
            $query->where('assigned_to', $request->technician_id);
        }

        return response()->json($query->paginate($request->per_page ?? 50));
    }

    /**
     * Entrada de selos/lacres em lote (Admin)
     */
    public function storeBatch(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:seal,seal_reparo',
            'start_number' => 'required|numeric',
            'end_number' => 'required|numeric|gte:start_number',
            'prefix' => 'nullable|string',
            'suffix' => 'nullable|string',
        ]);

        $tenantId = Auth::user()->tenant_id;
        $count = 0;

        try {
            DB::beginTransaction();
            for ($i = $validated['start_number']; $i <= $validated['end_number']; $i++) {
                $number = ($validated['prefix'] ?? '') . $i . ($validated['suffix'] ?? '');
                
                InmetroSeal::create([
                    'tenant_id' => $tenantId,
                    'type' => $validated['type'],
                    'number' => $number,
                    'status' => 'available',
                ]);
                $count++;
            }
            DB::commit();

            return response()->json(['message' => "$count itens cadastrados com sucesso."], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao cadastrar selos em lote: ' . $e->getMessage());
            return response()->json(['message' => 'Erro interno ao processar lote.'], 500);
        }
    }

    /**
     * Atribui lote a um técnico (Admin)
     */
    public function assignToTechnician(Request $request)
    {
        $validated = $request->validate([
            'technician_id' => 'required|exists:users,id',
            'seal_ids' => 'required|array',
            'seal_ids.*' => 'exists:inmetro_seals,id',
        ]);

        InmetroSeal::whereIn('id', $validated['seal_ids'])
            ->where('status', 'available')
            ->update([
                'assigned_to' => $validated['technician_id'],
                'status' => 'assigned',
            ]);

        return response()->json(['message' => 'Itens atribuídos ao técnico com sucesso.']);
    }

    /**
     * Lista selos em posse do técnico logado
     */
    public function mySeals(Request $request)
    {
        $type = $request->query('type');
        $query = InmetroSeal::where('assigned_to', Auth::id())
            ->where('status', 'assigned');

        if ($type) {
            $query->where('type', $type);
        }

        return response()->json($query->get());
    }

    /**
     * Registra o uso de um selo/lacre (Técnico/OS)
     */
    public function useSeal(Request $request, $id)
    {
        $seal = InmetroSeal::where('id', $id)
            ->where('assigned_to', Auth::id())
            ->where('status', 'assigned')
            ->firstOrFail();

        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'equipment_id' => 'required|exists:equipments,id',
            'photo' => 'required|image|max:2048', // Foto obrigatória
        ]);

        // Upload da foto
        $path = $request->file('photo')->store('seals', 'public');

        $seal->update([
            'status' => 'used',
            'work_order_id' => $validated['work_order_id'],
            'equipment_id' => $validated['equipment_id'],
            'photo_path' => $path,
            'used_at' => now(),
        ]);

        // Verificar Alerta de Estoque
        $this->checkStockAlert(Auth::id(), $seal->type);

        return response()->json(['message' => 'Uso registrado com sucesso!', 'seal' => $seal]);
    }

    /**
     * Exportar relatório de selos (CSV)
     */
    public function export(Request $request)
    {
        $query = InmetroSeal::with(['assignedTo', 'workOrder', 'equipment'])
            ->where('tenant_id', Auth::user()->tenant_id);

        if ($request->type) $query->where('type', $request->type);
        if ($request->status) $query->where('status', $request->status);
        if ($request->technician_id) $query->where('assigned_to', $request->technician_id);

        $seals = $query->get();

        $headers = [
            "Content-type"        => "text/csv; charset=UTF-8",
            "Content-Disposition" => "attachment; filename=relatorio_selos_" . date('Ymd_His') . ".csv",
            "Pragma"              => "no-cache",
            "Cache-Control"       => "must-revalidate, post-check=0, pre-check=0",
            "Expires"             => "0"
        ];

        $callback = function() use ($seals) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM para UTF-8 (Excel friendly)
            
            fputcsv($file, ['ID', 'Tipo', 'Número', 'Status', 'Técnico', 'OS', 'Equipamento', 'Data Uso', 'Data Cadastro']);

            foreach ($seals as $seal) {
                fputcsv($file, [
                    $seal->id,
                    $seal->type === 'seal_reparo' ? 'Selo Reparo' : 'Lacre',
                    $seal->number,
                    $seal->status,
                    $seal->assignedTo->name ?? 'N/A',
                    $seal->workOrder->number ?? 'N/A',
                    $seal->equipment ? "{$seal->equipment->brand} {$seal->equipment->model}" : 'N/A',
                    $seal->used_at ? $seal->used_at->format('d/m/Y H:i') : '—',
                    $seal->created_at->format('d/m/Y H:i'),
                ]);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Auditoria de inconsistências (Selos atribuídos há > 30 dias sem uso)
     */
    public function audit()
    {
        $staleSeals = InmetroSeal::with('assignedTo')
            ->where('tenant_id', Auth::user()->tenant_id)
            ->where('status', 'assigned')
            ->where('updated_at', '<', now()->subDays(30))
            ->get();

        return response()->json([
            'stale_count' => $staleSeals->count(),
            'stale_items' => $staleSeals
        ]);
    }

    /**
     * Verifica se o técnico está com estoque baixo
     */
    private function checkStockAlert($userId, $type)
    {
        $count = InmetroSeal::where('assigned_to', $userId)
            ->where('status', 'assigned')
            ->where('type', $type)
            ->count();

        $limit = ($type === 'seal_reparo') ? 5 : 20;

        if ($count < $limit) {
            // Aqui integraria com o sistema de notificações global do sistema
            // Ex: Notification::send($user, new LowInmetroStockNotification($type, $count));
            Log::warning("Estoque baixo para o técnico $userId: $type ($count restantes)");
        }
    }
}
