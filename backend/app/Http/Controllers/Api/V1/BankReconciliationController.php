<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Services\BankReconciliationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BankReconciliationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private BankReconciliationService $reconciliationService,
    ) {}

    public function statements(Request $request): JsonResponse
    {
        $statements = BankStatement::where('tenant_id', $request->user()->tenant_id)
            ->with('creator')
            ->orderByDesc('created_at')
            ->paginate(15);

        return $this->success($statements);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:ofx,txt|max:5120']);

        $path = $request->file('file')->store('temp');

        $statement = $this->reconciliationService->importOfx(
            $request->user()->tenant_id,
            storage_path('app/' . $path),
            $request->user()->id
        );

        $matched = $this->reconciliationService->autoMatch($statement);

        return $this->success([
            'statement' => $statement->load('entries'),
            'matched_count' => $matched,
        ], 'Extrato importado com sucesso');
    }

    public function entries(Request $request, int $statementId): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        // Validar que o extrato pertence ao tenant
        $statement = BankStatement::where('tenant_id', $tenantId)->find($statementId);
        if (!$statement) {
            return $this->error('Extrato não encontrado', 404);
        }

        $entries = BankStatementEntry::where('tenant_id', $tenantId)
            ->where('bank_statement_id', $statement->id)
            ->orderBy('date')
            ->paginate(50);

        return $this->success($entries);
    }

    public function matchEntry(Request $request, int $entryId): JsonResponse
    {
        $request->validate([
            'matched_type' => 'required|string|in:' . implode(',', [
                \App\Models\AccountReceivable::class,
                \App\Models\AccountPayable::class,
            ]),
            'matched_id' => 'required|integer',
        ]);

        $entry = BankStatementEntry::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($entryId);

        $entry->update([
            'matched_type' => $request->matched_type,
            'matched_id' => $request->matched_id,
            'status' => BankStatementEntry::STATUS_MATCHED,
        ]);

        return $this->success($entry, 'Lançamento conciliado');
    }

    public function ignoreEntry(Request $request, int $entryId): JsonResponse
    {
        $entry = BankStatementEntry::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($entryId);

        $entry->update(['status' => BankStatementEntry::STATUS_IGNORED]);

        return $this->success($entry, 'Lançamento ignorado');
    }
}
