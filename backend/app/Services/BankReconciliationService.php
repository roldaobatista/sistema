<?php

namespace App\Services;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use Illuminate\Support\Facades\DB;

class BankReconciliationService
{
    public function importOfx(int $tenantId, string $filePath, int $userId, ?string $originalFilename = null): BankStatement
    {
        $content = file_get_contents($filePath);
        $entries = $this->parseOfx($content);

        return DB::transaction(function () use ($tenantId, $filePath, $userId, $entries, $originalFilename) {
            $statement = BankStatement::create([
                'tenant_id' => $tenantId,
                'filename' => $originalFilename ?: basename($filePath),
                'imported_at' => now(),
                'created_by' => $userId,
                'total_entries' => count($entries),
                'matched_entries' => 0,
            ]);

            foreach ($entries as $entry) {
                BankStatementEntry::create([
                    'bank_statement_id' => $statement->id,
                    'tenant_id' => $tenantId,
                    'date' => $entry['date'],
                    'description' => $entry['description'],
                    'amount' => abs($entry['amount']),
                    'type' => $entry['amount'] >= 0 ? 'credit' : 'debit',
                    'status' => BankStatementEntry::STATUS_PENDING,
                ]);
            }

            return $statement;
        });
    }

    public function autoMatch(BankStatement $statement): int
    {
        $matched = 0;
        $entries = $statement->entries()->where('status', BankStatementEntry::STATUS_PENDING)->get();

        foreach ($entries as $entry) {
            if ($entry->type === 'credit') {
                // Créditos → Contas a Receber
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
                        'matched_id' => $ar->id,
                        'status' => BankStatementEntry::STATUS_MATCHED,
                    ]);
                    $matched++;
                }
            } elseif ($entry->type === 'debit') {
                // Débitos → Contas a Pagar
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
                        'matched_id' => $ap->id,
                        'status' => BankStatementEntry::STATUS_MATCHED,
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

    private function parseOfx(string $content): array
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
}
