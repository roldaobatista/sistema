<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use App\Models\CommissionEvent;
use App\Models\Expense;
use App\Models\TimeEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    // ── 1. Relatório de OS ──
    public function workOrders(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());
        $branchScope = fn ($q) => $request->filled('branch_id') ? $q->where('branch_id', $request->get('branch_id')) : $q;

        $byStatus = $branchScope(WorkOrder::select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as total')))
            ->whereBetween('created_at', [$from, "$to 23:59:59"])
            ->groupBy('status')
            ->get();

        $byPriority = $branchScope(WorkOrder::select('priority', DB::raw('COUNT(*) as count')))
            ->whereBetween('created_at', [$from, "$to 23:59:59"])
            ->groupBy('priority')
            ->get();

        $avgTime = $branchScope(WorkOrder::whereNotNull('completed_at'))
            ->whereBetween('completed_at', [$from, "$to 23:59:59"])
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as avg_hours')
            ->value('avg_hours');

        $monthly = $branchScope(WorkOrder::selectRaw("DATE_FORMAT(created_at, '%Y-%m') as period, COUNT(*) as count, SUM(total) as total"))
            ->whereBetween('created_at', [$from, "$to 23:59:59"])
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->orderBy('period')
            ->get();

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'by_status' => $byStatus,
            'by_priority' => $byPriority,
            'avg_completion_hours' => round((float) $avgTime, 1),
            'monthly' => $monthly,
        ]);
    }

    // ── 2. Relatório de Produtividade (técnicos) ──
    public function productivity(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $techStats = DB::table('time_entries')
            ->join('users', 'users.id', '=', 'time_entries.user_id')
            ->whereBetween('time_entries.started_at', [$from, "$to 23:59:59"])
            ->where('time_entries.tenant_id', auth()->user()->tenant_id)
            ->select(
                'users.id', 'users.name',
                DB::raw("SUM(CASE WHEN type = 'work' THEN duration_minutes ELSE 0 END) as work_minutes"),
                DB::raw("SUM(CASE WHEN type = 'travel' THEN duration_minutes ELSE 0 END) as travel_minutes"),
                DB::raw("SUM(CASE WHEN type = 'waiting' THEN duration_minutes ELSE 0 END) as waiting_minutes"),
                DB::raw('COUNT(DISTINCT work_order_id) as os_count'),
            )
            ->groupBy('users.id', 'users.name')
            ->get();

        $completedByTech = WorkOrder::whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, "$to 23:59:59"])
            ->select('assignee_id', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as total'))
            ->groupBy('assignee_id')
            ->with('assignee:id,name')
            ->get();

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'technicians' => $techStats,
            'completed_by_tech' => $completedByTech,
        ]);
    }

    // ── 3. Relatório Financeiro ──
    public function financial(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $arStats = AccountReceivable::whereBetween('due_date', [$from, $to])
            ->select(
                DB::raw('SUM(amount) as total'),
                DB::raw('SUM(amount_paid) as total_paid'),
                DB::raw("SUM(CASE WHEN status = 'overdue' THEN amount - amount_paid ELSE 0 END) as overdue"),
                DB::raw('COUNT(*) as count'),
            )
            ->first();

        $apStats = AccountPayable::whereBetween('due_date', [$from, $to])
            ->select(
                DB::raw('SUM(amount) as total'),
                DB::raw('SUM(amount_paid) as total_paid'),
                DB::raw('COUNT(*) as count'),
            )
            ->first();

        $expenseByCategory = Expense::whereBetween('expense_date', [$from, $to])
            ->whereNotIn('status', ['rejected'])
            ->leftJoin('expense_categories', 'expenses.expense_category_id', '=', 'expense_categories.id')
            ->select('expense_categories.name as category', DB::raw('SUM(expenses.amount) as total'))
            ->groupBy('expense_categories.name')
            ->get();

        $monthlyFlow = DB::query()
            ->selectRaw("
                period,
                SUM(income) as income,
                SUM(expense) as expense,
                SUM(income) - SUM(expense) as balance
            ")
            ->fromSub(function ($q) use ($from, $to) {
                $q->selectRaw("DATE_FORMAT(due_date, '%Y-%m') as period, SUM(amount_paid) as income, 0 as expense")
                    ->from('accounts_receivable')
                    ->whereBetween('due_date', [$from, $to])
                    ->groupByRaw("DATE_FORMAT(due_date, '%Y-%m')")
                    ->unionAll(
                        DB::query()
                            ->selectRaw("DATE_FORMAT(due_date, '%Y-%m') as period, 0 as income, SUM(amount_paid) as expense")
                            ->from('accounts_payable')
                            ->whereBetween('due_date', [$from, $to])
                            ->groupByRaw("DATE_FORMAT(due_date, '%Y-%m')")
                    );
            }, 'flows')
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'receivable' => $arStats,
            'payable' => $apStats,
            'expenses_by_category' => $expenseByCategory,
            'monthly_flow' => $monthlyFlow,
        ]);
    }

    // ── 4. Relatório de Comissões ──
    public function commissions(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $byTech = CommissionEvent::join('users', 'users.id', '=', 'commission_events.user_id')
            ->whereBetween('commission_events.created_at', [$from, "$to 23:59:59"])
            ->select(
                'users.id', 'users.name',
                DB::raw('COUNT(*) as events_count'),
                DB::raw('SUM(commission_amount) as total_commission'),
                DB::raw("SUM(CASE WHEN commission_events.status = 'pending' THEN commission_amount ELSE 0 END) as pending"),
                DB::raw("SUM(CASE WHEN commission_events.status = 'paid' THEN commission_amount ELSE 0 END) as paid"),
            )
            ->groupBy('users.id', 'users.name')
            ->get();

        $byStatus = CommissionEvent::whereBetween('created_at', [$from, "$to 23:59:59"])
            ->select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(commission_amount) as total'))
            ->groupBy('status')
            ->get();

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'by_technician' => $byTech,
            'by_status' => $byStatus,
        ]);
    }

    // ── 5. Relatório de Margem/Lucratividade ──
    public function profitability(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $revenue = (float) AccountReceivable::whereBetween('due_date', [$from, $to])
            ->where('status', '!=', 'cancelled')
            ->sum('amount_paid');

        $costs = (float) AccountPayable::whereBetween('due_date', [$from, $to])
            ->where('status', '!=', 'cancelled')
            ->sum('amount_paid');

        $expenses = (float) Expense::whereBetween('expense_date', [$from, $to])
            ->whereNotIn('status', ['rejected'])
            ->sum('amount');

        $commissions = (float) CommissionEvent::whereBetween('created_at', [$from, "$to 23:59:59"])
            ->whereIn('status', ['approved', 'paid'])
            ->sum('commission_amount');

        // Gap #14 — Custo real dos itens de OS (via cost_price salvo no WorkOrderItem)
        $itemCosts = (float) DB::table('work_order_items')
            ->join('work_orders', 'work_order_items.work_order_id', '=', 'work_orders.id')
            ->where('work_order_items.type', 'product')
            ->whereNotNull('work_order_items.cost_price')
            ->whereBetween('work_orders.completed_at', [$from, "$to 23:59:59"])
            ->selectRaw('SUM(work_order_items.cost_price * work_order_items.quantity) as total')
            ->value('total') ?? 0;

        $totalCosts = $costs + $expenses + $commissions;
        $margin = $revenue > 0 ? round(($revenue - $totalCosts) / $revenue * 100, 1) : 0;

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'revenue' => $revenue,
            'costs' => $costs,
            'expenses' => $expenses,
            'commissions' => $commissions,
            'item_costs' => $itemCosts,
            'total_costs' => $totalCosts,
            'profit' => $revenue - $totalCosts,
            'margin_pct' => $margin,
        ]);
    }

    // ── 6. Relatório de Orçamentos ──
    public function quotes(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $byStatus = \App\Models\Quote::select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as total'))
            ->whereBetween('created_at', [$from, "$to 23:59:59"])
            ->groupBy('status')
            ->get();

        $bySeller = \App\Models\Quote::join('users', 'users.id', '=', 'quotes.seller_id')
            ->whereBetween('quotes.created_at', [$from, "$to 23:59:59"])
            ->select('users.id', 'users.name', DB::raw('COUNT(*) as count'), DB::raw('SUM(quotes.total) as total'))
            ->groupBy('users.id', 'users.name')
            ->get();

        $totalQuotes = \App\Models\Quote::whereBetween('created_at', [$from, "$to 23:59:59"])->count();
        $approved = \App\Models\Quote::where('status', 'approved')
            ->whereBetween('created_at', [$from, "$to 23:59:59"])->count();
        $conversionRate = $totalQuotes > 0 ? round(($approved / $totalQuotes) * 100, 1) : 0;

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'by_status' => $byStatus,
            'by_seller' => $bySeller,
            'total' => $totalQuotes,
            'approved' => $approved,
            'conversion_rate' => $conversionRate,
        ]);
    }

    // ── 7. Relatório de Chamados ──
    public function serviceCalls(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $byStatus = \App\Models\ServiceCall::select('status', DB::raw('COUNT(*) as count'))
            ->whereBetween('created_at', [$from, "$to 23:59:59"])
            ->groupBy('status')
            ->get();

        $byPriority = \App\Models\ServiceCall::select('priority', DB::raw('COUNT(*) as count'))
            ->whereBetween('created_at', [$from, "$to 23:59:59"])
            ->groupBy('priority')
            ->get();

        $byTechnician = \App\Models\ServiceCall::join('users', 'users.id', '=', 'service_calls.technician_id')
            ->whereBetween('service_calls.created_at', [$from, "$to 23:59:59"])
            ->select('users.id', 'users.name', DB::raw('COUNT(*) as count'))
            ->groupBy('users.id', 'users.name')
            ->get();

        $total = \App\Models\ServiceCall::whereBetween('created_at', [$from, "$to 23:59:59"])->count();
        $completed = \App\Models\ServiceCall::where('status', 'concluido')
            ->whereBetween('created_at', [$from, "$to 23:59:59"])->count();

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'by_status' => $byStatus,
            'by_priority' => $byPriority,
            'by_technician' => $byTechnician,
            'total' => $total,
            'completed' => $completed,
        ]);
    }

    // ── 8. Relatório Caixa do Técnico ──
    public function technicianCash(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $funds = \App\Models\TechnicianCashFund::with('user:id,name')->get()
            ->map(fn ($f) => [
                'user_id' => $f->user_id,
                'user_name' => $f->user?->name,
                'balance' => (float) $f->balance,
                'credits_period' => (float) $f->transactions()
                    ->where('type', 'credit')->whereBetween('created_at', [$from, "$to 23:59:59"])->sum('amount'),
                'debits_period' => (float) $f->transactions()
                    ->where('type', 'debit')->whereBetween('created_at', [$from, "$to 23:59:59"])->sum('amount'),
            ]);

        $totalBalance = $funds->sum('balance');
        $totalCredits = $funds->sum('credits_period');
        $totalDebits = $funds->sum('debits_period');

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'funds' => $funds,
            'total_balance' => $totalBalance,
            'total_credits' => $totalCredits,
            'total_debits' => $totalDebits,
        ]);
    }

    // ── 9. Relatório CRM ──
    public function crm(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $dealsByStatus = \App\Models\CrmDeal::select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(value) as total'))
            ->whereBetween('created_at', [$from, "$to 23:59:59"])
            ->groupBy('status')
            ->get();

        $dealsBySeller = \App\Models\CrmDeal::join('customers', 'customers.id', '=', 'crm_deals.customer_id')
            ->leftJoin('users', 'users.id', '=', 'customers.assigned_seller_id')
            ->whereBetween('crm_deals.created_at', [$from, "$to 23:59:59"])
            ->select('users.id', 'users.name', DB::raw('COUNT(*) as count'), DB::raw('SUM(crm_deals.value) as total'))
            ->groupBy('users.id', 'users.name')
            ->get();

        $totalDeals = \App\Models\CrmDeal::whereBetween('created_at', [$from, "$to 23:59:59"])->count();
        $wonDeals = \App\Models\CrmDeal::where('status', 'won')
            ->whereBetween('closed_at', [$from, "$to 23:59:59"])->count();
        $convRate = $totalDeals > 0 ? round(($wonDeals / $totalDeals) * 100, 1) : 0;

        $healthDistribution = \App\Models\Customer::where('is_active', true)
            ->whereNotNull('health_score')
            ->select(DB::raw("
                SUM(CASE WHEN health_score >= 80 THEN 1 ELSE 0 END) as healthy,
                SUM(CASE WHEN health_score >= 50 AND health_score < 80 THEN 1 ELSE 0 END) as at_risk,
                SUM(CASE WHEN health_score < 50 THEN 1 ELSE 0 END) as critical
            "))
            ->first();

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'deals_by_status' => $dealsByStatus,
            'deals_by_seller' => $dealsBySeller,
            'total_deals' => $totalDeals,
            'won_deals' => $wonDeals,
            'conversion_rate' => $convRate,
            'health_distribution' => $healthDistribution,
        ]);
    }

    // ── 10. Relatório de Equipamentos ──
    public function equipments(Request $request): JsonResponse
    {
        $totalActive = \App\Models\Equipment::where('status', 'active')->count();
        $totalInactive = \App\Models\Equipment::where('status', '!=', 'active')->count();

        $byClass = \App\Models\Equipment::where('status', 'active')
            ->select('precision_class', DB::raw('COUNT(*) as count'))
            ->groupBy('precision_class')
            ->get();

        $overdue = \App\Models\Equipment::overdue()->active()->count();
        $dueNext7 = \App\Models\Equipment::calibrationDue(7)->active()->count() - $overdue;
        $dueNext30 = \App\Models\Equipment::calibrationDue(30)->active()->count() - $overdue - max(0, $dueNext7);

        $calibrationsMonth = \App\Models\EquipmentCalibration::whereMonth('calibration_date', now()->month)
            ->whereYear('calibration_date', now()->year)
            ->select(
                'result',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(cost) as total_cost'),
            )
            ->groupBy('result')
            ->get();

        $topBrands = \App\Models\Equipment::where('status', 'active')
            ->select('brand', DB::raw('COUNT(*) as count'))
            ->groupBy('brand')
            ->orderByDesc('count')
            ->take(10)
            ->get();

        return response()->json([
            'total_active' => $totalActive,
            'total_inactive' => $totalInactive,
            'by_class' => $byClass,
            'calibration_overdue' => $overdue,
            'calibration_due_7' => max(0, $dueNext7),
            'calibration_due_30' => max(0, $dueNext30),
            'calibrations_month' => $calibrationsMonth,
            'top_brands' => $topBrands,
        ]);
    }

    // ── 11. Relatório de Fornecedores (#18) ──
    public function suppliers(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfYear()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $ranking = DB::table('accounts_payable')
            ->join('suppliers', 'accounts_payable.supplier_id', '=', 'suppliers.id')
            ->whereBetween('accounts_payable.due_date', [$from, "$to 23:59:59"])
            ->where('accounts_payable.status', '!=', 'cancelled')
            ->select(
                'suppliers.id', 'suppliers.name',
                DB::raw('COUNT(*) as orders_count'),
                DB::raw('SUM(accounts_payable.amount) as total_amount'),
                DB::raw('SUM(accounts_payable.amount_paid) as total_paid'),
            )
            ->groupBy('suppliers.id', 'suppliers.name')
            ->orderByDesc('total_amount')
            ->get();

        $byCategory = DB::table('suppliers')
            ->select('category', DB::raw('COUNT(*) as count'))
            ->groupBy('category')
            ->get();

        $totalSuppliers = \App\Models\Supplier::count();
        $activeSuppliers = \App\Models\Supplier::where('is_active', true)->count();

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'ranking' => $ranking,
            'by_category' => $byCategory,
            'total_suppliers' => $totalSuppliers,
            'active_suppliers' => $activeSuppliers,
        ]);
    }

    // ── 12. Relatório de Estoque/Movimentação (#19) ──
    public function stock(Request $request): JsonResponse
    {
        $products = \App\Models\Product::select(
                'id', 'name', 'sku', 'stock_qty', 'min_stock', 'cost_price', 'sale_price'
            )
            ->orderBy('name')
            ->get();

        $outOfStock = $products->where('stock_qty', '<=', 0)->count();
        $lowStock = $products->filter(fn($p) => $p->stock_qty > 0 && $p->min_stock && $p->stock_qty <= $p->min_stock)->count();
        $totalValue = $products->sum(fn($p) => $p->stock_qty * $p->cost_price);
        $totalSaleValue = $products->sum(fn($p) => $p->stock_qty * $p->sale_price);

        $recentMovements = DB::table('work_order_items')
            ->join('work_orders', 'work_order_items.work_order_id', '=', 'work_orders.id')
            ->join('products', 'work_order_items.reference_id', '=', 'products.id')
            ->where('work_order_items.type', 'product')
            ->orderByDesc('work_orders.created_at')
            ->limit(50)
            ->select(
                'products.name as product_name',
                'work_order_items.quantity',
                'work_orders.number as os_number',
                'work_orders.created_at',
            )
            ->get();

        return response()->json([
            'summary' => [
                'total_products' => $products->count(),
                'out_of_stock' => $outOfStock,
                'low_stock' => $lowStock,
                'total_cost_value' => (float) $totalValue,
                'total_sale_value' => (float) $totalSaleValue,
            ],
            'products' => $products,
            'recent_movements' => $recentMovements,
        ]);
    }
}
