<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use App\Models\CollectionRule;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class FinanceAdvancedController extends Controller
{
    // ─── #9B Importação CNAB 240/400 ────────────────────────────

    public function importCnab(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:txt,rem,ret|max:10240',
            'layout' => 'required|string|in:cnab240,cnab400',
            'type' => 'required|string|in:retorno,remessa',
        ]);

        $tenantId = $request->user()->company_id;
        $file = $request->file('file');
        $layout = $request->input('layout');
        $type = $request->input('type');
        $lines = file($file->getRealPath(), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        $results = ['processed' => 0, 'matched' => 0, 'errors' => []];

        if ($type === 'retorno') {
            foreach ($lines as $index => $line) {
                if ($layout === 'cnab240' && strlen($line) !== 240) continue;
                if ($layout === 'cnab400' && strlen($line) !== 400) continue;

                try {
                    $parsed = $layout === 'cnab240'
                        ? $this->parseCnab240Line($line)
                        : $this->parseCnab400Line($line);

                    if (!$parsed) continue;
                    $results['processed']++;

                    // Match by nosso_numero or document
                    $receivable = AccountReceivable::where('company_id', $tenantId)
                        ->where(function ($q) use ($parsed) {
                            $q->where('nosso_numero', $parsed['nosso_numero'])
                              ->orWhere('numero_documento', $parsed['documento']);
                        })
                        ->first();

                    if ($receivable) {
                        $receivable->update([
                            'status' => $parsed['status'] === 'paid' ? 'PAGO' : $receivable->status,
                            'data_pagamento' => $parsed['data_pagamento'],
                            'valor_pago' => $parsed['valor_pago'],
                            'valor_juros' => $parsed['juros'] ?? 0,
                            'valor_desconto' => $parsed['desconto'] ?? 0,
                            'cnab_import_date' => now(),
                        ]);
                        $results['matched']++;
                    }
                } catch (\Throwable $e) {
                    $results['errors'][] = "Line {$index}: {$e->getMessage()}";
                }
            }
        }

        return response()->json([
            'message' => "CNAB {$layout} imported",
            'data' => $results,
        ]);
    }

    // ─── #10 Fluxo de Caixa Projetado ───────────────────────────

    public function cashFlowProjection(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $months = $request->input('months', 6);
        $startDate = Carbon::now();

        $projection = [];

        for ($i = 0; $i < $months; $i++) {
            $monthStart = $startDate->copy()->addMonths($i)->startOfMonth();
            $monthEnd = $monthStart->copy()->endOfMonth();
            $label = $monthStart->format('Y-m');

            $receivables = AccountReceivable::where('company_id', $tenantId)
                ->where('status', '!=', 'PAGO')
                ->whereBetween('data_vencimento', [$monthStart, $monthEnd])
                ->sum('valor');

            $payables = AccountPayable::where('company_id', $tenantId)
                ->where('status', '!=', 'PAGO')
                ->whereBetween('data_vencimento', [$monthStart, $monthEnd])
                ->sum('valor');

            // Recurring contracts revenue
            $recurring = DB::table('recurring_contracts')
                ->where('company_id', $tenantId)
                ->where('status', 'active')
                ->where('start_date', '<=', $monthEnd)
                ->where(function ($q) use ($monthStart) {
                    $q->whereNull('end_date')->orWhere('end_date', '>=', $monthStart);
                })
                ->sum('monthly_value');

            $projection[] = [
                'month' => $label,
                'receivables' => round($receivables, 2),
                'payables' => round($payables, 2),
                'recurring_revenue' => round($recurring, 2),
                'net_projection' => round($receivables + $recurring - $payables, 2),
            ];
        }

        // Current balance (sum of paid receivables - paid payables this month)
        $currentBalance = AccountReceivable::where('company_id', $tenantId)
            ->where('status', 'PAGO')
            ->whereMonth('data_pagamento', now()->month)
            ->sum('valor_pago')
            - AccountPayable::where('company_id', $tenantId)
            ->where('status', 'PAGO')
            ->whereMonth('data_pagamento', now()->month)
            ->sum('valor_pago');

        return response()->json([
            'current_balance' => round($currentBalance, 2),
            'projection' => $projection,
        ]);
    }

    // ─── #11 Régua de Cobrança Automatizada ─────────────────────

    public function collectionRules(Request $request): JsonResponse
    {
        $rules = CollectionRule::where('company_id', $request->user()->company_id)
            ->orderBy('days_before_due')
            ->get();

        return response()->json($rules);
    }

    public function storeCollectionRule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'days_before_due' => 'required|integer', // negative = after due
            'channel' => 'required|string|in:email,whatsapp,sms,notification',
            'template' => 'required|string',
            'is_active' => 'boolean',
        ]);

        $data['company_id'] = $request->user()->company_id;
        $rule = CollectionRule::create($data);

        return response()->json($rule, 201);
    }

    public function updateCollectionRule(Request $request, CollectionRule $rule): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'days_before_due' => 'sometimes|integer',
            'channel' => 'sometimes|string|in:email,whatsapp,sms,notification',
            'template' => 'sometimes|string',
            'is_active' => 'boolean',
        ]);

        $rule->update($data);
        return response()->json($rule);
    }

    public function deleteCollectionRule(CollectionRule $rule): JsonResponse
    {
        $rule->delete();
        return response()->json(['message' => 'Rule deleted']);
    }

    public function runCollection(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $rules = CollectionRule::where('company_id', $tenantId)->where('is_active', true)->get();

        $sent = 0;
        foreach ($rules as $rule) {
            $targetDate = $rule->days_before_due >= 0
                ? now()->addDays($rule->days_before_due)->toDateString()
                : now()->subDays(abs($rule->days_before_due))->toDateString();

            $receivables = AccountReceivable::where('company_id', $tenantId)
                ->where('status', '!=', 'PAGO')
                ->whereDate('data_vencimento', $targetDate)
                ->with('customer')
                ->get();

            foreach ($receivables as $ar) {
                // Log the collection action (actual sending via channel service)
                DB::table('collection_logs')->insert([
                    'company_id' => $tenantId,
                    'account_receivable_id' => $ar->id,
                    'collection_rule_id' => $rule->id,
                    'channel' => $rule->channel,
                    'status' => 'sent',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $sent++;
            }
        }

        return response()->json(['message' => "{$sent} collection actions executed", 'sent' => $sent]);
    }

    // ─── #12B Pagamento Parcial de Conta ────────────────────────

    public function partialPayment(Request $request, AccountReceivable $receivable): JsonResponse
    {
        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'payment_method' => 'nullable|string',
            'notes' => 'nullable|string|max:500',
        ]);

        $amount = $request->input('amount');
        $remaining = $receivable->valor - ($receivable->valor_pago ?? 0);

        if ($amount > $remaining) {
            return response()->json(['message' => 'Amount exceeds remaining balance'], 422);
        }

        DB::beginTransaction();
        try {
            // Record partial payment
            DB::table('partial_payments')->insert([
                'company_id' => $receivable->company_id,
                'account_receivable_id' => $receivable->id,
                'amount' => $amount,
                'payment_date' => $request->input('payment_date'),
                'payment_method' => $request->input('payment_method'),
                'notes' => $request->input('notes'),
                'created_by' => $request->user()->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $newPaid = ($receivable->valor_pago ?? 0) + $amount;
            $status = $newPaid >= $receivable->valor ? 'PAGO' : 'PARCIAL';

            $receivable->update([
                'valor_pago' => $newPaid,
                'status' => $status,
                'data_pagamento' => $status === 'PAGO' ? $request->input('payment_date') : null,
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error processing payment', 'error' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Partial payment of {$amount} recorded",
            'remaining' => round($receivable->valor - $newPaid, 2),
            'status' => $status,
        ]);
    }

    // ─── #13 DRE por Centro de Custo ────────────────────────────

    public function dreByCostCenter(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $from = $request->input('from', now()->startOfYear()->toDateString());
        $to = $request->input('to', now()->toDateString());

        $revenue = DB::table('account_receivables')
            ->where('company_id', $tenantId)
            ->where('status', 'PAGO')
            ->whereBetween('data_pagamento', [$from, $to])
            ->selectRaw('cost_center, SUM(valor_pago) as total')
            ->groupBy('cost_center')
            ->get()
            ->keyBy('cost_center');

        $expenses = DB::table('account_payables')
            ->where('company_id', $tenantId)
            ->where('status', 'PAGO')
            ->whereBetween('data_pagamento', [$from, $to])
            ->selectRaw('cost_center, SUM(valor_pago) as total')
            ->groupBy('cost_center')
            ->get()
            ->keyBy('cost_center');

        $centers = $revenue->keys()->merge($expenses->keys())->unique();

        $dre = $centers->map(function ($center) use ($revenue, $expenses) {
            $rev = $revenue[$center]->total ?? 0;
            $exp = $expenses[$center]->total ?? 0;
            return [
                'cost_center' => $center ?? 'Sem Centro',
                'revenue' => round($rev, 2),
                'expenses' => round($exp, 2),
                'profit' => round($rev - $exp, 2),
                'margin' => $rev > 0 ? round((($rev - $exp) / $rev) * 100, 1) : 0,
            ];
        })->values();

        $totals = [
            'revenue' => $dre->sum('revenue'),
            'expenses' => $dre->sum('expenses'),
            'profit' => $dre->sum('profit'),
        ];
        $totals['margin'] = $totals['revenue'] > 0
            ? round(($totals['profit'] / $totals['revenue']) * 100, 1) : 0;

        return response()->json(['dre' => $dre, 'totals' => $totals]);
    }

    // ─── #14 Parcelamento Inteligente ───────────────────────────

    public function simulateInstallments(Request $request): JsonResponse
    {
        $request->validate([
            'total_amount' => 'required|numeric|min:0.01',
            'installments' => 'required|integer|min:1|max:120',
            'interest_rate' => 'nullable|numeric|min:0',
            'first_due_date' => 'required|date|after:today',
        ]);

        $total = $request->input('total_amount');
        $n = $request->input('installments');
        $rate = $request->input('interest_rate', 0) / 100;
        $firstDue = Carbon::parse($request->input('first_due_date'));

        $installments = [];
        if ($rate > 0) {
            // Price table (PMT formula)
            $pmt = $total * ($rate * pow(1 + $rate, $n)) / (pow(1 + $rate, $n) - 1);
            $balance = $total;

            for ($i = 1; $i <= $n; $i++) {
                $interest = $balance * $rate;
                $principal = $pmt - $interest;
                $balance -= $principal;

                $installments[] = [
                    'number' => $i,
                    'due_date' => $firstDue->copy()->addMonths($i - 1)->toDateString(),
                    'amount' => round($pmt, 2),
                    'principal' => round($principal, 2),
                    'interest' => round($interest, 2),
                    'balance' => round(max(0, $balance), 2),
                ];
            }
        } else {
            $base = floor($total * 100 / $n) / 100;
            $remainder = round($total - ($base * $n), 2);

            for ($i = 1; $i <= $n; $i++) {
                $amt = $i === $n ? $base + $remainder : $base;
                $installments[] = [
                    'number' => $i,
                    'due_date' => $firstDue->copy()->addMonths($i - 1)->toDateString(),
                    'amount' => round($amt, 2),
                    'principal' => round($amt, 2),
                    'interest' => 0,
                    'balance' => round($total - ($base * $i + ($i === $n ? $remainder : 0)), 2),
                ];
            }
        }

        return response()->json([
            'total_amount' => round($total, 2),
            'total_with_interest' => round(collect($installments)->sum('amount'), 2),
            'interest_rate' => $rate * 100,
            'installments' => $installments,
        ]);
    }

    public function createInstallments(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'description' => 'required|string|max:255',
            'installments' => 'required|array|min:1',
            'installments.*.due_date' => 'required|date',
            'installments.*.amount' => 'required|numeric|min:0.01',
        ]);

        $tenantId = $request->user()->company_id;
        $created = [];

        DB::beginTransaction();
        try {
            foreach ($request->input('installments') as $i => $inst) {
                $ar = AccountReceivable::create([
                    'company_id' => $tenantId,
                    'customer_id' => $request->input('customer_id'),
                    'descricao' => $request->input('description') . " ({$inst['number']}/{$request->input('installments_count', count($request->input('installments')))})",
                    'valor' => $inst['amount'],
                    'data_vencimento' => $inst['due_date'],
                    'status' => 'ABERTO',
                    'parcela' => ($i + 1) . '/' . count($request->input('installments')),
                    'created_by' => $request->user()->id,
                ]);
                $created[] = $ar->id;
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error creating installments', 'error' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => count($created) . ' installments created',
            'ids' => $created,
        ], 201);
    }

    // ─── #15 Dashboard de Inadimplência ─────────────────────────

    public function delinquencyDashboard(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;

        $overdue = AccountReceivable::where('company_id', $tenantId)
            ->where('status', '!=', 'PAGO')
            ->where('data_vencimento', '<', now());

        $total = $overdue->sum('valor');
        $count = $overdue->count();

        // Aging buckets
        $buckets = [
            '1-30' => (clone $overdue)->where('data_vencimento', '>=', now()->subDays(30))->sum('valor'),
            '31-60' => (clone $overdue)->whereBetween('data_vencimento', [now()->subDays(60), now()->subDays(31)])->sum('valor'),
            '61-90' => (clone $overdue)->whereBetween('data_vencimento', [now()->subDays(90), now()->subDays(61)])->sum('valor'),
            '90+' => (clone $overdue)->where('data_vencimento', '<', now()->subDays(90))->sum('valor'),
        ];

        // Top delinquent customers
        $topCustomers = AccountReceivable::where('company_id', $tenantId)
            ->where('status', '!=', 'PAGO')
            ->where('data_vencimento', '<', now())
            ->join('customers', 'account_receivables.customer_id', '=', 'customers.id')
            ->selectRaw('customers.id, customers.nome_fantasia as name, SUM(account_receivables.valor) as total_due, COUNT(*) as count')
            ->groupBy('customers.id', 'customers.nome_fantasia')
            ->orderByDesc('total_due')
            ->limit(10)
            ->get();

        // Trend (last 6 months)
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $monthStart = now()->subMonths($i)->startOfMonth();
            $monthEnd = $monthStart->copy()->endOfMonth();
            $trend[] = [
                'month' => $monthStart->format('Y-m'),
                'total' => round(AccountReceivable::where('company_id', $tenantId)
                    ->where('status', '!=', 'PAGO')
                    ->where('data_vencimento', '<', $monthEnd)
                    ->where('created_at', '<=', $monthEnd)
                    ->sum('valor'), 2),
            ];
        }

        // Delinquency rate
        $totalReceivables = AccountReceivable::where('company_id', $tenantId)
            ->where('status', '!=', 'PAGO')
            ->sum('valor');
        $rate = $totalReceivables > 0 ? round(($total / $totalReceivables) * 100, 1) : 0;

        return response()->json([
            'total_overdue' => round($total, 2),
            'overdue_count' => $count,
            'delinquency_rate' => $rate,
            'aging_buckets' => $buckets,
            'top_customers' => $topCustomers,
            'trend' => $trend,
        ]);
    }

    // ─── CNAB Parsers ───────────────────────────────────────────

    private function parseCnab240Line(string $line): ?array
    {
        $segmento = substr($line, 13, 1);
        if ($segmento !== 'T' && $segmento !== 'U') return null;

        if ($segmento === 'T') {
            return [
                'nosso_numero' => trim(substr($line, 37, 20)),
                'documento' => trim(substr($line, 58, 15)),
                'valor' => (int) substr($line, 81, 15) / 100,
                'status' => $this->parseCnab240Status(substr($line, 15, 2)),
            ];
        }

        return [
            'data_pagamento' => $this->parseCnabDate(substr($line, 137, 8)),
            'valor_pago' => (int) substr($line, 77, 15) / 100,
            'juros' => (int) substr($line, 17, 15) / 100,
            'desconto' => (int) substr($line, 32, 15) / 100,
            'status' => 'paid',
        ];
    }

    private function parseCnab400Line(string $line): ?array
    {
        $tipo = substr($line, 0, 1);
        if ($tipo !== '1') return null;

        return [
            'nosso_numero' => trim(substr($line, 62, 10)),
            'documento' => trim(substr($line, 116, 10)),
            'data_pagamento' => $this->parseCnabDate(substr($line, 295, 6)),
            'valor_pago' => (int) substr($line, 253, 13) / 100,
            'juros' => (int) substr($line, 266, 13) / 100,
            'desconto' => (int) substr($line, 240, 13) / 100,
            'status' => 'paid',
        ];
    }

    private function parseCnab240Status(string $code): string
    {
        return match ($code) {
            '06', '17' => 'paid',
            '02' => 'registered',
            '09' => 'rejected',
            default => 'unknown',
        };
    }

    private function parseCnabDate(string $raw): ?string
    {
        if (strlen($raw) === 8) {
            return Carbon::createFromFormat('dmY', $raw)?->toDateString();
        }
        if (strlen($raw) === 6) {
            return Carbon::createFromFormat('dmy', $raw)?->toDateString();
        }
        return null;
    }
}
