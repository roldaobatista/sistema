<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\NumberingSequence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NumberingSequenceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id ?? $request->user()->tenant_id;

        $sequences = NumberingSequence::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->orderBy('entity')
            ->get();

        return response()->json($sequences);
    }

    public function update(Request $request, NumberingSequence $numberingSequence): JsonResponse
    {
        try {
            $tenantId = $request->user()->current_tenant_id ?? $request->user()->tenant_id;

            if ($numberingSequence->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            $validated = $request->validate([
                'prefix' => 'sometimes|string|max:20',
                'next_number' => 'sometimes|integer|min:1',
                'padding' => 'sometimes|integer|min:1|max:10',
            ]);

            DB::transaction(fn () => $numberingSequence->update($validated));

            return response()->json($numberingSequence->fresh());
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('NumberingSequence update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar sequência'], 500);
        }
    }

    public function preview(Request $request, NumberingSequence $numberingSequence): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id ?? $request->user()->tenant_id;

        if ($numberingSequence->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $prefix = $request->query('prefix', $numberingSequence->prefix);
        $nextNumber = (int) $request->query('next_number', $numberingSequence->next_number);
        $padding = (int) $request->query('padding', $numberingSequence->padding);

        $preview = $prefix . str_pad((string) $nextNumber, $padding, '0', STR_PAD_LEFT);

        return response()->json(['preview' => $preview]);
    }
}
