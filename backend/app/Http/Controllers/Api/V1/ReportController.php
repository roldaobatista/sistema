<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\CommissionEvent;
use App\Models\CrmDeal;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\EquipmentCalibration;
use App\Models\Expense;
use App\Models\Product;
use App\Models\Quote;
use App\Models\ServiceCall;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\TechnicianCashFund;
use App\Models\TechnicianCashTransaction;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class ReportController extends Controller
{
    use ResolvesCurrentTenant;

    private function yearMonthExpression(string $column): string
    {
        if (DB::getDriverName() === 'sqlite') {
            return "strftime('%Y-%m', {$column})";
        }

        return "DATE_FORMAT({$column}, '%Y-%m')";
    }

    private function avgHoursExpression(string $startColumn, string $endColumn): string
    {
        if (DB::getDriverName() === 'sqlite') {
            return "AVG((julianday({$endColumn}) - julianday({$startColumn})) * 24)";
        }

        return "AVG(TIMESTAMPDIFF(HOUR, {$startColumn}, {$endColumn}))";
    }

    private function validatedDate(Request $request, string $key, string $default): string
    {
        $value = $request->get($key, $default);
        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return $default;
        }
    }

    private function osNumberFilter(Request $request): ?string
    {
        $osNumber = trim((string) $request->get('os_number', ''));
        if ($osNumber === '') {
            return null;
        }
        return str_replace(['%', '_'], ['\%', '\_'], $osNumber);
    }

    private function branchId(Request $request): ?int
    {
        return $request->filled('branch_id') ? (int) $request->get('branch_id') : null;
    }

    private function applyBranchFilter($query, ?int $branchId, string $column = 'branch_id')
    {
        if ($branchId) {
            $query->where($column, $branchId);
        }
        return $query;
    }

    private function applyWorkOrderFilter($query, string $relation, ?string $osNumber)
    {
        if (!$osNumber) {
            return $query;
        }

        return $query->whereHas($relation, function ($wo) use ($osNumber) {
            $wo->where(function ($q) use ($osNumber) {
                $q->where('os_number', 'like', "%{$osNumber}%")
                    ->orWhere('number', 'like', "%{$osNumber}%");
            });
        });
    }

    private function applyPayableIdentifierFilter($query, ?string $osNumber)
    {
        if (!$osNumber) {
            return $query;
        }

        return $query->where(function ($q) use ($osNumber) {
            $q->where('description', 'like', "%{$osNumber}%")
                ->orWhere('notes', 'like', "%{$osNumber}%");
        });
    }

    public function workOrders(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'from' => 'nullable|date',
                'to' => 'nullable|date',
                'branch_id' => 'nullable|integer|exists:branches,id',
            ]);

            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());
            $branchId = $this->branchId($request);
            $periodExpr = $this->yearMonthExpression('created_at');
            $avgExpr = $this->avgHoursExpression('created_at', 'completed_at');

            $byStatus = $this->applyBranchFilter(
                WorkOrder::where('tenant_id', $tenantId)
                    ->select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as total')),
                $branchId
            )
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->groupBy('status')
                ->get();

            $byPriority = $this->applyBranchFilter(
                WorkOrder::where('tenant_id', $tenantId)
                    ->select('priority', DB::raw('COUNT(*) as count')),
                $branchId
            )
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->groupBy('priority')
                ->get();

            $avgTime = $this->applyBranchFilter(
                WorkOrder::where('tenant_id', $tenantId)->whereNotNull('completed_at'),
                $branchId
            )
                ->whereBetween('completed_at', [$from, "{$to} 23:59:59"])
                ->selectRaw("{$avgExpr} as avg_hours")
                ->value('avg_hours');

            $monthly = $this->applyBranchFilter(
                WorkOrder::where('tenant_id', $tenantId)
                    ->selectRaw("{$periodExpr} as period, COUNT(*) as count, SUM(total) as total"),
                $branchId
            )
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->groupByRaw($periodExpr)
                ->orderBy('period')
                ->get();

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'by_status' => $byStatus,
                'by_priority' => $byPriority,
                'avg_completion_hours' => round((float) $avgTime, 1),
                'monthly' => $monthly,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report workOrders failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de ordens de serviço.'], 500);
        }
    }

    public function productivity(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());
            $branchId = $this->branchId($request);

            $techQuery = DB::table('time_entries')
                ->join('users', 'users.id', '=', 'time_entries.technician_id')
                ->whereBetween('time_entries.started_at', [$from, "{$to} 23:59:59"])
                ->where('time_entries.tenant_id', $tenantId)
                ->whereNull('time_entries.deleted_at');

            if ($branchId) {
                $techQuery->where('users.branch_id', $branchId);
            }

            $techStats = $techQuery
                ->select(
                    'users.id',
                    'users.name',
                    DB::raw("SUM(CASE WHEN type = 'work' THEN duration_minutes ELSE 0 END) as work_minutes"),
                    DB::raw("SUM(CASE WHEN type = 'travel' THEN duration_minutes ELSE 0 END) as travel_minutes"),
                    DB::raw("SUM(CASE WHEN type = 'waiting' THEN duration_minutes ELSE 0 END) as waiting_minutes"),
                    DB::raw('COUNT(DISTINCT work_order_id) as os_count')
                )
                ->groupBy('users.id', 'users.name')
                ->get();

            $completedQuery = WorkOrder::where('work_orders.tenant_id', $tenantId)
                ->whereNotNull('work_orders.completed_at')
                ->whereBetween('work_orders.completed_at', [$from, "{$to} 23:59:59"])
                ->leftJoin('users', 'users.id', '=', 'work_orders.assigned_to')
                ->selectRaw('work_orders.assigned_to as assignee_id, users.name as assignee_name, COUNT(*) as count, SUM(work_orders.total) as total');

            if ($branchId) {
                $completedQuery->where('work_orders.branch_id', $branchId);
            }

            $completedByTech = $completedQuery
                ->groupBy('work_orders.assigned_to', 'users.name')
                ->get()
                ->map(fn ($row) => [
                    'assignee_id' => $row->assignee_id,
                    'assignee' => $row->assignee_id ? ['id' => $row->assignee_id, 'name' => $row->assignee_name] : null,
                    'count' => $row->count,
                    'total' => $row->total,
                ]);

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'technicians' => $techStats,
                'completed_by_tech' => $completedByTech,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report productivity failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de produtividade.'], 500);
        }
    }

    public function financial(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());
            $osNumber = $this->osNumberFilter($request);
            $branchId = $this->branchId($request);
            $periodExpr = $this->yearMonthExpression('due_date');
            $expensePeriodExpr = $this->yearMonthExpression('expense_date');

            $arStatsQuery = AccountReceivable::where('tenant_id', $tenantId)
                ->whereBetween('due_date', [$from, "{$to} 23:59:59"]);
            $this->applyWorkOrderFilter($arStatsQuery, 'workOrder', $osNumber);
            if ($branchId) {
                $arStatsQuery->where(function ($q) use ($branchId) {
                    $q->whereHas('workOrder', fn ($wo) => $wo->where('branch_id', $branchId))
                        ->orWhereNull('work_order_id');
                });
            }

            $arStats = $arStatsQuery
                ->select(
                    DB::raw('SUM(amount) as total'),
                    DB::raw('SUM(amount_paid) as total_paid'),
                    DB::raw("SUM(CASE WHEN status = '" . AccountReceivable::STATUS_OVERDUE . "' THEN amount - amount_paid ELSE 0 END) as overdue"),
                    DB::raw('COUNT(*) as count')
                )
                ->first();

            $apStatsQuery = AccountPayable::where('tenant_id', $tenantId)
                ->whereBetween('due_date', [$from, "{$to} 23:59:59"]);
            $this->applyPayableIdentifierFilter($apStatsQuery, $osNumber);

            $apStats = $apStatsQuery
                ->select(
                    DB::raw('SUM(amount) as total'),
                    DB::raw('SUM(amount_paid) as total_paid'),
                    DB::raw("SUM(CASE WHEN status = '" . AccountPayable::STATUS_OVERDUE . "' THEN amount - amount_paid ELSE 0 END) as overdue"),
                    DB::raw('COUNT(*) as count')
                )
                ->first();

            $expenseByCategoryQuery = Expense::where('expenses.tenant_id', $tenantId)
                ->whereBetween('expense_date', [$from, "{$to} 23:59:59"])
                ->whereIn('status', [Expense::STATUS_APPROVED]);
            $this->applyWorkOrderFilter($expenseByCategoryQuery, 'workOrder', $osNumber);
            if ($branchId) {
                $expenseByCategoryQuery->where(function ($q) use ($branchId) {
                    $q->whereHas('workOrder', fn ($wo) => $wo->where('branch_id', $branchId))
                        ->orWhereNull('work_order_id');
                });
            }

            $expenseByCategory = $expenseByCategoryQuery
                ->leftJoin('expense_categories', function ($join) use ($tenantId) {
                    $join->on('expenses.expense_category_id', '=', 'expense_categories.id')
                        ->where('expense_categories.tenant_id', '=', $tenantId);
                })
                ->select('expense_categories.name as category', DB::raw('SUM(expenses.amount) as total'))
                ->groupBy('expense_categories.name')
                ->get();

            $monthlyFlow = DB::query()
                ->selectRaw('period, SUM(income) as income, SUM(expense) as expense, SUM(income) - SUM(expense) as balance')
                ->fromSub(function ($q) use ($from, $to, $tenantId, $periodExpr, $expensePeriodExpr, $osNumber, $branchId) {
                    $q->selectRaw("{$periodExpr} as period, SUM(amount_paid) as income, 0 as expense")
                        ->from('accounts_receivable')
                        ->where('accounts_receivable.tenant_id', $tenantId)
                        ->whereBetween('due_date', [$from, "{$to} 23:59:59"])
                        ->when($osNumber, function ($sub) use ($osNumber) {
                            $sub->join('work_orders as wo_ar', 'accounts_receivable.work_order_id', '=', 'wo_ar.id')
                                ->where(function ($f) use ($osNumber) {
                                    $f->where('wo_ar.os_number', 'like', "%{$osNumber}%")
                                        ->orWhere('wo_ar.number', 'like', "%{$osNumber}%");
                                });
                        })
                        ->when($branchId && !$osNumber, function ($sub) use ($branchId) {
                            $sub->where(function ($q) use ($branchId) {
                                $q->whereExists(function ($sq) use ($branchId) {
                                    $sq->selectRaw(1)
                                        ->from('work_orders as wo_ar_b')
                                        ->whereColumn('wo_ar_b.id', 'accounts_receivable.work_order_id')
                                        ->where('wo_ar_b.branch_id', $branchId);
                                })->orWhereNull('accounts_receivable.work_order_id');
                            });
                        })
                        ->groupByRaw($periodExpr)
                        ->unionAll(
                            DB::query()
                                ->selectRaw("{$periodExpr} as period, 0 as income, SUM(amount_paid) as expense")
                                ->from('accounts_payable')
                                ->where('tenant_id', $tenantId)
                                ->whereBetween('due_date', [$from, "{$to} 23:59:59"])
                                ->when($osNumber, function ($sub) use ($osNumber) {
                                    $sub->where(function ($f) use ($osNumber) {
                                        $f->where('description', 'like', "%{$osNumber}%")
                                            ->orWhere('notes', 'like', "%{$osNumber}%");
                                    });
                                })
                                ->groupByRaw($periodExpr)
                        )
                        ->unionAll(
                            DB::query()
                                ->selectRaw("{$expensePeriodExpr} as period, 0 as income, SUM(amount) as expense")
                                ->from('expenses')
                                ->where('expenses.tenant_id', $tenantId)
                                ->whereBetween('expense_date', [$from, "{$to} 23:59:59"])
                                ->whereIn('expenses.status', [Expense::STATUS_APPROVED])
                                ->when($osNumber, function ($sub) use ($osNumber) {
                                    $sub->join('work_orders as wo_exp', 'expenses.work_order_id', '=', 'wo_exp.id')
                                        ->where(function ($f) use ($osNumber) {
                                            $f->where('wo_exp.os_number', 'like', "%{$osNumber}%")
                                                ->orWhere('wo_exp.number', 'like', "%{$osNumber}%");
                                        });
                                })
                                ->when($branchId && !$osNumber, function ($sub) use ($branchId) {
                                    $sub->where(function ($q) use ($branchId) {
                                        $q->whereExists(function ($sq) use ($branchId) {
                                            $sq->selectRaw(1)
                                                ->from('work_orders as wo_exp_b')
                                                ->whereColumn('wo_exp_b.id', 'expenses.work_order_id')
                                                ->where('wo_exp_b.branch_id', $branchId);
                                        })->orWhereNull('expenses.work_order_id');
                                    });
                                })
                                ->groupByRaw($expensePeriodExpr)
                        );
                }, 'flows')
                ->groupBy('period')
                ->orderBy('period')
                ->get();

            return response()->json([
                'period' => ['from' => $from, 'to' => $to, 'os_number' => $osNumber],
                'receivable' => $arStats,
                'payable' => $apStats,
                'expenses_by_category' => $expenseByCategory,
                'monthly_flow' => $monthlyFlow,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report financial failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório financeiro.'], 500);
        }
    }

    public function commissions(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());
            $osNumber = $this->osNumberFilter($request);
            $branchId = $this->branchId($request);

            $byTechQuery = CommissionEvent::join('users', 'users.id', '=', 'commission_events.user_id')
                ->where('commission_events.tenant_id', $tenantId)
                ->whereBetween('commission_events.created_at', [$from, "{$to} 23:59:59"])
                ->when($osNumber, function ($query) use ($osNumber) {
                    $query->join('work_orders', 'work_orders.id', '=', 'commission_events.work_order_id')
                        ->where(function ($q) use ($osNumber) {
                            $q->where('work_orders.os_number', 'like', "%{$osNumber}%")
                                ->orWhere('work_orders.number', 'like', "%{$osNumber}%");
                        });
                });

            if ($branchId && !$osNumber) {
                $byTechQuery->join('work_orders as wo_br', 'wo_br.id', '=', 'commission_events.work_order_id')
                    ->where('wo_br.branch_id', $branchId);
            }

            $byTech = $byTechQuery
                ->select(
                    'users.id',
                    'users.name',
                    DB::raw('COUNT(*) as events_count'),
                    DB::raw('SUM(commission_amount) as total_commission'),
                    DB::raw("SUM(CASE WHEN commission_events.status = '" . CommissionEvent::STATUS_PENDING . "' THEN commission_amount ELSE 0 END) as pending"),
                    DB::raw("SUM(CASE WHEN commission_events.status = '" . CommissionEvent::STATUS_PAID . "' THEN commission_amount ELSE 0 END) as paid")
                )
                ->groupBy('users.id', 'users.name')
                ->get();

            $byStatusQuery = CommissionEvent::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(commission_amount) as total'));
            $this->applyWorkOrderFilter($byStatusQuery, 'workOrder', $osNumber);
            if ($branchId) {
                $byStatusQuery->where(function ($q) use ($branchId) {
                    $q->whereHas('workOrder', fn ($wo) => $wo->where('branch_id', $branchId))
                        ->orWhereNull('work_order_id');
                });
            }

            $byStatus = $byStatusQuery->groupBy('status')->get();

            return response()->json([
                'period' => ['from' => $from, 'to' => $to, 'os_number' => $osNumber],
                'by_technician' => $byTech,
                'by_status' => $byStatus,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report commissions failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de comissões.'], 500);
        }
    }

    public function profitability(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());
            $osNumber = $this->osNumberFilter($request);
            $branchId = $this->branchId($request);

            $revenueQuery = AccountReceivable::where('tenant_id', $tenantId)
                ->whereBetween('due_date', [$from, "{$to} 23:59:59"])
                ->where('status', '!=', AccountReceivable::STATUS_CANCELLED);
            $this->applyWorkOrderFilter($revenueQuery, 'workOrder', $osNumber);
            if ($branchId) {
                $revenueQuery->where(function ($q) use ($branchId) {
                    $q->whereHas('workOrder', fn ($wo) => $wo->where('branch_id', $branchId))
                        ->orWhereNull('work_order_id');
                });
            }
            $revenue = (string) ($revenueQuery->sum('amount_paid') ?? 0);

            $costsQuery = AccountPayable::where('tenant_id', $tenantId)
                ->whereBetween('due_date', [$from, "{$to} 23:59:59"])
                ->where('status', '!=', AccountPayable::STATUS_CANCELLED);
            $this->applyPayableIdentifierFilter($costsQuery, $osNumber);
            $costs = (string) ($costsQuery->sum('amount_paid') ?? 0);

            $expensesQuery = Expense::where('tenant_id', $tenantId)
                ->whereBetween('expense_date', [$from, "{$to} 23:59:59"])
                ->whereIn('status', [Expense::STATUS_APPROVED]);
            $this->applyWorkOrderFilter($expensesQuery, 'workOrder', $osNumber);
            if ($branchId) {
                $expensesQuery->where(function ($q) use ($branchId) {
                    $q->whereHas('workOrder', fn ($wo) => $wo->where('branch_id', $branchId))
                        ->orWhereNull('work_order_id');
                });
            }
            $expenses = (string) ($expensesQuery->sum('amount') ?? 0);

            $commissionsQuery = CommissionEvent::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->whereIn('status', [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_PAID]);
            $this->applyWorkOrderFilter($commissionsQuery, 'workOrder', $osNumber);
            if ($branchId) {
                $commissionsQuery->where(function ($q) use ($branchId) {
                    $q->whereHas('workOrder', fn ($wo) => $wo->where('branch_id', $branchId))
                        ->orWhereNull('work_order_id');
                });
            }
            $commissions = (string) ($commissionsQuery->sum('commission_amount') ?? 0);

            $itemCostsQuery = DB::table('work_order_items')
                ->join('work_orders', 'work_order_items.work_order_id', '=', 'work_orders.id')
                ->where('work_order_items.type', WorkOrderItem::TYPE_PRODUCT)
                ->whereNotNull('work_order_items.cost_price')
                ->where('work_orders.tenant_id', $tenantId)
                ->whereBetween('work_orders.completed_at', [$from, "{$to} 23:59:59"])
                ->when($osNumber, function ($query) use ($osNumber) {
                    $query->where(function ($q) use ($osNumber) {
                        $q->where('work_orders.os_number', 'like', "%{$osNumber}%")
                            ->orWhere('work_orders.number', 'like', "%{$osNumber}%");
                    });
                });

            if ($branchId) {
                $itemCostsQuery->where('work_orders.branch_id', $branchId);
            }

            $itemCosts = (string) ($itemCostsQuery->selectRaw('SUM(work_order_items.cost_price * work_order_items.quantity) as total')->value('total') ?? 0);

            $totalCosts = bcadd(bcadd(bcadd($costs, $expenses, 2), $commissions, 2), $itemCosts, 2);
            $profit = bcsub($revenue, $totalCosts, 2);
            $margin = bccomp($revenue, '0', 2) > 0
                ? round((float) bcdiv(bcmul($profit, '100', 4), $revenue, 4), 1)
                : 0;

            return response()->json([
                'period' => ['from' => $from, 'to' => $to, 'os_number' => $osNumber],
                'revenue' => (float) $revenue,
                'costs' => (float) $costs,
                'expenses' => (float) $expenses,
                'commissions' => (float) $commissions,
                'item_costs' => (float) $itemCosts,
                'total_costs' => (float) $totalCosts,
                'profit' => (float) $profit,
                'margin_pct' => $margin,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report profitability failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de lucratividade.'], 500);
        }
    }

    public function quotes(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());
            $branchId = $this->branchId($request);

            $baseQuery = fn () => Quote::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->when($branchId, fn ($q) => $q->whereHas('seller', fn ($u) => $u->where('branch_id', $branchId)));

            $byStatus = (clone $baseQuery())
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as total'))
                ->groupBy('status')
                ->get();

            $bySeller = Quote::where('quotes.tenant_id', $tenantId)
                ->join('users', 'users.id', '=', 'quotes.seller_id')
                ->whereBetween('quotes.created_at', [$from, "{$to} 23:59:59"])
                ->when($branchId, fn ($q) => $q->where('users.branch_id', $branchId))
                ->select('users.id', 'users.name', DB::raw('COUNT(*) as count'), DB::raw('SUM(quotes.total) as total'))
                ->groupBy('users.id', 'users.name')
                ->get();

            $totalQuotes = (clone $baseQuery())->count();

            $approved = (clone $baseQuery())
                ->whereIn('status', [Quote::STATUS_APPROVED, Quote::STATUS_INVOICED])
                ->count();

            $conversionRate = $totalQuotes > 0 ? round(($approved / $totalQuotes) * 100, 1) : 0;

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'by_status' => $byStatus,
                'by_seller' => $bySeller,
                'total' => $totalQuotes,
                'approved' => $approved,
                'conversion_rate' => $conversionRate,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report quotes failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de orçamentos.'], 500);
        }
    }

    public function serviceCalls(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());
            $branchId = $this->branchId($request);

            $branchFilter = fn ($q) => $branchId
                ? $q->whereExists(function ($sub) use ($branchId) {
                    $sub->selectRaw(1)
                        ->from('users')
                        ->whereColumn('users.id', 'service_calls.technician_id')
                        ->where('users.branch_id', $branchId);
                })
                : $q;

            $byStatus = $branchFilter(
                DB::table('service_calls')
                    ->where('tenant_id', $tenantId)
                    ->whereNull('deleted_at')
                    ->select('status', DB::raw('COUNT(*) as count'))
                    ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
            )->groupBy('status')->get();

            $byPriority = $branchFilter(
                DB::table('service_calls')
                    ->where('tenant_id', $tenantId)
                    ->whereNull('deleted_at')
                    ->select('priority', DB::raw('COUNT(*) as count'))
                    ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
            )->groupBy('priority')->get();

            $byTechnician = DB::table('service_calls')
                ->where('service_calls.tenant_id', $tenantId)
                ->whereNull('service_calls.deleted_at')
                ->leftJoin('users', 'users.id', '=', 'service_calls.technician_id')
                ->whereBetween('service_calls.created_at', [$from, "{$to} 23:59:59"])
                ->when($branchId, fn ($q) => $q->where('users.branch_id', $branchId))
                ->select('users.id', DB::raw("COALESCE(users.name, 'Sem tecnico') as name"), DB::raw('COUNT(*) as count'))
                ->groupBy('users.id', 'users.name')
                ->get();

            $total = $branchFilter(
                ServiceCall::where('tenant_id', $tenantId)->whereBetween('created_at', [$from, "{$to} 23:59:59"])
            )->count();

            $completed = $branchFilter(
                ServiceCall::where('tenant_id', $tenantId)
                    ->whereIn('status', [ServiceCall::STATUS_COMPLETED])
                    ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
            )->count();

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'by_status' => $byStatus,
                'by_priority' => $byPriority,
                'by_technician' => $byTechnician,
                'total' => $total,
                'completed' => $completed,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report serviceCalls failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de chamados.'], 500);
        }
    }

    public function technicianCash(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());
            $osNumber = $this->osNumberFilter($request);
            $branchId = $this->branchId($request);

            $fundsQuery = TechnicianCashFund::where('tenant_id', $tenantId)->with('technician:id,name,branch_id');
            if ($branchId) {
                $fundsQuery->whereHas('technician', fn ($q) => $q->where('branch_id', $branchId));
            }

            $funds = $fundsQuery->get()
                ->map(function (TechnicianCashFund $fund) use ($from, $to, $tenantId, $osNumber) {
                    $transactions = $fund->transactions()
                        ->where('tenant_id', $tenantId)
                        ->whereBetween('transaction_date', [$from, "{$to} 23:59:59"]);
                    if ($osNumber) {
                        $transactions->whereHas('workOrder', function ($wo) use ($osNumber) {
                            $wo->where(function ($q) use ($osNumber) {
                                $q->where('os_number', 'like', "%{$osNumber}%")
                                    ->orWhere('number', 'like', "%{$osNumber}%");
                            });
                        });
                    }

                    return [
                        'user_id' => $fund->user_id,
                        'user_name' => $fund->technician?->name,
                        'balance' => (float) $fund->balance,
                        'credits_period' => (float) (clone $transactions)->where('type', TechnicianCashTransaction::TYPE_CREDIT)->sum('amount'),
                        'debits_period' => (float) (clone $transactions)->where('type', TechnicianCashTransaction::TYPE_DEBIT)->sum('amount'),
                    ];
                })
                ->values();

            return response()->json([
                'period' => ['from' => $from, 'to' => $to, 'os_number' => $osNumber],
                'funds' => $funds,
                'total_balance' => (float) $funds->sum('balance'),
                'total_credits' => (float) $funds->sum('credits_period'),
                'total_debits' => (float) $funds->sum('debits_period'),
            ]);
        } catch (\Throwable $e) {
            Log::error('Report technicianCash failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de caixa do técnico.'], 500);
        }
    }

    public function crm(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());

            $dealsByStatus = CrmDeal::where('tenant_id', $tenantId)
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(value) as value'))
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->groupBy('status')
                ->get();

            $dealsBySeller = CrmDeal::where('crm_deals.tenant_id', $tenantId)
                ->leftJoin('users', 'users.id', '=', 'crm_deals.assigned_to')
                ->whereBetween('crm_deals.created_at', [$from, "{$to} 23:59:59"])
                ->select(
                    'users.id as owner_id',
                    'users.name as owner_name',
                    DB::raw('COUNT(*) as count'),
                    DB::raw('SUM(crm_deals.value) as value')
                )
                ->groupBy('users.id', 'users.name')
                ->get();

            $totalDeals = CrmDeal::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->count();

            $wonDeals = CrmDeal::where('tenant_id', $tenantId)
                ->where('status', CrmDeal::STATUS_WON)
                ->whereBetween('won_at', [$from, "{$to} 23:59:59"])
                ->count();

            $revenue = (float) CrmDeal::where('tenant_id', $tenantId)
                ->where('status', CrmDeal::STATUS_WON)
                ->whereBetween('won_at', [$from, "{$to} 23:59:59"])
                ->sum('value');

            $totalValue = (float) CrmDeal::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->sum('value');

            $avgDealValue = $totalDeals > 0 ? round($totalValue / $totalDeals, 2) : 0;
            $conversionRate = $totalDeals > 0 ? round(($wonDeals / $totalDeals) * 100, 1) : 0;

            $healthSummary = Customer::where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->whereNotNull('health_score')
                ->select(DB::raw("
                    SUM(CASE WHEN health_score >= 80 THEN 1 ELSE 0 END) as healthy,
                    SUM(CASE WHEN health_score >= 50 AND health_score < 80 THEN 1 ELSE 0 END) as at_risk,
                    SUM(CASE WHEN health_score < 50 THEN 1 ELSE 0 END) as critical
                "))
                ->first();

            $healthDistribution = [
                ['range' => 'Saudavel', 'count' => (int) ($healthSummary->healthy ?? 0)],
                ['range' => 'Risco', 'count' => (int) ($healthSummary->at_risk ?? 0)],
                ['range' => 'Critico', 'count' => (int) ($healthSummary->critical ?? 0)],
            ];

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'deals_by_status' => $dealsByStatus,
                'deals_by_seller' => $dealsBySeller,
                'total_deals' => $totalDeals,
                'won_deals' => $wonDeals,
                'conversion_rate' => $conversionRate,
                'revenue' => $revenue,
                'avg_deal_value' => $avgDealValue,
                'health_distribution' => $healthDistribution,
                'health_distribution_summary' => [
                    'healthy' => (int) ($healthSummary->healthy ?? 0),
                    'at_risk' => (int) ($healthSummary->at_risk ?? 0),
                    'critical' => (int) ($healthSummary->critical ?? 0),
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Report CRM failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de CRM.'], 500);
        }
    }

    public function equipments(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());

            $totalActive = Equipment::where('tenant_id', $tenantId)->active()->count();
            $totalInactive = Equipment::where('tenant_id', $tenantId)
                ->where(function ($query) {
                    $query->where('is_active', false)->orWhere('status', Equipment::STATUS_DISCARDED);
                })
                ->count();

            $byClass = Equipment::where('tenant_id', $tenantId)
                ->active()
                ->select('precision_class', DB::raw('COUNT(*) as count'))
                ->groupBy('precision_class')
                ->get();

            $overdue = Equipment::where('tenant_id', $tenantId)->overdue()->active()->count();
            $rawDue7 = Equipment::where('tenant_id', $tenantId)->calibrationDue(7)->active()->count();
            $dueNext7 = max(0, $rawDue7 - $overdue);
            $rawDue30 = Equipment::where('tenant_id', $tenantId)->calibrationDue(30)->active()->count();
            $dueNext30 = max(0, $rawDue30 - $overdue - $dueNext7);

            $calibrationsInPeriod = EquipmentCalibration::where('tenant_id', $tenantId)
                ->whereBetween('calibration_date', [$from, "{$to} 23:59:59"])
                ->select('result', DB::raw('COUNT(*) as count'), DB::raw('SUM(cost) as total_cost'))
                ->groupBy('result')
                ->get();

            $totalCalibrationCost = (float) EquipmentCalibration::where('tenant_id', $tenantId)
                ->whereBetween('calibration_date', [$from, "{$to} 23:59:59"])
                ->sum('cost');

            $topBrands = Equipment::where('tenant_id', $tenantId)
                ->active()
                ->select('brand', DB::raw('COUNT(*) as count'))
                ->groupBy('brand')
                ->orderByDesc('count')
                ->take(10)
                ->get();

            $dueAlerts = Equipment::where('tenant_id', $tenantId)
                ->active()
                ->whereNotNull('next_calibration_at')
                ->whereBetween('next_calibration_at', [now()->toDateString(), now()->addDays(30)->toDateString()])
                ->orderBy('next_calibration_at')
                ->select('id', 'brand', 'model', 'code', 'next_calibration_at')
                ->limit(30)
                ->get();

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'total_active' => $totalActive,
                'total_inactive' => $totalInactive,
                'by_class' => $byClass,
                'calibration_overdue' => $overdue,
                'overdue_calibrations' => $overdue,
                'calibration_due_7' => max(0, $dueNext7),
                'calibration_due_30' => max(0, $dueNext30),
                'calibrations_period' => $calibrationsInPeriod,
                'calibrations_month' => $calibrationsInPeriod,
                'total_calibration_cost' => $totalCalibrationCost,
                'top_brands' => $topBrands,
                'due_alerts' => $dueAlerts,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report equipments failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de equipamentos.'], 500);
        }
    }

    public function suppliers(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfYear()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());

            $ranking = DB::table('accounts_payable')
                ->join('suppliers', 'accounts_payable.supplier_id', '=', 'suppliers.id')
                ->where('accounts_payable.tenant_id', $tenantId)
                ->where('suppliers.tenant_id', $tenantId)
                ->whereBetween('accounts_payable.due_date', [$from, "{$to} 23:59:59"])
                ->where('accounts_payable.status', '!=', AccountPayable::STATUS_CANCELLED)
                ->select(
                    'suppliers.id',
                    'suppliers.name',
                    DB::raw('COUNT(*) as orders_count'),
                    DB::raw('SUM(accounts_payable.amount) as total_amount'),
                    DB::raw('SUM(accounts_payable.amount_paid) as total_paid')
                )
                ->groupBy('suppliers.id', 'suppliers.name')
                ->orderByDesc('total_amount')
                ->get();

            $byCategory = Supplier::where('tenant_id', $tenantId)
                ->select('category', DB::raw('COUNT(*) as count'))
                ->groupBy('category')
                ->get();

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'ranking' => $ranking,
                'by_category' => $byCategory,
                'total_suppliers' => Supplier::where('tenant_id', $tenantId)->count(),
                'active_suppliers' => Supplier::where('tenant_id', $tenantId)->where('is_active', true)->count(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Report suppliers failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de fornecedores.'], 500);
        }
    }

    public function stock(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();

            $products = Product::where('tenant_id', $tenantId)
                ->selectRaw('id, name, code, code as sku, stock_qty, stock_min, stock_min as min_stock, cost_price, sell_price, sell_price as sale_price')
                ->orderBy('name')
                ->limit(500)
                ->get();

            $totalProducts = Product::where('tenant_id', $tenantId)->count();
            $outOfStock = Product::where('tenant_id', $tenantId)->where('stock_qty', '<=', 0)->count();
            $lowStock = Product::where('tenant_id', $tenantId)
                ->where('stock_qty', '>', 0)
                ->whereNotNull('stock_min')
                ->whereColumn('stock_qty', '<=', 'stock_min')
                ->count();

            $totalValue = Product::where('tenant_id', $tenantId)
                ->selectRaw('SUM(stock_qty * cost_price) as total')
                ->value('total') ?? 0;

            $totalSaleValue = Product::where('tenant_id', $tenantId)
                ->selectRaw('SUM(stock_qty * sell_price) as total')
                ->value('total') ?? 0;

            $recentMovements = DB::table('stock_movements')
                ->join('products', 'stock_movements.product_id', '=', 'products.id')
                ->leftJoin('work_orders', 'stock_movements.work_order_id', '=', 'work_orders.id')
                ->where('stock_movements.tenant_id', $tenantId)
                ->orderByDesc('stock_movements.created_at')
                ->limit(50)
                ->select(
                    'stock_movements.id',
                    'products.name as product_name',
                    'stock_movements.quantity',
                    'stock_movements.type',
                    DB::raw('COALESCE(work_orders.os_number, work_orders.number, stock_movements.reference) as reference'),
                    'stock_movements.created_at'
                )
                ->get()
                ->map(function ($m) {
                    $type = $m->type;
                    $isIn = in_array($type, ['entry', 'return'], true);
                    return [
                        'id' => $m->id,
                        'product_name' => $m->product_name,
                        'quantity' => $m->quantity,
                        'type' => $isIn ? 'in' : 'out',
                        'movement_type' => $type,
                        'reference' => $m->reference ?? '—',
                        'created_at' => $m->created_at,
                    ];
                });

            return response()->json([
                'summary' => [
                    'total_products' => $totalProducts,
                    'out_of_stock' => $outOfStock,
                    'low_stock' => $lowStock,
                    'total_cost_value' => round((float) $totalValue, 2),
                    'total_sale_value' => round((float) $totalSaleValue, 2),
                ],
                'products' => $products,
                'recent_movements' => $recentMovements,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report stock failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de estoque.'], 500);
        }
    }

    public function customers(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            $from = $this->validatedDate($request, 'from', now()->startOfMonth()->toDateString());
            $to = $this->validatedDate($request, 'to', now()->toDateString());

            $topByRevenue = DB::table('accounts_receivable')
                ->join('work_orders', 'accounts_receivable.work_order_id', '=', 'work_orders.id')
                ->join('customers', 'work_orders.customer_id', '=', 'customers.id')
                ->where('accounts_receivable.tenant_id', $tenantId)
                ->whereBetween('accounts_receivable.due_date', [$from, "{$to} 23:59:59"])
                ->where('accounts_receivable.status', '!=', AccountReceivable::STATUS_CANCELLED)
                ->select(
                    'customers.id',
                    'customers.name',
                    DB::raw('COUNT(DISTINCT work_orders.id) as os_count'),
                    DB::raw('SUM(accounts_receivable.amount_paid) as total_revenue')
                )
                ->groupBy('customers.id', 'customers.name')
                ->orderByDesc('total_revenue')
                ->limit(20)
                ->get();

            $bySegment = Customer::where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->select('segment', DB::raw('COUNT(*) as count'))
                ->groupBy('segment')
                ->get();

            $totalActive = Customer::where('tenant_id', $tenantId)->where('is_active', true)->count();
            $newInPeriod = Customer::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$from, "{$to} 23:59:59"])
                ->count();

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'top_by_revenue' => $topByRevenue,
                'by_segment' => $bySegment,
                'total_active' => $totalActive,
                'new_in_period' => $newInPeriod,
            ]);
        } catch (\Throwable $e) {
            Log::error('Report customers failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar relatório de clientes.'], 500);
        }
    }
}
