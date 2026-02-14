<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Service;
use App\Models\Equipment;
use App\Models\WorkOrder;
use App\Models\Quote;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BatchExportController extends Controller
{
    private const ENTITIES = [
        'customers' => Customer::class,
        'products' => Product::class,
        'services' => Service::class,
        'equipments' => Equipment::class,
        'work_orders' => WorkOrder::class,
        'quotes' => Quote::class,
    ];

    private const FIELD_MAPS = [
        'customers' => ['id','name','document','email','phone','segment','rating','is_active','created_at'],
        'products' => ['id','code','name','unit','cost_price','sell_price','stock_qty','stock_min','is_active','created_at'],
        'services' => ['id','code','name','unit','sell_price','is_active','created_at'],
        'equipments' => ['id','customer_id','tag','name','brand','model','serial_number','calibration_due_date','is_active','created_at'],
        'work_orders' => ['id','customer_id','equipment_id','type','status','priority','scheduled_date','total','created_at'],
        'quotes' => ['id','customer_id','status','total','valid_until','created_at'],
    ];

    public function entities(): \Illuminate\Http\JsonResponse
    {
        try {
            $result = [];
            foreach (self::ENTITIES as $key => $class) {
                $result[] = [
                    'key' => $key,
                    'label' => $this->entityLabel($key),
                    'fields' => self::FIELD_MAPS[$key] ?? [],
                    'count' => $class::count(),
                ];
            }
            return response()->json(['data' => $result]);
        } catch (\Exception $e) {
            Log::error('BatchExport entities failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar entidades'], 500);
        }
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        try {
            $validated = $request->validate([
                'entity' => 'required|string|in:' . implode(',', array_keys(self::ENTITIES)),
                'fields' => 'nullable|array',
                'fields.*' => 'string',
                'ids' => 'nullable|array',
                'ids.*' => 'integer',
                'filters' => 'nullable|array',
            ]);

            $entity = $validated['entity'];
            $modelClass = self::ENTITIES[$entity];
            $fields = $validated['fields'] ?? self::FIELD_MAPS[$entity] ?? ['*'];

            $query = $modelClass::query();

            if (!empty($validated['ids'])) {
                $query->whereIn('id', $validated['ids']);
            }

            if (!empty($validated['filters'])) {
                foreach ($validated['filters'] as $field => $value) {
                    $query->where($field, $value);
                }
            }

            $filename = "{$entity}_export_" . now()->format('Y-m-d_His') . '.csv';

            return response()->streamDownload(function () use ($query, $fields) {
                $handle = fopen('php://output', 'w');
                fwrite($handle, "\xEF\xBB\xBF");
                fputcsv($handle, $fields, ';');

                $query->select($fields)->chunk(500, function ($rows) use ($handle, $fields) {
                    foreach ($rows as $row) {
                        $data = [];
                        foreach ($fields as $field) {
                            $data[] = $row->{$field} ?? '';
                        }
                        fputcsv($handle, $data, ';');
                    }
                });

                fclose($handle);
            }, $filename, [
                'Content-Type' => 'text/csv; charset=UTF-8',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->streamDownload(function () {
                echo 'Validação falhou';
            }, 'error.txt');
        } catch (\Exception $e) {
            Log::error('BatchExport exportCsv failed', ['error' => $e->getMessage()]);
            return response()->streamDownload(function () {
                echo 'Erro na exportação';
            }, 'error.txt');
        }
    }

    public function batchPrint(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $validated = $request->validate([
                'entity' => 'required|string|in:work_orders,quotes',
                'ids' => 'required|array|min:1|max:50',
                'ids.*' => 'integer',
            ]);

            return response()->json([
                'entity' => $validated['entity'],
                'ids' => $validated['ids'],
                'pdf_base_url' => $validated['entity'] === 'work_orders'
                    ? '/api/v1/work-orders/{id}/pdf'
                    : '/api/v1/quotes/{id}/pdf',
                'message' => count($validated['ids']) . ' documentos prontos para impressão.',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('BatchExport batchPrint failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na impressão em lote'], 500);
        }
    }

    private function entityLabel(string $key): string
    {
        return match ($key) {
            'customers' => 'Clientes',
            'products' => 'Produtos',
            'services' => 'Serviços',
            'equipments' => 'Equipamentos',
            'work_orders' => 'Ordens de Serviço',
            'quotes' => 'Orçamentos',
            default => ucfirst($key),
        };
    }
}
