<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Batch;
use App\Models\Supplier;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use SimpleXMLElement;

class XmlImportService
{
    public function __construct(protected StockService $stockService) {}

    public function processNfe(string $xmlContent, int $warehouseId): array
    {
        $xml = new SimpleXMLElement($xmlContent);
        $tenantId = app('current_tenant_id');

        // Namespace handling if needed, but SimpleXML usually handles it locally
        $infNfe = $xml->NFe->infNFe ?? $xml->infNFe;
        if (!$infNfe) {
            throw new \Exception('XML inválido: tag <infNFe> não encontrada.');
        }

        $nfeNumber = (string) $infNfe->ide->nNF;
        $supplierData = $infNfe->emit;
        $productsData = $infNfe->det;

        // 1. Identificar ou Criar Fornecedor
        $supplier = $this->findOrCreateSupplier($supplierData, $tenantId);

        $importedItems = [];
        $errors = [];

        foreach ($productsData as $item) {
            try {
                DB::beginTransaction();
                
                $prod = $item->prod;
                $sku = (string) $prod->cProd;
                $name = (string) $prod->xProd;
                $qty = (float) $prod->qCom;
                $unitCost = (float) $prod->vUnCom;

                // 2. Localizar Produto (por SKU/Código de barras ou Nome)
                $product = $this->findProduct($sku, $name, $tenantId);

                if (!$product) {
                    // Se não encontrou, talvez devesse retornar para o usuário vincular manualmente
                    // Por enquanto, vamos pular ou criar (dependendo da política)
                    // Decisão: Marcar como pendente para vínculo manual se não existir
                    $errors[] = "Produto '$name' (Código: $sku) não encontrado no sistema.";
                    DB::rollBack();
                    continue;
                }

                // 3. Verificar Lotes (se existirem na tag <rastro>)
                $batchId = null;
                if (isset($item->prod->rastro)) {
                    $rastro = $item->prod->rastro;
                    $batchNumber = (string) $rastro->nLote;
                    $expiry = (string) $rastro->dVal;

                    $batch = Batch::firstOrCreate(
                        [
                            'tenant_id' => $tenantId,
                            'product_id' => $product->id,
                            'batch_number' => $batchNumber,
                        ],
                        [
                            'expires_at' => $expiry ?: null,
                            'initial_quantity' => $qty,
                        ]
                    );
                    $batchId = $batch->id;
                }

                // 4. Registrar Entrada no Estoque
                $this->stockService->manualEntry(
                    product: $product,
                    qty: $qty,
                    warehouseId: $warehouseId,
                    batchId: $batchId,
                    unitCost: $unitCost,
                    notes: "Importado via NF-e {$nfeNumber}",
                );

                $importedItems[] = [
                    'sku' => $sku,
                    'name' => $name,
                    'qty' => $qty,
                    'status' => 'success'
                ];

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                $errors[] = "Erro ao processar item $sku: " . $e->getMessage();
            }
        }

        return [
            'nfe_number' => $nfeNumber,
            'supplier' => $supplier->name,
            'items_imported' => $importedItems,
            'errors' => $errors,
        ];
    }

    protected function findOrCreateSupplier($emit, int $tenantId): Supplier
    {
        $cnpj = (string) $emit->CNPJ;
        $name = (string) $emit->xNome;

        return Supplier::firstOrCreate(
            ['tenant_id' => $tenantId, 'document' => $cnpj],
            ['name' => $name, 'is_active' => true]
        );
    }

    protected function findProduct(string $sku, string $name, int $tenantId): ?Product
    {
        // Tenta pelo código (SKU)
        $product = Product::where('tenant_id', $tenantId)
            ->where('code', $sku)
            ->first();

        if ($product) return $product;

        // Tenta pelo nome exato (menos provável)
        return Product::where('tenant_id', $tenantId)
            ->where('name', $name)
            ->first();
    }
}
