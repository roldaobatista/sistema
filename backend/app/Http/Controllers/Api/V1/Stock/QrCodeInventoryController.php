<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\StockMovement;
use App\Enums\StockMovementType;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class QrCodeInventoryController extends Controller
{
    /**
     * Registra entrada ou saída de estoque via leitura de QR Code
     */
    public function scan(Request $request)
    {
        $validated = $request->validate([
            'qr_hash' => 'required|string',
            'quantity' => 'required|numeric|min:0.01',
            'type' => ['required', Rule::in(['entry', 'exit'])],
            'warehouse_id' => 'required|exists:warehouses,id',
            'reference' => 'nullable|string'
        ]);

        $user = $request->user();
        $tenantId = app('current_tenant_id') ?? $user->tenant_id;

        $product = Product::where('tenant_id', $tenantId)
            ->where('qr_hash', $validated['qr_hash'])
            ->firstOrFail();

        $movement = DB::transaction(function () use ($validated, $product, $tenantId, $user) {
            $movementType = $validated['type'] === 'entry' 
                ? StockMovementType::Entry 
                : StockMovementType::Exit;

            return StockMovement::create([
                'tenant_id' => $tenantId,
                'product_id' => $product->id,
                'warehouse_id' => $validated['warehouse_id'],
                'type' => $movementType->value,
                'quantity' => abs($validated['quantity']),
                'reference' => $validated['reference'] ?? 'Sincronização PWA via QR Code',
                'created_by' => $user->id,
                'scanned_via_qr' => true,
            ]);
            
            // Note: O recálculo de saldo nos armazéns ocorre via 
            // App\Observers\StockMovementObserver que já escuta movimentações.
        });

        return response()->json([
            'message' => 'Movimentação via QR Code registrada com sucesso.',
            'movement' => $movement,
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku
            ]
        ], 201);
    }
}
