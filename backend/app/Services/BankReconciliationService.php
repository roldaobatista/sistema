<?php

namespace App\Services;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\ReconciliationRule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BankReconciliationService
{
    /**
     * Import a bank statement file (OFX, CNAB 240, CNAB 400).
     */
    public function import(int $tenantId, string $filePath, int $userId, ?string $originalFilename = null, ?int $bankAccountId = null): BankStatement
    {
        $content = file_get_contents($filePath);
        $format = $this->detectFormat($content, $originalFilename);
        $entries = match ($format) {
            'cnab240' => $this->parseCnab240($content),
            'cnab400' => $this->parseCnab400($content),
            default   => $this->parseOfx($content),
        };

        return DB::transaction(function () use ($tenantId, $originalFilename, $userId, $entries, $format, $filePath, $bankAccountId) {
            $statement = BankStatement::create([
                'tenant_id'       => $tenantId,
                'bank_account_id' => $bankAccountId,
                'filename'        => $originalFilename ?: basename($filePath),
                'format'          => $format,
                'imported_at'     => now(),
                'created_by'      => $userId,
                'total_entries'   => count($entries),
                'matched_entries' => 0,
            ]);

            foreach ($entries as $entry) {
                $isDuplicate = $this->checkDuplicate($tenantId, $entry, $statement->id);

                BankStatementEntry::create([
                    'bank_statement_id' => $statement->id,
                    'tenant_id'         => $tenantId,
                    'date'              => $entry['date'],
                    'description'       => $entry['description'],
                    'amount'            => abs($entry['amount']),
                    'type'              => $entry['amount'] >= 0 ? 'credit' : 'debit',
                    'status'            => BankStatementEntry::STATUS_PENDING,
                    'possible_duplicate' => $isDuplicate,
                ]);
            }

            // Apply auto-match then rules engine
            $this->autoMatch($statement);
            $this->applyRules($statement);

            return $statement;
        });
    }

    /**
     * Legacy method for backwards compatibility.
     */
    public function importOfx(int $tenantId, string $filePath, int $userId, ?string $originalFilename = null): BankStatement
    {
        return $this->import($tenantId, $filePath, $userId, $originalFilename);
    }

    /**
     * Auto-match pending entries against receivables/payables.
     */
    public function autoMatch(BankStatement $statement): int
    {
        $matched = 0;
        $entries = $statement->entries()->where('status', BankStatementEntry::STATUS_PENDING)->get();

        foreach ($entries as $entry) {
            if ($entry->type === 'credit') {
                $ar = AccountReceivable::where('tenant_id', $entry->tenant_id)
                    ->whereBetween('amount', [$entry->amount - 0.05, $entry->amount + 0.05])
                    ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL])
                    ->whereBetween('due_date', [
                        \Carbon\Carbon::parse($entry->date)->subDays(5),
                        \Carbon\Carbon::parse($entry->date)->addDays(5),
                    ])
                    ->orderBy('due_date')
                    ->first();

                if ($ar) {
                    $entry->update([
                        'matched_type' => AccountReceivable::class,
                        'matched_id'   => $ar->id,
                        'status'       => BankStatementEntry::STATUS_MATCHED,
                    ]);
                    $matched++;
                }
            } elseif ($entry->type === 'debit') {
                $ap = AccountPayable::where('tenant_id', $entry->tenant_id)
                    ->whereBetween('amount', [$entry->amount - 0.05, $entry->amount + 0.05])
                    ->whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL])
                    ->whereBetween('due_date', [
                        \Carbon\Carbon::parse($entry->date)->subDays(5),
                        \Carbon\Carbon::parse($entry->date)->addDays(5),
                    ])
                    ->orderBy('due_date')
                    ->first();

                if ($ap) {
                    $entry->update([
                        'matched_type' => AccountPayable::class,
                        'matched_id'   => $ap->id,
                        'status'       => BankStatementEntry::STATUS_MATCHED,
                    ]);
                    $matched++;
                }
            }
        }

        $statement->update([
            'matched_entries' => $statement->entries()
                ->where('status', BankStatementEntry::STATUS_MATCHED)
                ->count(),
        ]);

        return $matched;
    }

    // ─── F4: Suggestions ──────────────────────────────

    /**
     * Get match suggestions for a single entry, scored by value+date+description similarity.
     */
    public function getSuggestions(BankStatementEntry $entry, int $limit = 5): array
    {
        $candidates = collect();

        if ($entry->type === 'credit') {
            $records = AccountReceivable::where('tenant_id', $entry->tenant_id)
                ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL])
                ->whereBetween('amount', [$entry->amount * 0.8, $entry->amount * 1.2])
                ->orderBy('due_date')
                ->limit(20)
                ->get();

            foreach ($records as $record) {
                $candidates->push([
                    'type'  => AccountReceivable::class,
                    'id'    => $record->id,
                    'description' => $record->description,
                    'amount' => (float) $record->amount,
                    'due_date' => $record->due_date?->toDateString(),
                    'customer' => $record->customer?->name ?? null,
                    'score' => $this->calculateScore($entry, $record),
                ]);
            }
        } elseif ($entry->type === 'debit') {
            $records = AccountPayable::where('tenant_id', $entry->tenant_id)
                ->whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL])
                ->whereBetween('amount', [$entry->amount * 0.8, $entry->amount * 1.2])
                ->orderBy('due_date')
                ->limit(20)
                ->get();

            foreach ($records as $record) {
                $candidates->push([
                    'type'  => AccountPayable::class,
                    'id'    => $record->id,
                    'description' => $record->description,
                    'amount' => (float) $record->amount,
                    'due_date' => $record->due_date?->toDateString(),
                    'customer' => null,
                    'score' => $this->calculateScore($entry, $record),
                ]);
            }
        }

        return $candidates->sortByDesc('score')->take($limit)->values()->toArray();
    }

    private function calculateScore(BankStatementEntry $entry, $record): float
    {
        $score = 0;

        // Value similarity (50% weight) — closer = higher score
        $valueDiff = abs((float) $entry->amount - (float) $record->amount);
        $valueScore = max(0, 50 - ($valueDiff / max((float) $entry->amount, 0.01) * 100));
        $score += $valueScore;

        // Date proximity (30% weight) — closer = higher score
        $entryDate = \Carbon\Carbon::parse($entry->date);
        $dueDate = \Carbon\Carbon::parse($record->due_date);
        $daysDiff = abs($entryDate->diffInDays($dueDate));
        $dateScore = max(0, 30 - ($daysDiff * 3));
        $score += $dateScore;

        // Description similarity (20% weight)
        $entryDesc = mb_strtolower(trim($entry->description ?? ''));
        $recordDesc = mb_strtolower(trim($record->description ?? ''));
        if ($entryDesc && $recordDesc) {
            similar_text($entryDesc, $recordDesc, $percent);
            $score += ($percent / 100) * 20;
        }

        return round($score, 2);
    }

    // ─── F3: Summary ──────────────────────────────────

    /**
     * Get reconciliation summary stats for a tenant.
     */
    public function getSummary(int $tenantId): array
    {
        $entries = BankStatementEntry::where('tenant_id', $tenantId);

        $totalEntries = (clone $entries)->count();
        $pendingCount = (clone $entries)->where('status', BankStatementEntry::STATUS_PENDING)->count();
        $matchedCount = (clone $entries)->where('status', BankStatementEntry::STATUS_MATCHED)->count();
        $ignoredCount = (clone $entries)->where('status', BankStatementEntry::STATUS_IGNORED)->count();

        $totalCredits = (clone $entries)->where('type', 'credit')->sum('amount');
        $totalDebits = (clone $entries)->where('type', 'debit')->sum('amount');

        $duplicateCount = (clone $entries)->where('possible_duplicate', true)->count();

        $matchedPercent = $totalEntries > 0 ? round(($matchedCount / $totalEntries) * 100, 1) : 0;

        return [
            'total_entries'    => $totalEntries,
            'pending_count'    => $pendingCount,
            'matched_count'    => $matchedCount,
            'ignored_count'    => $ignoredCount,
            'matched_percent'  => $matchedPercent,
            'total_credits'    => round((float) $totalCredits, 2),
            'total_debits'     => round((float) $totalDebits, 2),
            'duplicate_count'  => $duplicateCount,
        ];
    }

    // ─── F10: Duplicate Detection ─────────────────────

    /**
     * Check if an entry already exists in previous statements.
     */
    private function checkDuplicate(int $tenantId, array $entry, int $currentStatementId): bool
    {
        $date = $entry['date'];
        $amount = abs($entry['amount']);

        return BankStatementEntry::where('tenant_id', $tenantId)
            ->where('bank_statement_id', '!=', $currentStatementId)
            ->where('date', $date)
            ->whereBetween('amount', [$amount - 0.01, $amount + 0.01])
            ->where('description', $entry['description'] ?? '')
            ->exists();
    }

    // ─── F2: Search Financials ────────────────────────

    /**
     * Search receivables/payables for manual matching.
     */
    public function searchFinancials(int $tenantId, string $type, string $query, int $limit = 10): array
    {
        if ($type === 'receivable') {
            $records = AccountReceivable::where('tenant_id', $tenantId)
                ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL])
                ->where(function ($q) use ($query) {
                    $q->where('description', 'LIKE', "%{$query}%")
                      ->orWhere('amount', 'LIKE', "%{$query}%")
                      ->orWhereHas('customer', function ($cq) use ($query) {
                          $cq->where('name', 'LIKE', "%{$query}%");
                      });
                })
                ->with('customer:id,name')
                ->orderBy('due_date', 'desc')
                ->limit($limit)
                ->get();

            return $records->map(fn($r) => [
                'id'          => $r->id,
                'type'        => AccountReceivable::class,
                'description' => $r->description,
                'amount'      => (float) $r->amount,
                'due_date'    => $r->due_date?->toDateString(),
                'customer'    => $r->customer?->name ?? null,
                'status'      => $r->status,
            ])->toArray();
        }

        $records = AccountPayable::where('tenant_id', $tenantId)
            ->whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL])
            ->where(function ($q) use ($query) {
                $q->where('description', 'LIKE', "%{$query}%")
                  ->orWhere('amount', 'LIKE', "%{$query}%");
            })
            ->orderBy('due_date', 'desc')
            ->limit($limit)
            ->get();

        return $records->map(fn($r) => [
            'id'          => $r->id,
            'type'        => AccountPayable::class,
            'description' => $r->description,
            'amount'      => (float) $r->amount,
            'due_date'    => $r->due_date?->toDateString(),
            'customer'    => null,
            'status'      => $r->status,
        ])->toArray();
    }

    // ─── Rules Engine ─────────────────────────────────

    /**
     * Apply active reconciliation rules to pending entries of a statement.
     * Rules are applied in priority order (lower number = higher priority).
     */
    public function applyRules(BankStatement $statement): int
    {
        $applied = 0;
        $tenantId = $statement->tenant_id;

        $rules = ReconciliationRule::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('priority')
            ->get();

        if ($rules->isEmpty()) {
            return 0;
        }

        $pendingEntries = $statement->entries()
            ->where('status', BankStatementEntry::STATUS_PENDING)
            ->get();

        foreach ($pendingEntries as $entry) {
            foreach ($rules as $rule) {
                if (!$rule->matches($entry)) {
                    continue;
                }

                $updateData = [
                    'reconciled_by' => 'rule',
                    'reconciled_at' => now(),
                    'rule_id' => $rule->id,
                    'category' => $rule->category,
                ];

                if ($rule->action === 'ignore') {
                    $updateData['status'] = BankStatementEntry::STATUS_IGNORED;
                } elseif ($rule->action === 'categorize') {
                    // Only set category, no status change
                } elseif ($rule->action === 'match_receivable' && $rule->target_id) {
                    $updateData['status'] = BankStatementEntry::STATUS_MATCHED;
                    $updateData['matched_type'] = AccountReceivable::class;
                    $updateData['matched_id'] = $rule->target_id;
                } elseif ($rule->action === 'match_payable' && $rule->target_id) {
                    $updateData['status'] = BankStatementEntry::STATUS_MATCHED;
                    $updateData['matched_type'] = AccountPayable::class;
                    $updateData['matched_id'] = $rule->target_id;
                }

                $entry->update($updateData);
                $rule->increment('times_applied');
                $applied++;
                break; // First matching rule wins
            }
        }

        // Sync matched count
        $statement->update([
            'matched_entries' => $statement->entries()
                ->where('status', BankStatementEntry::STATUS_MATCHED)
                ->count(),
        ]);

        return $applied;
    }

    /**
     * Suggest a rule based on a manually matched entry.
     * Returns rule data that can be saved by the user.
     */
    public function learnRule(BankStatementEntry $entry): ?array
    {
        if ($entry->status !== BankStatementEntry::STATUS_MATCHED || !$entry->matched_type) {
            return null;
        }

        // Extract meaningful keywords from description
        $desc = $entry->description;
        $words = preg_split('/[\s\/\-\*]+/', $desc);
        $keywords = array_filter($words, fn($w) => mb_strlen($w) > 3);
        $pattern = implode(' ', array_slice($keywords, 0, 3));

        if (empty($pattern)) {
            $pattern = $desc;
        }

        $action = str_contains($entry->matched_type, 'Receivable') ? 'match_receivable' : 'match_payable';

        return [
            'name' => 'Auto: ' . mb_substr($desc, 0, 60),
            'match_field' => 'description',
            'match_operator' => 'contains',
            'match_value' => mb_strtolower($pattern),
            'action' => $action,
            'target_type' => $entry->matched_type,
            'target_id' => $entry->matched_id,
            'priority' => 50,
        ];
    }

    // ─── Format Detection ─────────────────────────────

    public function detectFormat(string $content, ?string $filename): string
    {
        $ext = $filename ? strtolower(pathinfo($filename, PATHINFO_EXTENSION)) : '';

        if ($ext === 'ofx') {
            return 'ofx';
        }

        $lines = array_filter(explode("\n", $content), fn($l) => trim($l) !== '');
        if (empty($lines)) {
            return 'ofx';
        }

        $firstLine = trim(reset($lines));

        // CNAB 240: records of exactly 240 chars
        if (strlen($firstLine) === 240) {
            return 'cnab240';
        }

        // CNAB 400: records of exactly 400 chars
        if (strlen($firstLine) === 400) {
            return 'cnab400';
        }

        // Check for CNAB via RET/REM extension
        if (in_array($ext, ['ret', 'rem'])) {
            return strlen($firstLine) > 250 ? 'cnab400' : 'cnab240';
        }

        return 'ofx';
    }

    // ─── OFX Parser ────────────────────────────────────

    public function parseOfx(string $content): array
    {
        $entries = [];
        preg_match_all('/<STMTTRN>(.*?)<\/STMTTRN>/s', $content, $matches);

        foreach ($matches[1] ?? [] as $trn) {
            $amount = 0;
            $date = now()->toDateString();
            $description = '';

            if (preg_match('/<TRNAMT>([-\d.]+)/', $trn, $m)) {
                $amount = (float) $m[1];
            }
            if (preg_match('/<DTPOSTED>(\d{8})/', $trn, $m)) {
                $date = substr($m[1], 0, 4) . '-' . substr($m[1], 4, 2) . '-' . substr($m[1], 6, 2);
            }
            if (preg_match('/<MEMO>([^<\r\n]+)/', $trn, $m)) {
                $description = trim($m[1]);
            }

            $entries[] = compact('amount', 'date', 'description');
        }

        return $entries;
    }

    // ─── CNAB 240 Parser ───────────────────────────────

    /**
     * Parse CNAB 240 retorno file (FEBRABAN standard).
     * Segment T = title identification, Segment U = amounts/dates.
     */
    private function parseCnab240(string $content): array
    {
        $entries = [];
        $lines = explode("\n", str_replace("\r", "", $content));
        $segT = null;

        foreach ($lines as $line) {
            if (strlen($line) < 240) continue;

            $recordType = substr($line, 7, 1); // Position 8: record type
            $segmentCode = strtoupper(substr($line, 13, 1)); // Position 14: segment

            // Skip header (0), trailer (9)
            if ($recordType !== '3') continue;

            if ($segmentCode === 'T') {
                // Segment T: identification
                $segT = [
                    'nosso_numero' => trim(substr($line, 37, 20)),
                    'document'     => trim(substr($line, 58, 15)),
                    'due_date'     => $this->parseCnabDate(substr($line, 73, 8)),
                    'amount'       => $this->parseCnabAmount(substr($line, 81, 15)),
                    'description'  => trim(substr($line, 105, 25)),
                ];
            } elseif ($segmentCode === 'U' && $segT !== null) {
                // Segment U: financial details
                $paidAmount = $this->parseCnabAmount(substr($line, 77, 15));
                $payDate = $this->parseCnabDate(substr($line, 137, 8));
                $creditDate = $this->parseCnabDate(substr($line, 145, 8));

                $entries[] = [
                    'date'        => $creditDate ?: $payDate ?: $segT['due_date'],
                    'amount'      => $paidAmount ?: $segT['amount'],
                    'description' => trim($segT['description'] . ' Doc:' . $segT['document']),
                ];

                $segT = null;
            }
        }

        return $entries;
    }

    // ─── CNAB 400 Parser ───────────────────────────────

    /**
     * Parse CNAB 400 retorno file.
     * Type 1 records contain transaction data.
     */
    private function parseCnab400(string $content): array
    {
        $entries = [];
        $lines = explode("\n", str_replace("\r", "", $content));

        foreach ($lines as $line) {
            if (strlen($line) < 400) continue;

            $recordType = substr($line, 0, 1);

            // Type 1 = transaction detail
            if ($recordType !== '1') continue;

            $amount = $this->parseCnabAmount(substr($line, 152, 13));
            $paidAmount = $this->parseCnabAmount(substr($line, 253, 13));
            $creditDate = $this->parseCnabDate(substr($line, 295, 6), 'ddmmyy');
            $dueDate = $this->parseCnabDate(substr($line, 110, 6), 'ddmmyy');
            $document = trim(substr($line, 116, 10));
            $description = trim(substr($line, 31, 12));

            $entries[] = [
                'date'        => $creditDate ?: $dueDate,
                'amount'      => $paidAmount ?: $amount,
                'description' => trim("{$description} Doc:{$document}"),
            ];
        }

        return $entries;
    }

    // ─── CNAB Helpers ──────────────────────────────────

    public function parseCnabDate(string $raw, string $format = 'ddmmyyyy'): ?string
    {
        $raw = trim($raw);
        if (!$raw || $raw === '00000000' || $raw === '000000') {
            return null;
        }

        try {
            if ($format === 'ddmmyy' && strlen($raw) === 6) {
                $day = substr($raw, 0, 2);
                $month = substr($raw, 2, 2);
                $year = (int) substr($raw, 4, 2);
                $year = $year > 50 ? 1900 + $year : 2000 + $year;
                return sprintf('%04d-%s-%s', $year, $month, $day);
            }

            if (strlen($raw) === 8) {
                $day = substr($raw, 0, 2);
                $month = substr($raw, 2, 2);
                $year = substr($raw, 4, 4);
                return "{$year}-{$month}-{$day}";
            }
        } catch (\Throwable $e) {
            Log::warning('CNAB date parse failed', ['raw' => $raw, 'error' => $e->getMessage()]);
        }

        return null;
    }

    public function parseCnabAmount(string $raw): float
    {
        $raw = trim($raw);
        if (!$raw) return 0;

        // CNAB amounts are integer cents (no decimal point)
        return (float) $raw / 100;
    }

    // ─── F8: Export Reports ───────────────────────────

    /**
     * Generate PDF report for a bank statement.
     * @return \Barryvdh\DomPDF\PDF
     */
    public function generatePdfReport(BankStatement $statement)
    {
        $statement->load(['bankAccount', 'creator']);
        
        $entries = $statement->entries()
            ->orderBy('date')
            ->orderBy('id')
            ->get();
        
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('reports.bank-reconciliation', [
            'statement' => $statement,
            'entries' => $entries,
        ]);
        
        return $pdf;
    }
}
