<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class FinanceAdvancedController extends Controller
{
    // ─── #9B Importação CNAB 240/400 ────────────────────────────
    // Nota: o matching por nosso_numero/numero_documento requer campos extras
    // na tabela accounts_receivable. Atualmente tenta correspondência por notes/description.

    public function importCnab(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:txt,rem,ret|max:10240',
            'layout' => 'required|string|in:cnab240,cnab400',
            'type' => 'required|string|in:retorno,remessa',
        ]);

        $tenantId = $request->user()->current_tenant_id;
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

                    // Tenta matching por notes (campo livre) que pode conter nosso_numero
                    $receivable = AccountReceivable::where('tenant_id', $tenantId)
                        ->where(function ($q) use ($parsed) {
                            $q->where('notes', 'like', '%' . $parsed['nosso_numero'] . '%')
                              ->orWhere('notes', 'like', '%' . $parsed['documento'] . '%');
                        })
                        ->first();

                    if ($receivable) {
                        $newAmountPaid = ($receivable->amount_paid ?? 0) + ($parsed['valor_pago'] ?? 0);
                        $newStatus = $newAmountPaid >= $receivable->amount
                            ? AccountReceivable::STATUS_PAID
                            : AccountReceivable::STATUS_PARTIAL;

                        $receivable->update([
                            'status'       => $parsed['status'] === 'paid' ? AccountReceivable::STATUS_PAID : $newStatus,
                            'paid_at'      => $parsed['data_pagamento'],
                            'amount_paid'  => $newAmountPaid,
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
        $tenantId = $request->user()->current_tenant_id;
        $months = $request->input('months', 6);
        $startDate = Carbon::now();

        $projection = [];

        for ($i = 0; $i < $months; $i++) {
            $monthStart = $startDate->copy()->addMonths($i)->startOfMonth();
            $monthEnd = $monthStart->copy()->endOfMonth();
            $label = $monthStart->format('Y-m');

            $receivables = AccountReceivable::where('tenant_id', $tenantId)
                ->where('status', '!=', AccountReceivable::STATUS_PAID)
                ->whereBetween('due_date', [$monthStart, $monthEnd])
                ->sum('amount');

            $payables = AccountPayable::where('tenant_id', $tenantId)
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->whereBetween('due_date', [$monthStart, $monthEnd])
                ->sum('amount');

            $projection[] = [
                'month'            => $label,
                'receivables'      => round($receivables, 2),
                'payables'         => round($payables, 2),
                'net_projection'   => round($receivables - $payables, 2),
            ];
        }

        // Saldo do mês atual (recebidos - pagos)
        $currentBalance = AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', AccountReceivable::STATUS_PAID)
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->sum('amount_paid')
            - AccountPayable::where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->sum('amount_paid');

        return response()->json([
            'current_balance' => round($currentBalance, 2),
            'projection'      => $projection,
        ]);
    }

    // ─── #12B Pagamento Parcial de Conta ────────────────────────

    public function partialPayment(Request $request, AccountReceivable $receivable): JsonResponse
    {
        $request->validate([
            'amount'         => 'required|numeric|min:0.01',
            'payment_date'   => 'required|date',
            'payment_method' => 'nullable|string',
            'notes'          => 'nullable|string|max:500',
        ]);

        $amount = (float) $request->input('amount');
        $currentPaid = (float) ($receivable->amount_paid ?? 0);
        $remaining = round((float) $receivable->amount - $currentPaid, 2);

        if ($amount > $remaining) {
            return response()->json(['message' => 'Valor excede o saldo devedor'], 422);
        }

        DB::beginTransaction();
        try {
            $newPaid = $currentPaid + $amount;
            $newStatus = $newPaid >= (float) $receivable->amount
                ? AccountReceivable::STATUS_PAID
                : AccountReceivable::STATUS_PARTIAL;

            $receivable->update([
                'amount_paid'    => $newPaid,
                'status'         => $newStatus,
                'paid_at'        => $newStatus === AccountReceivable::STATUS_PAID
                    ? $request->input('payment_date')
                    : $receivable->paid_at,
                'payment_method' => $request->input('payment_method') ?? $receivable->payment_method,
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Error processing partial payment: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['error' => 'Erro ao processar pagamento'], 500);
        }

        return response()->json([
            'message'   => "Pagamento parcial de {$amount} registrado",
            'remaining' => round((float) $receivable->amount - $newPaid, 2),
            'status'    => $newStatus,
        ]);
    }

    // ─── #13 DRE por Centro de Custo ────────────────────────────

    public function dreByCostCenter(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $from = $request->input('from', now()->startOfYear()->toDateString());
        $to   = $request->input('to', now()->toDateString());

        $revenue = DB::table('accounts_receivable')
            ->where('tenant_id', $tenantId)
            ->where('status', AccountReceivable::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to])
            ->whereNull('deleted_at')
            ->selectRaw('cost_center, SUM(amount_paid) as total')
            ->groupBy('cost_center')
            ->get()
            ->keyBy('cost_center');

        $expenses = DB::table('accounts_payable')
            ->where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->whereNull('deleted_at')
            ->selectRaw('cost_center, SUM(amount_paid) as total')
            ->groupBy('cost_center')
            ->get()
            ->keyBy('cost_center');

        $centers = $revenue->keys()->merge($expenses->keys())->unique();

        $dre = $centers->map(function ($center) use ($revenue, $expenses) {
            $rev = $revenue[$center]->total ?? 0;
            $exp = $expenses[$center]->total ?? 0;
            return [
                'cost_center' => $center ?? 'Sem Centro',
                'revenue'     => round($rev, 2),
                'expenses'    => round($exp, 2),
                'profit'      => round($rev - $exp, 2),
                'margin'      => $rev > 0 ? round((($rev - $exp) / $rev) * 100, 1) : 0,
            ];
        })->values();

        $totals = [
            'revenue'  => $dre->sum('revenue'),
            'expenses' => $dre->sum('expenses'),
            'profit'   => $dre->sum('profit'),
        ];
        $totals['margin'] = $totals['revenue'] > 0
            ? round(($totals['profit'] / $totals['revenue']) * 100, 1) : 0;

        return response()->json(['dre' => $dre, 'totals' => $totals]);
    }

    // ─── #14 Parcelamento Inteligente ───────────────────────────

    public function simulateInstallments(Request $request): JsonResponse
    {
        $request->validate([
            'total_amount'   => 'required|numeric|min:0.01',
            'installments'   => 'required|integer|min:1|max:120',
            'interest_rate'  => 'nullable|numeric|min:0',
            'first_due_date' => 'required|date|after:today',
        ]);

        $total    = $request->input('total_amount');
        $n        = $request->input('installments');
        $rate     = $request->input('interest_rate', 0) / 100;
        $firstDue = Carbon::parse($request->input('first_due_date'));

        $installments = [];
        if ($rate > 0) {
            $pmt     = $total * ($rate * pow(1 + $rate, $n)) / (pow(1 + $rate, $n) - 1);
            $balance = $total;

            for ($i = 1; $i <= $n; $i++) {
                $interest  = $balance * $rate;
                $principal = $pmt - $interest;
                $balance  -= $principal;

                $installments[] = [
                    'number'    => $i,
                    'due_date'  => $firstDue->copy()->addMonths($i - 1)->toDateString(),
                    'amount'    => round($pmt, 2),
                    'principal' => round($principal, 2),
                    'interest'  => round($interest, 2),
                    'balance'   => round(max(0, $balance), 2),
                ];
            }
        } else {
            $base      = floor($total * 100 / $n) / 100;
            $remainder = round($total - ($base * $n), 2);

            for ($i = 1; $i <= $n; $i++) {
                $amt = $i === $n ? $base + $remainder : $base;
                $installments[] = [
                    'number'    => $i,
                    'due_date'  => $firstDue->copy()->addMonths($i - 1)->toDateString(),
                    'amount'    => round($amt, 2),
                    'principal' => round($amt, 2),
                    'interest'  => 0,
                    'balance'   => round($total - ($base * $i + ($i === $n ? $remainder : 0)), 2),
                ];
            }
        }

        return response()->json([
            'total_amount'         => round($total, 2),
            'total_with_interest'  => round(collect($installments)->sum('amount'), 2),
            'interest_rate'        => $rate * 100,
            'installments'         => $installments,
        ]);
    }

    public function createInstallments(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id'               => 'required|integer|exists:customers,id',
            'description'               => 'required|string|max:255',
            'installments'              => 'required|array|min:1',
            'installments.*.due_date'   => 'required|date',
            'installments.*.amount'     => 'required|numeric|min:0.01',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $created  = [];
        $total    = count($request->input('installments'));

        DB::beginTransaction();
        try {
            foreach ($request->input('installments') as $i => $inst) {
                $ar = AccountReceivable::create([
                    'tenant_id'   => $tenantId,
                    'customer_id' => $request->input('customer_id'),
                    'description' => $request->input('description') . " (" . ($i + 1) . "/{$total})",
                    'amount'      => $inst['amount'],
                    'amount_paid' => 0,
                    'due_date'    => $inst['due_date'],
                    'status'      => AccountReceivable::STATUS_PENDING,
                    'created_by'  => $request->user()->id,
                ]);
                $created[] = $ar->id;
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Error creating installments: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['error' => 'Erro ao criar parcelas'], 500);
        }

        return response()->json([
            'message' => count($created) . ' parcelas criadas',
            'ids'     => $created,
        ], 201);
    }

    // ─── #15 Dashboard de Inadimplência ─────────────────────────

    public function delinquencyDashboard(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $overdue = AccountReceivable::where('tenant_id', $tenantId)
            ->whereNotIn('status', [AccountReceivable::STATUS_PAID, AccountReceivable::STATUS_CANCELLED])
            ->where('due_date', '<', now());

        $total = (clone $overdue)->sum('amount');
        $count = (clone $overdue)->count();

        // Aging buckets
        $buckets = [
            '1-30'  => (clone $overdue)->where('due_date', '>=', now()->subDays(30))->sum('amount'),
            '31-60' => (clone $overdue)->whereBetween('due_date', [now()->subDays(60), now()->subDays(31)])->sum('amount'),
            '61-90' => (clone $overdue)->whereBetween('due_date', [now()->subDays(90), now()->subDays(61)])->sum('amount'),
            '90+'   => (clone $overdue)->where('due_date', '<', now()->subDays(90))->sum('amount'),
        ];

        // Top clientes inadimplentes
        $topCustomers = AccountReceivable::where('tenant_id', $tenantId)
            ->whereNotIn('status', [AccountReceivable::STATUS_PAID, AccountReceivable::STATUS_CANCELLED])
            ->where('due_date', '<', now())
            ->join('customers', 'accounts_receivable.customer_id', '=', 'customers.id')
            ->selectRaw('customers.id, customers.name, SUM(accounts_receivable.amount) as total_due, COUNT(*) as count')
            ->groupBy('customers.id', 'customers.name')
            ->orderByDesc('total_due')
            ->limit(10)
            ->get();

        // Tendência (últimos 6 meses)
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $monthStart = now()->subMonths($i)->startOfMonth();
            $monthEnd   = $monthStart->copy()->endOfMonth();
            $trend[] = [
                'month' => $monthStart->format('Y-m'),
                'total' => round(AccountReceivable::where('tenant_id', $tenantId)
                    ->whereNotIn('status', [AccountReceivable::STATUS_PAID, AccountReceivable::STATUS_CANCELLED])
                    ->where('due_date', '<', $monthEnd)
                    ->where('created_at', '<=', $monthEnd)
                    ->sum('amount'), 2),
            ];
        }

        $totalReceivables = AccountReceivable::where('tenant_id', $tenantId)
            ->whereNotIn('status', [AccountReceivable::STATUS_PAID, AccountReceivable::STATUS_CANCELLED])
            ->sum('amount');
        $rate = $totalReceivables > 0 ? round(($total / $totalReceivables) * 100, 1) : 0;

        return response()->json([
            'total_overdue'     => round($total, 2),
            'overdue_count'     => $count,
            'delinquency_rate'  => $rate,
            'aging_buckets'     => $buckets,
            'top_customers'     => $topCustomers,
            'trend'             => $trend,
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
                'documento'    => trim(substr($line, 58, 15)),
                'valor'        => (int) substr($line, 81, 15) / 100,
                'status'       => $this->parseCnab240Status(substr($line, 15, 2)),
            ];
        }

        return [
            'data_pagamento' => $this->parseCnabDate(substr($line, 137, 8)),
            'valor_pago'     => (int) substr($line, 77, 15) / 100,
            'juros'          => (int) substr($line, 17, 15) / 100,
            'desconto'       => (int) substr($line, 32, 15) / 100,
            'status'         => 'paid',
        ];
    }

    private function parseCnab400Line(string $line): ?array
    {
        $tipo = substr($line, 0, 1);
        if ($tipo !== '1') return null;

        return [
            'nosso_numero'   => trim(substr($line, 62, 10)),
            'documento'      => trim(substr($line, 116, 10)),
            'data_pagamento' => $this->parseCnabDate(substr($line, 295, 6)),
            'valor_pago'     => (int) substr($line, 253, 13) / 100,
            'juros'          => (int) substr($line, 266, 13) / 100,
            'desconto'       => (int) substr($line, 240, 13) / 100,
            'status'         => 'paid',
        ];
    }

    private function parseCnab240Status(string $code): string
    {
        return match ($code) {
            '06', '17' => 'paid',
            '02'       => 'registered',
            '09'       => 'rejected',
            default    => 'unknown',
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
