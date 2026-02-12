<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Services\BankReconciliationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class BankReconciliationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private BankReconciliationService $reconciliationService,
    ) {}

    private function tenantId(Request $request): int
    {
        $user = $request->user();

        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    private function normalizeMatchedType(?string $type): ?string
    {
        if (!$type) {
            return null;
        }

        $normalized = strtolower(trim($type));

        return match ($normalized) {
            'accountreceivable', 'account_receivable', 'receivable', strtolower(AccountReceivable::class) => AccountReceivable::class,
            'accountpayable', 'account_payable', 'payable', strtolower(AccountPayable::class) => AccountPayable::class,
            default => null,
        };
    }

    private function syncMatchedEntries(BankStatementEntry $entry): void
    {
        $entry->statement()->update([
            'matched_entries' => BankStatementEntry::query()
                ->where('tenant_id', $entry->tenant_id)
                ->where('bank_statement_id', $entry->bank_statement_id)
                ->where('status', BankStatementEntry::STATUS_MATCHED)
                ->count(),
        ]);
    }

    public function statements(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $statements = BankStatement::query()
                ->where('tenant_id', $tenantId)
                ->with(['creator:id,name'])
                ->withCount('entries')
                ->orderByDesc('created_at')
                ->paginate(15);

            return $this->success($statements);
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation statements failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao listar extratos.', 500);
        }
    }

    public function import(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'mimes:ofx,txt', 'max:5120'],
        ]);

        if ($validator->fails()) {
            return $this->error('Arquivo invalido para importacao.', 422, $validator->errors());
        }

        $tenantId = $this->tenantId($request);
        $path = $request->file('file')->store('temp');
        $absolutePath = storage_path('app/' . $path);

        try {
            $statement = $this->reconciliationService->importOfx(
                $tenantId,
                $absolutePath,
                $request->user()->id,
                $request->file('file')->getClientOriginalName()
            );

            $matched = $this->reconciliationService->autoMatch($statement);

            return $this->success([
                'statement' => $statement->load('entries'),
                'matched_count' => $matched,
            ], 'Extrato importado com sucesso');
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation import failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao importar extrato.', 500);
        } finally {
            Storage::delete($path);
        }
    }

    public function entries(Request $request, int $statementId): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $statement = BankStatement::query()
                ->where('tenant_id', $tenantId)
                ->find($statementId);
            if (!$statement) {
                return $this->error('Extrato nao encontrado.', 404);
            }

            $entries = BankStatementEntry::query()
                ->where('tenant_id', $tenantId)
                ->where('bank_statement_id', $statement->id)
                ->with('matched')
                ->orderBy('date')
                ->orderBy('id')
                ->paginate(50);

            return $this->success($entries);
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation entries failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao listar lancamentos do extrato.', 500);
        }
    }

    public function matchEntry(Request $request, int $entryId): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validator = Validator::make($request->all(), [
            'matched_type' => ['required', 'string', 'max:120'],
            'matched_id' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->error('Dados invalidos para conciliacao.', 422, $validator->errors());
        }

        $matchedType = $this->normalizeMatchedType($request->string('matched_type')->value());
        if ($matchedType === null) {
            return $this->error('Tipo de conciliacao invalido.', 422);
        }

        $entry = BankStatementEntry::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($entryId);

        $matchedId = (int) $request->integer('matched_id');
        $matchedExists = match ($matchedType) {
            AccountReceivable::class => AccountReceivable::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->whereKey($matchedId)
                ->exists(),
            AccountPayable::class => AccountPayable::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->whereKey($matchedId)
                ->exists(),
            default => false,
        };

        if (!$matchedExists) {
            return $this->error('Registro financeiro para conciliacao nao encontrado neste tenant.', 422);
        }

        $entry->update([
            'matched_type' => $matchedType,
            'matched_id' => $matchedId,
            'status' => BankStatementEntry::STATUS_MATCHED,
        ]);
        $this->syncMatchedEntries($entry);

        return $this->success($entry->fresh('matched'), 'Lancamento conciliado');
    }

    public function ignoreEntry(Request $request, int $entryId): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $entry = BankStatementEntry::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($entryId);

        $entry->update([
            'status' => BankStatementEntry::STATUS_IGNORED,
            'matched_type' => null,
            'matched_id' => null,
        ]);
        $this->syncMatchedEntries($entry);

        return $this->success($entry, 'Lancamento ignorado');
    }
}
