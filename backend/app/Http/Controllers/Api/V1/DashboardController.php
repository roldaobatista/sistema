<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CrmActivity;
use App\Models\CrmDeal;
use App\Models\Customer;
use App\Models\WorkOrder;
use App\Models\CommissionEvent;
use App\Models\Expense;
use App\Models\Equipment;
use App\Models\Product;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $from = $request->date('date_from') ?? now()->startOfMonth();
        $to   = $request->date('date_to')   ?? now()->endOfDay();

        $openOs = WorkOrder::whereNotIn('status', ['completed', 'cancelled'])->count();
        $inProgressOs = WorkOrder::where('status', 'in_progress')->count();
        $completedMonth = WorkOrder::where('status', 'completed')
            ->where('updated_at', '>=', $from)->count();
        $revenueMonth = WorkOrder::where('status', 'completed')
            ->where('updated_at', '>=', $from)->sum('total');

        $pendingCommissions = CommissionEvent::where('status', 'pending')->sum('commission_amount');
        $expensesMonth = Expense::where('status', 'approved')
            ->where('expense_date', '>=', $from)->sum('amount');

        $recentOs = WorkOrder::with(['customer:id,name', 'assignee:id,name'])
            ->orderByDesc('created_at')
            ->take(10)
            ->get(['id', 'number', 'customer_id', 'assignee_id', 'status', 'total', 'created_at']);

        $topTechnicians = WorkOrder::select('assignee_id', DB::raw('COUNT(*) as os_count'), DB::raw('SUM(total) as total_revenue'))
            ->where('status', 'completed')
            ->where('updated_at', '>=', $from)
            ->whereNotNull('assignee_id')
            ->groupBy('assignee_id')
            ->orderByDesc('os_count')
            ->take(5)
            ->with('assignee:id,name')
            ->get();

        // Equipamentos - alertas
        $eqOverdue = Equipment::overdue()->active()->count();
        $eqDue7 = Equipment::calibrationDue(7)->active()->count() - $eqOverdue;
        $eqAlerts = Equipment::calibrationDue(30)
            ->active()
            ->with('customer:id,name')
            ->orderBy('next_calibration_at')
            ->take(5)
            ->get(['id', 'code', 'brand', 'model', 'customer_id', 'next_calibration_at']);

        // CRM KPIs
        $openDeals = CrmDeal::where('status', 'open')->count();
        $wonDealsMonth = CrmDeal::where('status', 'won')
            ->where('closed_at', '>=', $from)->count();
        $crmRevenueMonth = CrmDeal::where('status', 'won')
            ->where('closed_at', '>=', $from)->sum('value');
        $pendingFollowUps = CrmActivity::where('type', 'tarefa')
            ->where('is_done', false)
            ->where('scheduled_at', '<=', now())->count();
        $avgHealthScore = (int) Customer::where('is_active', true)
            ->whereNotNull('health_score')->avg('health_score');

        // Financeiro
        $receivablesPending = AccountReceivable::whereIn('status', ['pending', 'partial'])
            ->sum('amount');
        $receivablesOverdue = AccountReceivable::whereIn('status', ['pending', 'partial'])
            ->where('due_date', '<', now())->sum('amount');
        $payablesPending = AccountPayable::whereIn('status', ['pending', 'partial'])
            ->sum('amount');
        $payablesOverdue = AccountPayable::whereIn('status', ['pending', 'partial'])
            ->where('due_date', '<', now())->sum('amount');
        $netRevenue = (float) $revenueMonth - (float) $expensesMonth;

        // SLA — tempo médio para concluir OS (em horas)
        $avgCompletionHours = WorkOrder::where('status', 'completed')
            ->where('updated_at', '>=', $from)
            ->whereNotNull('created_at')
            ->select(DB::raw('AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_hours'))
            ->value('avg_hours');

        return response()->json([
            'open_os' => $openOs,
            'in_progress_os' => $inProgressOs,
            'completed_month' => $completedMonth,
            'revenue_month' => (float) $revenueMonth,
            'pending_commissions' => (float) $pendingCommissions,
            'expenses_month' => (float) $expensesMonth,
            'recent_os' => $recentOs,
            'top_technicians' => $topTechnicians,
            'eq_overdue' => $eqOverdue,
            'eq_due_7' => max(0, $eqDue7),
            'eq_alerts' => $eqAlerts,
            // CRM
            'crm_open_deals' => $openDeals,
            'crm_won_month' => $wonDealsMonth,
            'crm_revenue_month' => (float) $crmRevenueMonth,
            'crm_pending_followups' => $pendingFollowUps,
            'crm_avg_health' => $avgHealthScore,
            // Estoque
            'stock_low' => Product::where('is_active', true)
                ->whereColumn('stock_qty', '<=', 'stock_min')
                ->where('stock_qty', '>', 0)->count(),
            'stock_out' => Product::where('is_active', true)
                ->where('stock_qty', '<=', 0)->count(),
            // Financeiro
            'receivables_pending' => (float) $receivablesPending,
            'receivables_overdue' => (float) $receivablesOverdue,
            'payables_pending' => (float) $payablesPending,
            'payables_overdue' => (float) $payablesOverdue,
            'net_revenue' => $netRevenue,
            // SLA
            'avg_completion_hours' => round((float) ($avgCompletionHours ?? 0), 1),
        ]);
    }
}
