<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\XmlImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class XmlImportController extends Controller
{
    public function __construct(protected XmlImportService $xmlImportService) {}

    public function import(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $request->validate([
            'xml_file' => 'required|file|mimes:xml|max:10240',
            'warehouse_id' => "required|exists:warehouses,id,tenant_id,{$tenantId}",
        ]);

        try {
            $xmlContent = file_get_contents($request->file('xml_file')->getRealPath());
            $result = $this->xmlImportService->processNfe($xmlContent, $request->warehouse_id);

            return response()->json([
                'message' => 'Processamento de XML concluído',
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao processar o arquivo XML.'
            ], 422);
        }
    }
}
