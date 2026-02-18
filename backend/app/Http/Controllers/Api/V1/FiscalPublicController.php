<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Fiscal\FiscalComplianceService;
use App\Models\FiscalNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * #19 — Public (no auth) controller for DANFE consultation.
 */
class FiscalPublicController extends Controller
{
    public function __construct(private FiscalComplianceService $compliance) {}

    /**
     * Public DANFE lookup by access key.
     */
    public function consultaPublica(Request $request): JsonResponse
    {
        $request->validate(['chave_acesso' => 'required|string|size:44']);

        $note = $this->compliance->consultaPublica($request->chave_acesso);

        if (! $note) {
            return response()->json(['error' => 'Nota fiscal não encontrada'], 404);
        }

        return response()->json([
            'type' => $note->type,
            'number' => $note->number,
            'series' => $note->series,
            'access_key' => $note->access_key,
            'status' => $note->status,
            'total_amount' => $note->total_amount,
            'issued_at' => $note->issued_at?->format('d/m/Y H:i'),
            'nature_of_operation' => $note->nature_of_operation,
        ]);
    }
}
