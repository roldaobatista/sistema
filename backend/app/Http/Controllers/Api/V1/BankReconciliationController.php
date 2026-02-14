<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\BankAccount;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Services\BankReconciliationService;
use App\Events\ReconciliationUpdated;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

    // ─── F3: Summary / Dashboard KPIs ─────────────────

    public function summary(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $data = $this->reconciliationService->getSummary($tenantId);

            return $this->success($data);
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation summary failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao carregar resumo.', 500);
        }
    }

    // ─── Statements List ──────────────────────────────

    public function statements(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $query = BankStatement::query()
                ->where('tenant_id', $tenantId)
                ->with(['creator:id,name', 'bankAccount:id,name,bank_name'])
                ->withCount('entries')
                ->orderByDesc('created_at');

            // Filter by bank account
            if ($request->filled('bank_account_id')) {
                $query->where('bank_account_id', (int) $request->input('bank_account_id'));
            }

            $statements = $query->paginate(15);

            return $this->success($statements);
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation statements failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao listar extratos.', 500);
        }
    }

    // ─── Import ───────────────────────────────────────

    public function import(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'mimes:ofx,txt,ret,rem', 'max:10240'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
        ]);

        if ($validator->fails()) {
            return $this->error('Dados inválidos.', 422, $validator->errors());
        }

        $tenantId = $this->tenantId($request);
        $bankAccountId = $request->integer('bank_account_id') ?: null;

        // Validate bank account belongs to tenant
        if ($bankAccountId) {
            $accountExists = BankAccount::where('tenant_id', $tenantId)
                ->where('id', $bankAccountId)
                ->exists();
            if (!$accountExists) {
                return $this->error('Conta bancária não encontrada neste tenant.', 422);
            }
        }

        $path = $request->file('file')->store('temp');
        $absolutePath = storage_path('app/' . $path);

        try {
            $statement = $this->reconciliationService->import(
                $tenantId,
                $absolutePath,
                $request->user()->id,
                $request->file('file')->getClientOriginalName(),
                $bankAccountId
            );

            $matched = $this->reconciliationService->autoMatch($statement);

            $duplicateCount = $statement->entries()->where('possible_duplicate', true)->count();

            return $this->success([
                'statement'       => $statement->load('entries'),
                'matched_count'   => $matched,
                'format'          => $statement->format ?? 'ofx',
                'duplicate_count' => $duplicateCount,
            ], 'Extrato importado com sucesso');
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation import failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao importar extrato.', 500);
        } finally {
            Storage::delete($path);
            event(new ReconciliationUpdated($tenantId, 'import', ['matched' => $matched ?? 0]));
        }
    }

    // ─── F7: Entries with Filters ─────────────────────

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

            $query = BankStatementEntry::query()
                ->where('tenant_id', $tenantId)
                ->where('bank_statement_id', $statement->id)
                ->with('matched');

            // Filters
            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }
            if ($request->filled('type')) {
                $query->where('type', $request->input('type'));
            }
            if ($request->filled('min_amount')) {
                $query->where('amount', '>=', (float) $request->input('min_amount'));
            }
            if ($request->filled('max_amount')) {
                $query->where('amount', '<=', (float) $request->input('max_amount'));
            }
            if ($request->filled('date_from')) {
                $query->where('date', '>=', $request->input('date_from'));
            }
            if ($request->filled('date_to')) {
                $query->where('date', '<=', $request->input('date_to'));
            }
            if ($request->filled('search')) {
                $query->where('description', 'LIKE', '%' . $request->input('search') . '%');
            }
            if ($request->filled('duplicates_only') && $request->boolean('duplicates_only')) {
                $query->where('possible_duplicate', true);
            }

            $entries = $query->orderBy('date')->orderBy('id')->paginate(50);

            return $this->success($entries);
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation entries failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao listar lancamentos do extrato.', 500);
        }
    }

    // ─── Match Entry ──────────────────────────────────

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
            'reconciled_by' => 'manual',
            'reconciled_at' => now(),
            'reconciled_by_user_id' => $request->user()?->id,
        ]);
        $this->syncMatchedEntries($entry);

        event(new ReconciliationUpdated($tenantId, 'match', ['entry_id' => $entryId]));

        return $this->success($entry->fresh('matched'), 'Lancamento conciliado');
    }

    // ─── Ignore Entry ─────────────────────────────────

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

    // ─── F5: Unmatch Entry ────────────────────────────

    public function unmatchEntry(Request $request, int $entryId): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $entry = BankStatementEntry::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($entryId);

        if ($entry->status !== BankStatementEntry::STATUS_MATCHED) {
            return $this->error('Somente lancamentos conciliados podem ser desfeitos.', 422);
        }

        $entry->update([
            'status' => BankStatementEntry::STATUS_PENDING,
            'matched_type' => null,
            'matched_id' => null,
        ]);
        $this->syncMatchedEntries($entry);

        event(new ReconciliationUpdated($tenantId, 'unmatch', ['entry_id' => $entryId]));

        return $this->success($entry, 'Conciliação desfeita');
    }

    // ─── F6: Delete Statement ─────────────────────────

    public function destroyStatement(Request $request, int $statementId): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $statement = BankStatement::query()
            ->where('tenant_id', $tenantId)
            ->find($statementId);

        if (!$statement) {
            return $this->error('Extrato não encontrado.', 404);
        }

        try {
            DB::beginTransaction();

            $matchedCount = $statement->entries()
                ->where('status', BankStatementEntry::STATUS_MATCHED)
                ->count();

            // Delete all entries first, then the statement
            $statement->entries()->delete();
            $statement->delete();

            DB::commit();

            return $this->success([
                'deleted_entries' => $statement->total_entries,
                'had_matched'    => $matchedCount,
            ], 'Extrato excluído com sucesso');
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Bank reconciliation delete failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao excluir extrato.', 500);
        }
    }

    // ─── F4: Suggestions ──────────────────────────────

    public function suggestions(Request $request, int $entryId): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $entry = BankStatementEntry::query()
                ->where('tenant_id', $tenantId)
                ->findOrFail($entryId);

            $suggestions = $this->reconciliationService->getSuggestions($entry);

            return $this->success($suggestions);
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation suggestions failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao buscar sugestões.', 500);
        }
    }

    // ─── F2: Search Financials ────────────────────────

    public function searchFinancials(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $validator = Validator::make($request->all(), [
                'q'    => ['required', 'string', 'min:2', 'max:100'],
                'type' => ['required', 'string', 'in:receivable,payable'],
            ]);

            if ($validator->fails()) {
                return $this->error('Parâmetros inválidos.', 422, $validator->errors());
            }

            $results = $this->reconciliationService->searchFinancials(
                $tenantId,
                $request->input('type'),
                $request->input('q')
            );

            return $this->success($results);
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation search failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao buscar títulos.', 500);
        }
    }

    // ─── F8: Bulk Actions ─────────────────────────────

    public function bulkAction(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validator = Validator::make($request->all(), [
            'action'    => ['required', 'string', 'in:auto-match,ignore,unmatch'],
            'entry_ids' => ['required', 'array', 'min:1', 'max:200'],
            'entry_ids.*' => ['integer', 'min:1'],
        ]);

        if ($validator->fails()) {
            return $this->error('Dados inválidos.', 422, $validator->errors());
        }

        $action = $request->input('action');
        $entryIds = $request->input('entry_ids');

        try {
            DB::beginTransaction();

            $entries = BankStatementEntry::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('id', $entryIds)
                ->get();

            $processed = 0;
            $statementIds = [];

            foreach ($entries as $entry) {
                $statementIds[$entry->bank_statement_id] = true;

                if ($action === 'ignore' && $entry->status !== BankStatementEntry::STATUS_IGNORED) {
                    $entry->update([
                        'status' => BankStatementEntry::STATUS_IGNORED,
                        'matched_type' => null,
                        'matched_id' => null,
                    ]);
                    $processed++;
                } elseif ($action === 'unmatch' && $entry->status === BankStatementEntry::STATUS_MATCHED) {
                    $entry->update([
                        'status' => BankStatementEntry::STATUS_PENDING,
                        'matched_type' => null,
                        'matched_id' => null,
                    ]);
                    $processed++;
                } elseif ($action === 'auto-match' && $entry->status === BankStatementEntry::STATUS_PENDING) {
                    // Attempt auto-match for this single entry
                    $suggestions = $this->reconciliationService->getSuggestions($entry, 1);
                    if (!empty($suggestions) && $suggestions[0]['score'] >= 70) {
                        $entry->update([
                            'matched_type' => $suggestions[0]['type'],
                            'matched_id' => $suggestions[0]['id'],
                            'status' => BankStatementEntry::STATUS_MATCHED,
                        ]);
                        $processed++;
                    }
                }
            }

            // Sync matched counts for affected statements
            foreach (array_keys($statementIds) as $stmtId) {
                BankStatement::where('id', $stmtId)->update([
                    'matched_entries' => BankStatementEntry::where('bank_statement_id', $stmtId)
                        ->where('status', BankStatementEntry::STATUS_MATCHED)
                        ->count(),
                ]);
            }

            DB::commit();

            return $this->success([
                'processed' => $processed,
                'total'     => count($entryIds),
            ], "Ação em lote executada: {$processed} lançamentos processados");
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Bank reconciliation bulk action failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao executar ação em lote.', 500);
        }
    }

    // ─── F9: Export Statement ─────────────────────────

    public function exportStatement(Request $request, int $statementId): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $statement = BankStatement::query()
                ->where('tenant_id', $tenantId)
                ->with(['bankAccount:id,name,bank_name', 'creator:id,name'])
                ->find($statementId);

            if (!$statement) {
                return $this->error('Extrato não encontrado.', 404);
            }

            $entries = $statement->entries()
                ->with('matched')
                ->orderBy('date')
                ->orderBy('id')
                ->get();

            $totalCredits = $entries->where('type', 'credit')->sum('amount');
            $totalDebits = $entries->where('type', 'debit')->sum('amount');
            $matchedCount = $entries->where('status', BankStatementEntry::STATUS_MATCHED)->count();
            $pendingCount = $entries->where('status', BankStatementEntry::STATUS_PENDING)->count();
            $ignoredCount = $entries->where('status', BankStatementEntry::STATUS_IGNORED)->count();

            $exportData = [
                'statement' => [
                    'id'             => $statement->id,
                    'filename'       => $statement->filename,
                    'format'         => $statement->format,
                    'imported_at'    => $statement->imported_at?->toDateTimeString(),
                    'created_by'     => $statement->creator?->name,
                    'bank_account'   => $statement->bankAccount ? "{$statement->bankAccount->bank_name} - {$statement->bankAccount->name}" : null,
                ],
                'summary' => [
                    'total_entries'  => $entries->count(),
                    'matched_count'  => $matchedCount,
                    'pending_count'  => $pendingCount,
                    'ignored_count'  => $ignoredCount,
                    'total_credits'  => round((float) $totalCredits, 2),
                    'total_debits'   => round((float) $totalDebits, 2),
                    'net_balance'    => round((float) $totalCredits - (float) $totalDebits, 2),
                ],
                'entries' => $entries->map(fn($e) => [
                    'date'        => $e->date?->toDateString(),
                    'description' => $e->description,
                    'type'        => $e->type,
                    'amount'      => (float) $e->amount,
                    'status'      => $e->status,
                    'matched_to'  => $e->matched ? class_basename($e->matched_type) . " #{$e->matched_id}" : null,
                    'possible_duplicate' => $e->possible_duplicate,
                    'category'    => $e->category,
                    'reconciled_by' => $e->reconciled_by,
                ])->toArray(),
            ];

            return $this->success($exportData, 'Dados de exportação gerados');
        } catch (\Throwable $e) {
            Log::error('Bank reconciliation export failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao exportar extrato.', 500);
        }
    }

    // ─── Suggest Rule (learn from manual match) ──────

    public function suggestRule(Request $request, int $entryId): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $entry = BankStatementEntry::where('tenant_id', $tenantId)->findOrFail($entryId);

            $suggestion = $this->reconciliationService->learnRule($entry);

            if (!$suggestion) {
                return $this->error('Lançamento não está conciliado.', 422);
            }

            return $this->success($suggestion, 'Sugestão de regra gerada');
        } catch (\Throwable $e) {
            Log::error('Suggest rule failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao sugerir regra.', 500);
        }
    }

    // ─── Entry History (audit trail) ─────────────────

    public function entryHistory(Request $request, int $entryId): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $entry = BankStatementEntry::where('tenant_id', $tenantId)
                ->with(['rule:id,name', 'reconciledByUser:id,name', 'matched', 'statement:id,filename'])
                ->findOrFail($entryId);

            return $this->success([
                'id' => $entry->id,
                'description' => $entry->description,
                'amount' => (float) $entry->amount,
                'type' => $entry->type,
                'status' => $entry->status,
                'category' => $entry->category,
                'possible_duplicate' => $entry->possible_duplicate,
                'reconciled_by' => $entry->reconciled_by,
                'reconciled_at' => $entry->reconciled_at?->toIso8601String(),
                'reconciled_by_user' => $entry->reconciledByUser?->name,
                'rule_name' => $entry->rule?->name,
                'matched_type' => $entry->matched_type ? class_basename($entry->matched_type) : null,
                'matched_id' => $entry->matched_id,
                'statement_filename' => $entry->statement?->filename,
            ]);
        } catch (\Throwable $e) {
            Log::error('Entry history failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao buscar histórico.', 500);
        }
    }
    // ─── Dashboard Data (Fase 2) ─────────────────────

    public function dashboardData(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $bankAccountId = $request->integer('bank_account_id') ?: null;
            $startDate = $request->string('start_date')->value() ?: now()->subDays(30)->toDateString();
            $endDate = $request->string('end_date')->value() ?: now()->toDateString();

            $entriesQuery = BankStatementEntry::where('tenant_id', $tenantId)
                ->whereBetween('date', [$startDate, $endDate]);

            if ($bankAccountId) {
                $entriesQuery->whereHas('statement', fn ($q) => $q->where('bank_account_id', $bankAccountId));
            }

            // KPIs
            $totalEntries = (clone $entriesQuery)->count();
            $pending = (clone $entriesQuery)->where('status', 'pending')->count();
            $matched = (clone $entriesQuery)->where('status', 'matched')->count();
            $ignored = (clone $entriesQuery)->where('status', 'ignored')->count();
            $totalCredits = (float) (clone $entriesQuery)->where('type', 'credit')->sum('amount');
            $totalDebits = (float) (clone $entriesQuery)->where('type', 'debit')->sum('amount');
            $autoMatched = (clone $entriesQuery)->whereIn('reconciled_by', ['auto', 'rule'])->count();

            // Distribution by status (pie chart)
            $statusDistribution = [
                ['name' => 'Pendentes', 'value' => $pending, 'color' => '#f59e0b'],
                ['name' => 'Conciliados', 'value' => $matched, 'color' => '#10b981'],
                ['name' => 'Ignorados', 'value' => $ignored, 'color' => '#6b7280'],
            ];

            $isSqlite = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'sqlite';

            // Credits vs Debits by week (bar chart)
            $weekRaw = $isSqlite
                ? "strftime('%Y-%W', date) as week_num, type, SUM(amount) as total"
                : "YEARWEEK(date, 1) as week_num, type, SUM(amount) as total";

            $weeklyData = (clone $entriesQuery)
                ->selectRaw($weekRaw)
                ->groupBy('week_num', 'type')
                ->orderBy('week_num')
                ->get()
                ->groupBy('week_num')
                ->map(function ($group, $weekNum) {
                    $credits = (float) $group->where('type', 'credit')->sum('total');
                    $debits = (float) $group->where('type', 'debit')->sum('total');
                    return [
                        'week' => 'S' . substr($weekNum, -2),
                        'credits' => round($credits, 2),
                        'debits' => round($debits, 2),
                    ];
                })
                ->values();

            // Reconciliation progress over time (area chart)
            $dayRaw = $isSqlite
                ? "date as day, status, COUNT(*) as cnt"
                : "DATE(date) as day, status, COUNT(*) as cnt";

            $dailyProgress = (clone $entriesQuery)
                ->selectRaw($dayRaw)
                ->groupBy('day', 'status')
                ->orderBy('day')
                ->get()
                ->groupBy('day')
                ->map(function ($group, $day) {
                    return [
                        'day' => $day,
                        'pending' => (int) $group->where('status', 'pending')->sum('cnt'),
                        'matched' => (int) $group->where('status', 'matched')->sum('cnt'),
                        'ignored' => (int) $group->where('status', 'ignored')->sum('cnt'),
                    ];
                })
                ->values();

            // Top categories (when categorized)
            $categories = (clone $entriesQuery)
                ->whereNotNull('category')
                ->selectRaw('category, COUNT(*) as total, SUM(amount) as amount_sum')
                ->groupBy('category')
                ->orderByDesc('total')
                ->limit(10)
                ->get()
                ->map(fn ($row) => [
                    'category' => $row->category,
                    'count' => (int) $row->total,
                    'amount' => round((float) $row->amount_sum, 2),
                ]);

            // Top unreconciled entries
            $topUnreconciled = (clone $entriesQuery)
                ->where('status', 'pending')
                ->orderByDesc('amount')
                ->limit(10)
                ->get(['id', 'date', 'description', 'amount', 'type'])
                ->map(fn ($e) => [
                    'id' => $e->id,
                    'date' => $e->date,
                    'description' => $e->description,
                    'amount' => (float) $e->amount,
                    'type' => $e->type,
                ]);

            // Reconciliation rate
            $rate = $totalEntries > 0 ? round(($matched / $totalEntries) * 100, 1) : 0;

            return $this->success([
                'kpis' => [
                    'total_entries' => $totalEntries,
                    'pending' => $pending,
                    'matched' => $matched,
                    'ignored' => $ignored,
                    'auto_matched' => $autoMatched,
                    'total_credits' => round($totalCredits, 2),
                    'total_debits' => round($totalDebits, 2),
                    'reconciliation_rate' => $rate,
                ],
                'status_distribution' => $statusDistribution,
                'weekly_data' => $weeklyData,
                'daily_progress' => $dailyProgress,
                'categories' => $categories,
                'top_unreconciled' => $topUnreconciled,
            ]);
        } catch (\Throwable $e) {
            Log::error('Dashboard data failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao carregar dados do dashboard.', 500);
        }
    }

    public function exportPdf(Request $request, int $id): \Illuminate\Http\Response
    {
        try {
            $tenantId = $this->tenantId($request);
            $statement = BankStatement::where('tenant_id', $tenantId)->findOrFail($id);

            $pdf = $this->reconciliationService->generatePdfReport($statement);

            return $pdf->download("conciliacao-{$statement->filename}.pdf");
        } catch (\Throwable $e) {
            Log::error('PDF export failed', ['error' => $e->getMessage()]);
            abort(500, 'Erro ao gerar PDF.');
        }
    }
}
