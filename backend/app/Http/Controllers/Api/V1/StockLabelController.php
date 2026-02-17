<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\LabelGeneratorService;
use App\Services\PdfGeneratorService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class StockLabelController extends Controller
{
    use ResolvesCurrentTenant;

    public function __construct(
        private LabelGeneratorService $labelService,
        private PdfGeneratorService $pdfService,
    ) {}

    public function formats(): \Illuminate\Http\JsonResponse
    {
        $formats = $this->labelService->getFormats();
        $list = [];
        foreach ($formats as $key => $config) {
            $list[] = [
                'key' => $key,
                'name' => $config['name'],
                'width_mm' => $config['width_mm'],
                'height_mm' => $config['height_mm'],
                'output' => $config['output'],
            ];
        }
        return response()->json(['data' => $list]);
    }

    public function preview(Request $request): Response|\Illuminate\Http\JsonResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $validated = $request->validate([
            'product_id' => 'required|integer|exists:products,id',
            'format_key' => 'required|string|max:50',
            'show_logo' => 'sometimes|in:0,1,true,false',
        ]);

        try {
            $tenantId = $this->resolvedTenantId();
            $product = Product::where('tenant_id', $tenantId)->find($validated['product_id']);
            if (!$product) {
                return response()->json(['message' => 'Produto não encontrado.'], 404);
            }
            if (!$product->is_active) {
                return response()->json(['message' => 'Produto inativo não pode gerar etiqueta.'], 422);
            }

            $formats = $this->labelService->getFormats();
            if (!isset($formats[$validated['format_key']])) {
                return response()->json(['message' => 'Formato de etiqueta inválido.'], 422);
            }

            $showLogo = filter_var($validated['show_logo'] ?? true, FILTER_VALIDATE_BOOLEAN);
            $companyLogoPath = $showLogo ? $this->pdfService->getCompanyLogoPath($tenantId) : null;

            $expanded = new Collection([$product]);
            $path = $this->labelService->generatePdf($expanded, $validated['format_key'], $companyLogoPath);
            return response()->file($path, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="etiqueta-preview.pdf"',
            ])->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            Log::error('Label preview failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar preview da etiqueta.'], 500);
        }
    }

    public function generate(Request $request): Response|\Illuminate\Http\JsonResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        try {
        $validated = $request->validate([
            'product_ids' => 'required_without:items|array|min:1',
            'product_ids.*' => 'integer|exists:products,id',
            'items' => 'required_without:product_ids|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1|max:100',
            'format_key' => 'required|string|max:50',
            'quantity' => 'sometimes|integer|min:1|max:100',
            'show_logo' => 'sometimes|boolean',
        ]);

        $formatKey = $validated['format_key'];
        $formats = $this->labelService->getFormats();
        if (!isset($formats[$formatKey])) {
            return response()->json(['message' => 'Formato de etiqueta inválido.'], 422);
        }

        $tenantId = $this->resolvedTenantId();

        if (!empty($validated['items'])) {
            $expanded = new Collection;
            foreach ($validated['items'] as $row) {
                $p = Product::where('tenant_id', $tenantId)->find($row['product_id']);
                if (!$p) {
                    continue;
                }
                if (!$p->is_active) {
                    return response()->json(['message' => 'Produto inativo não pode gerar etiqueta: ' . $p->name], 422);
                }
                $qty = (int) ($row['quantity'] ?? 1);
                for ($i = 0; $i < $qty; $i++) {
                    $expanded->push($p);
                }
            }
        } else {
            $productIds = $validated['product_ids'] ?? [];
            $quantity = (int) ($validated['quantity'] ?? 1);
            $products = Product::where('tenant_id', $tenantId)->whereIn('id', $productIds)->get();
            foreach ($products as $p) {
                if (!$p->is_active) {
                    return response()->json(['message' => 'Produto inativo não pode gerar etiqueta: ' . $p->name], 422);
                }
            }
            $expanded = new Collection;
            foreach ($products as $p) {
                for ($i = 0; $i < $quantity; $i++) {
                    $expanded->push($p);
                }
            }
        }

        if ($expanded->isEmpty()) {
            return response()->json(['message' => 'Nenhum produto encontrado.'], 404);
        }

        $format = $formats[$formatKey];
        $output = $format['output'] ?? 'pdf';

        if ($output === 'zpl') {
            $zpl = $this->labelService->generateZplMultiple($expanded, $formatKey);
            return response($zpl, 200, [
                'Content-Type' => 'text/plain; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="etiquetas.zpl"',
            ]);
        }

        $showLogo = filter_var($validated['show_logo'] ?? true, FILTER_VALIDATE_BOOLEAN);
        $companyLogoPath = $showLogo ? $this->pdfService->getCompanyLogoPath($tenantId) : null;
        $path = $this->labelService->generatePdf($expanded, $formatKey, $companyLogoPath);
        return response()->file($path, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="etiquetas-estoque.pdf"',
        ])->deleteFileAfterSend(true);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            Log::error('Label generation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar etiquetas.'], 500);
        }
    }
}
