<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Iam\UserController;
use App\Http\Controllers\Api\V1\Iam\RoleController;
use App\Http\Controllers\Api\V1\Iam\PermissionController;
use App\Http\Controllers\Api\V1\Master\CustomerController;
use App\Http\Controllers\Api\V1\Master\ProductController;
use App\Http\Controllers\Api\V1\Master\ServiceController;
use App\Http\Controllers\Api\V1\Master\SupplierController;
use App\Http\Controllers\Api\V1\PaymentMethodController;

/*
|--------------------------------------------------------------------------
| API Routes â�,��?� /api/v1/*
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // --- Auth (público) ---
    Route::middleware('throttle:5,1')->post('/login', [AuthController::class, 'login']);

    // â�?��,�â�?��,�â�?��,� Portal do Cliente (Fase 6.1) â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�
    Route::prefix('portal')->group(function () {
        Route::post('login', [\App\Http\Controllers\Api\V1\Portal\PortalAuthController::class, 'login']);

        Route::middleware(['auth:sanctum'])->group(function () {
            Route::post('logout', [\App\Http\Controllers\Api\V1\Portal\PortalAuthController::class, 'logout']);
            Route::get('me', [\App\Http\Controllers\Api\V1\Portal\PortalAuthController::class, 'me']);
            
            Route::get('work-orders', [\App\Http\Controllers\Api\V1\Portal\PortalController::class, 'workOrders']);
            Route::get('quotes', [\App\Http\Controllers\Api\V1\Portal\PortalController::class, 'quotes']);
            Route::match(['post', 'put'], 'quotes/{id}/status', [\App\Http\Controllers\Api\V1\Portal\PortalController::class, 'updateQuoteStatus']);
            Route::get('financials', [\App\Http\Controllers\Api\V1\Portal\PortalController::class, 'financials']);
            Route::post('service-calls', [\App\Http\Controllers\Api\V1\Portal\PortalController::class, 'newServiceCall']);
        });
    });

    // --- Rotas autenticadas ---
    Route::middleware(['auth:sanctum', 'check.tenant'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/my-tenants', [AuthController::class, 'myTenants']);
        Route::post('/switch-tenant', [AuthController::class, 'switchTenant']);
        Route::middleware('check.permission:platform.dashboard.view')->get('/dashboard-stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);
        Route::middleware('check.permission:finance.cashflow.view')->get('/cash-flow', [\App\Http\Controllers\Api\V1\CashFlowController::class, 'cashFlow']);
        Route::middleware('check.permission:finance.dre.view')->get('/dre', [\App\Http\Controllers\Api\V1\CashFlowController::class, 'dre']);

        // IAM �?" rota específica registrada ANTES do apiResource para evitar conflito com {user}
        Route::middleware('check.permission:iam.user.view')->get('users/stats', [UserController::class, 'stats']);
        Route::middleware('check.permission:iam.user.view')->get('users/by-role/{role}', [UserController::class, 'byRole']);
        Route::middleware('check.permission:iam.user.view')->get('users/export', [UserController::class, 'exportCsv']);
        Route::middleware('check.permission:os.work_order.view|technicians.schedule.view|technicians.time_entry.view|technicians.cashbox.view')->get('technicians/options', [UserController::class, 'techniciansOptions']);
        Route::middleware('check.permission:iam.user.view')->group(function () {
            Route::apiResource('users', UserController::class)->only(['index', 'show']);
        });
        Route::middleware('check.permission:iam.user.create')->post('users', [UserController::class, 'store']);
        Route::middleware('check.permission:iam.user.update')->post('users/bulk-toggle-active', [UserController::class, 'bulkToggleActive']);
        Route::middleware('check.permission:iam.user.update')->group(function () {
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::post('users/{user}/toggle-active', [UserController::class, 'toggleActive']);
            Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
            Route::post('users/{user}/force-logout', [UserController::class, 'forceLogout']);
            Route::get('users/{user}/sessions', [UserController::class, 'sessions']);
            Route::delete('users/{user}/sessions/{token}', [UserController::class, 'revokeSession']);
            Route::get('users/{user}/audit-trail', [UserController::class, 'auditTrail']);
        });
        Route::middleware('check.permission:iam.user.delete')->delete('users/{user}', [UserController::class, 'destroy']);
        Route::middleware('check.permission:iam.role.view')->group(function () {
            Route::apiResource('roles', RoleController::class)->only(['index', 'show']);
            Route::get('roles/{role}/users', [RoleController::class, 'users']);
            Route::get('permissions', [PermissionController::class, 'index']);
            Route::get('permissions/matrix', [PermissionController::class, 'matrix']);
        });
        Route::middleware('check.permission:iam.role.create')->group(function () {
            Route::post('roles', [RoleController::class, 'store']);
            Route::post('roles/{role}/clone', [RoleController::class, 'clone']);
        });
        Route::middleware('check.permission:iam.role.update')->put('roles/{role}', [RoleController::class, 'update']);
        Route::middleware('check.permission:iam.role.update')->post('permissions/toggle', [PermissionController::class, 'toggleRolePermission']);
        Route::middleware('check.permission:iam.role.delete')->delete('roles/{role}', [RoleController::class, 'destroy']);

        // Audit Logs
        Route::middleware('check.permission:iam.audit_log.view')->group(function () {
            Route::get('audit-logs', [\App\Http\Controllers\Api\V1\AuditLogController::class, 'index']);
            Route::get('audit-logs/actions', [\App\Http\Controllers\Api\V1\AuditLogController::class, 'actions']);
            Route::get('audit-logs/entity-types', [\App\Http\Controllers\Api\V1\AuditLogController::class, 'entityTypes']);
            Route::get('audit-logs/{id}', [\App\Http\Controllers\Api\V1\AuditLogController::class, 'show']);
            Route::post('audit-logs/export', [\App\Http\Controllers\Api\V1\AuditLogController::class, 'export']);
        });

        // Cadastros
        Route::middleware('check.permission:cadastros.customer.view')->get('customers', [CustomerController::class, 'index']);
        Route::middleware('check.permission:cadastros.customer.view')->get('customers/duplicates', [\App\Http\Controllers\Api\V1\Customer\CustomerMergeController::class, 'searchDuplicates']); // compat
        Route::middleware('check.permission:cadastros.customer.view')->get('customers/{customer}', [CustomerController::class, 'show']);
        Route::middleware('check.permission:cadastros.customer.create')->post('customers', [CustomerController::class, 'store']);
        Route::middleware('check.permission:cadastros.customer.update')->put('customers/{customer}', [CustomerController::class, 'update']);
        Route::middleware('check.permission:cadastros.customer.delete')->delete('customers/{customer}', [CustomerController::class, 'destroy']);

        Route::middleware('check.permission:cadastros.product.view')->group(function () {
            Route::get('products', [ProductController::class, 'index']);
            Route::get('products/{product}', [ProductController::class, 'show']);
            Route::get('product-categories', [ProductController::class, 'categories']);
        });
        Route::middleware('check.permission:cadastros.product.create')->group(function () {
            Route::post('products', [ProductController::class, 'store']);
            Route::post('product-categories', [ProductController::class, 'storeCategory']);
        });
        Route::middleware('check.permission:cadastros.product.update')->group(function () {
            Route::put('products/{product}', [ProductController::class, 'update']);
            Route::put('product-categories/{category}', [ProductController::class, 'updateCategory']);
        });
        Route::middleware('check.permission:cadastros.product.delete')->group(function () {
            Route::delete('products/{product}', [ProductController::class, 'destroy']);
            Route::delete('product-categories/{category}', [ProductController::class, 'destroyCategory']);
        });

        Route::middleware('check.permission:cadastros.service.view')->group(function () {
            Route::get('services', [ServiceController::class, 'index']);
            Route::get('services/{service}', [ServiceController::class, 'show']);
            Route::get('service-categories', [ServiceController::class, 'categories']);
        });
        Route::middleware('check.permission:cadastros.service.create')->group(function () {
            Route::post('services', [ServiceController::class, 'store']);
            Route::post('service-categories', [ServiceController::class, 'storeCategory']);
        });
        Route::middleware('check.permission:cadastros.service.update')->group(function () {
            Route::put('services/{service}', [ServiceController::class, 'update']);
            Route::put('service-categories/{category}', [ServiceController::class, 'updateCategory']);
        });
        Route::middleware('check.permission:cadastros.service.delete')->group(function () {
            Route::delete('services/{service}', [ServiceController::class, 'destroy']);
            Route::delete('service-categories/{category}', [ServiceController::class, 'destroyCategory']);
        });

        // Fornecedores
        Route::middleware('check.permission:cadastros.supplier.view')->group(function () {
            Route::get('suppliers', [SupplierController::class, 'index']);
            Route::get('suppliers/{supplier}', [SupplierController::class, 'show']);
        });
        Route::middleware('check.permission:cadastros.supplier.create')->post('suppliers', [SupplierController::class, 'store']);
        Route::middleware('check.permission:cadastros.supplier.update')->put('suppliers/{supplier}', [SupplierController::class, 'update']);
        Route::middleware('check.permission:cadastros.supplier.delete')->delete('suppliers/{supplier}', [SupplierController::class, 'destroy']);

        // Histórico de Preços
        Route::middleware('check.permission:cadastros.product.view')->group(function () {
            Route::get('price-history', [\App\Http\Controllers\Api\V1\PriceHistoryController::class, 'index']);
            Route::get('products/{product}/price-history', [\App\Http\Controllers\Api\V1\PriceHistoryController::class, 'forProduct']);
            Route::get('services/{service}/price-history', [\App\Http\Controllers\Api\V1\PriceHistoryController::class, 'forService']);
        });

        // Exportação em Lote
        Route::middleware('check.permission:cadastros.customer.view')->group(function () {
            Route::get('batch-export/entities', [\App\Http\Controllers\Api\V1\BatchExportController::class, 'entities']);
            Route::post('batch-export/csv', [\App\Http\Controllers\Api\V1\BatchExportController::class, 'exportCsv']);
            Route::post('batch-export/print', [\App\Http\Controllers\Api\V1\BatchExportController::class, 'batchPrint']);
        });

        // Estoque
        Route::middleware('check.permission:estoque.movement.view')->group(function () {
            Route::get('stock/movements', [\App\Http\Controllers\Api\V1\StockController::class, 'movements']);
            Route::get('stock/summary', [\App\Http\Controllers\Api\V1\StockController::class, 'summary']);
            Route::get('stock/low-alerts', [\App\Http\Controllers\Api\V1\StockController::class, 'lowStockAlerts']);
            Route::get('stock/low-stock-alerts', [\App\Http\Controllers\Api\V1\StockController::class, 'lowStockAlerts']); // compat alias
        });
        Route::middleware('check.permission:estoque.movement.create')->post('stock/movements', [\App\Http\Controllers\Api\V1\StockController::class, 'store']);

        // Concilia�f§�f£o Banc�f¡ria
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('bank-reconciliation/statements', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'statements']);
            Route::get('bank-reconciliation/statements/{statement}/entries', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'entries']);
        });
        Route::middleware('check.permission:finance.receivable.create')->group(function () {
            Route::post('bank-reconciliation/import', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'import']);
            Route::post('bank-reconciliation/entries/{entry}/match', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'matchEntry']);
            Route::post('bank-reconciliation/entries/{entry}/ignore', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'ignoreEntry']);
        });

        // Plano de Contas
        Route::middleware('check.permission:finance.chart.view')->get('chart-of-accounts', [\App\Http\Controllers\Api\V1\ChartOfAccountController::class, 'index']);
        Route::middleware('check.permission:finance.chart.create')->post('chart-of-accounts', [\App\Http\Controllers\Api\V1\ChartOfAccountController::class, 'store']);
        Route::middleware('check.permission:finance.chart.update')->put('chart-of-accounts/{account}', [\App\Http\Controllers\Api\V1\ChartOfAccountController::class, 'update']);
        Route::middleware('check.permission:finance.chart.delete')->delete('chart-of-accounts/{account}', [\App\Http\Controllers\Api\V1\ChartOfAccountController::class, 'destroy']);

        Route::middleware('check.permission:os.work_order.view')->group(function () {
            Route::get('work-orders', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'index']);
            Route::get('work-orders/{work_order}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'show']);
            Route::get('work-orders-metadata', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'metadata']);
        });
        Route::middleware('check.permission:os.work_order.create')->post('work-orders', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'store']);
        Route::middleware('check.permission:os.work_order.update')->group(function () {
            Route::put('work-orders/{work_order}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'update']);
            Route::post('work-orders/{work_order}/items', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'storeItem']);
            Route::put('work-orders/{work_order}/items/{item}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'updateItem']);
            Route::delete('work-orders/{work_order}/items/{item}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'destroyItem']);
        });
        Route::middleware('check.permission:os.work_order.change_status')->match(['post', 'patch'], 'work-orders/{work_order}/status', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'updateStatus']);
        Route::middleware('check.permission:os.work_order.create')->post('work-orders/{work_order}/duplicate', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'duplicate']);
        Route::middleware('check.permission:os.work_order.export')->get('work-orders-export', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'exportCsv']);
        Route::middleware('check.permission:os.work_order.view')->get('work-orders-dashboard-stats', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'dashboardStats']);
        Route::middleware('check.permission:os.work_order.change_status')->post('work-orders/{work_order}/reopen', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'reopen']);
        Route::middleware('check.permission:os.work_order.delete')->delete('work-orders/{work_order}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'destroy']);
        // Anexos/Fotos da OS
        Route::middleware('check.permission:os.work_order.view')->get('work-orders/{work_order}/attachments', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'attachments']);
        Route::middleware('check.permission:os.work_order.update')->group(function () {
            Route::post('work-orders/{work_order}/attachments', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'storeAttachment']);
            Route::delete('work-orders/{work_order}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'destroyAttachment']);
            Route::post('work-orders/{work_order}/signature', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'storeSignature']);
            // Equipamentos da OS (m�fºltiplos)
            Route::post('work-orders/{work_order}/equipments', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'attachEquipment']);
            Route::delete('work-orders/{work_order}/equipments/{equipment}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'detachEquipment']);
        });

        // Contratos Recorrentes (#24)
        Route::middleware('check.permission:os.work_order.view')->group(function () {
            Route::get('recurring-contracts', [\App\Http\Controllers\Api\V1\Os\RecurringContractController::class, 'index']);
            Route::get('recurring-contracts/{recurring_contract}', [\App\Http\Controllers\Api\V1\Os\RecurringContractController::class, 'show']);
        });
        Route::middleware('check.permission:os.work_order.create')->group(function () {
            Route::post('recurring-contracts', [\App\Http\Controllers\Api\V1\Os\RecurringContractController::class, 'store']);
            Route::post('recurring-contracts/{recurring_contract}/generate', [\App\Http\Controllers\Api\V1\Os\RecurringContractController::class, 'generate']);
        });
        Route::middleware('check.permission:os.work_order.update')->put('recurring-contracts/{recurring_contract}', [\App\Http\Controllers\Api\V1\Os\RecurringContractController::class, 'update']);
        Route::middleware('check.permission:os.work_order.delete')->delete('recurring-contracts/{recurring_contract}', [\App\Http\Controllers\Api\V1\Os\RecurringContractController::class, 'destroy']);

        // T�f©cnicos / Campo
        Route::middleware('check.permission:technicians.schedule.view')->group(function () {
            Route::get('schedules-unified', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'unified']);
            Route::get('schedules', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'index']);
            Route::get('schedules/{schedule}', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'show']);
        });
        Route::middleware('check.permission:technicians.schedule.manage')->group(function () {
            Route::post('schedules', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'store']);
            Route::put('schedules/{schedule}', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'update']);
            Route::delete('schedules/{schedule}', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'destroy']);
        });
        Route::middleware('check.permission:technicians.time_entry.view')->group(function () {
            Route::get('time-entries', [\App\Http\Controllers\Api\V1\Technician\TimeEntryController::class, 'index']);
            Route::get('time-entries-summary', [\App\Http\Controllers\Api\V1\Technician\TimeEntryController::class, 'summary']);
        });
        Route::middleware('check.permission:technicians.time_entry.create')->group(function () {
            Route::post('time-entries', [\App\Http\Controllers\Api\V1\Technician\TimeEntryController::class, 'store']);
            Route::post('time-entries/start', [\App\Http\Controllers\Api\V1\Technician\TimeEntryController::class, 'start']);
            Route::post('time-entries/{time_entry}/stop', [\App\Http\Controllers\Api\V1\Technician\TimeEntryController::class, 'stop']);
        });
        Route::middleware('check.permission:technicians.time_entry.update')->put('time-entries/{time_entry}', [\App\Http\Controllers\Api\V1\Technician\TimeEntryController::class, 'update']);
        Route::middleware('check.permission:technicians.time_entry.delete')->delete('time-entries/{time_entry}', [\App\Http\Controllers\Api\V1\Technician\TimeEntryController::class, 'destroy']);

        // Financeiro â�,��?� Contas a Receber
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('accounts-receivable', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'index']);
            Route::get('accounts-receivable/{account_receivable}', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'show']);
            Route::get('accounts-receivable-summary', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'summary']);
        });
        Route::middleware('check.permission:finance.receivable.create')->group(function () {
            Route::post('accounts-receivable', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'store']);
            Route::post('accounts-receivable/generate-from-os', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'generateFromWorkOrder']);
            Route::post('accounts-receivable/installments', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'generateInstallments']);
        });
        Route::middleware('check.permission:finance.receivable.settle')->post('accounts-receivable/{account_receivable}/pay', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'pay']);
        Route::middleware('check.permission:finance.receivable.update')->put('accounts-receivable/{account_receivable}', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'update']);
        Route::middleware('check.permission:finance.receivable.delete')->delete('accounts-receivable/{account_receivable}', [\App\Http\Controllers\Api\V1\Financial\AccountReceivableController::class, 'destroy']);

        // Financeiro â�,��?� Contas a Pagar
        Route::middleware('check.permission:finance.payable.view')->group(function () {
            Route::get('accounts-payable', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'index']);
            Route::get('accounts-payable/{account_payable}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'show']);
            Route::get('accounts-payable-summary', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'summary']);
        });
        Route::middleware('check.permission:finance.payable.create')->post('accounts-payable', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'store']);
        Route::middleware('check.permission:finance.payable.settle')->post('accounts-payable/{account_payable}/pay', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'pay']);
        Route::middleware('check.permission:finance.payable.update')->put('accounts-payable/{account_payable}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'update']);
        Route::middleware('check.permission:finance.payable.delete')->delete('accounts-payable/{account_payable}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'destroy']);

        // Exportação Financeira (#27) �?" ambos os tipos via ?type=receivable|payable
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('financial/export/ofx', [\App\Http\Controllers\Api\V1\Financial\FinancialExportController::class, 'ofx']);
            Route::get('financial/export/csv', [\App\Http\Controllers\Api\V1\Financial\FinancialExportController::class, 'csv']);
        });

        // Comiss�fµes
        Route::middleware('check.permission:commissions.rule.view')->group(function () {
            Route::get('commission-rules', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'rules']);
            Route::get('commission-rules/{commission_rule}', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'showRule']);
            Route::get('commission-events', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'events']);
            Route::get('commission-settlements', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'settlements']);
            Route::get('commission-summary', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'summary']);
            Route::get('commission-calculation-types', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'calculationTypes']);
        });
        Route::middleware('check.permission:commissions.rule.create')->group(function () {
            Route::post('commission-rules', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'storeRule']);
            Route::post('commission-events/generate', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'generateForWorkOrder']);
            Route::post('commission-simulate', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'simulate']);
        });
        Route::middleware('check.permission:commissions.rule.update')->group(function () {
            Route::put('commission-rules/{commission_rule}', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'updateRule']);
            Route::put('commission-events/{commission_event}/status', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'updateEventStatus']);
        });
        Route::middleware('check.permission:commissions.rule.delete')->delete('commission-rules/{commission_rule}', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'destroyRule']);
        Route::middleware('check.permission:commissions.settlement.create')->group(function () {
            Route::post('commission-settlements/close', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'closeSettlement']);
            Route::post('commission-settlements/{commission_settlement}/pay', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'paySettlement']);
            Route::post('commission-settlements/{commission_settlement}/reopen', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'reopenSettlement']);
        });
        // Batch, Splits, Exports
        Route::middleware('check.permission:commissions.rule.update')->group(function () {
            Route::post('commission-events/batch-status', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'batchUpdateStatus']);
            Route::get('commission-events/{commission_event}/splits', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'eventSplits']);
            Route::post('commission-events/{commission_event}/splits', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'splitEvent']);
        });
        Route::middleware('check.permission:commissions.rule.view')->group(function () {
            Route::get('commission-events/export', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'exportEvents']);
            Route::get('commission-settlements/export', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'exportSettlements']);
            Route::get('commission-statement/pdf', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'downloadStatement']);
        });
        // Dashboard Anal�f­tico
        Route::middleware('check.permission:commissions.rule.view')->group(function () {
            Route::get('commission-dashboard/overview', [\App\Http\Controllers\Api\V1\Financial\CommissionDashboardController::class, 'overview']);
            Route::get('commission-dashboard/ranking', [\App\Http\Controllers\Api\V1\Financial\CommissionDashboardController::class, 'ranking']);
            Route::get('commission-dashboard/evolution', [\App\Http\Controllers\Api\V1\Financial\CommissionDashboardController::class, 'evolution']);
            Route::get('commission-dashboard/by-rule', [\App\Http\Controllers\Api\V1\Financial\CommissionDashboardController::class, 'byRule']);
            Route::get('commission-dashboard/by-role', [\App\Http\Controllers\Api\V1\Financial\CommissionDashboardController::class, 'byRole']);
        });
        // Contestações / Disputas
        Route::middleware('check.permission:commissions.dispute.view')->group(function () {
            Route::get('commission-disputes', [\App\Http\Controllers\Api\V1\Financial\CommissionDisputeController::class, 'index']);
        });
        Route::middleware('check.permission:commissions.dispute.create')->group(function () {
            Route::post('commission-disputes', [\App\Http\Controllers\Api\V1\Financial\CommissionDisputeController::class, 'store']);
        });
        Route::middleware('check.permission:commissions.dispute.resolve')->group(function () {
            Route::match(['post', 'put'], 'commission-disputes/{dispute}/resolve', [\App\Http\Controllers\Api\V1\Financial\CommissionDisputeController::class, 'resolve']);
        });
        // Metas de Vendas
        Route::middleware('check.permission:commissions.goal.view')->group(function () {
            Route::get('commission-goals', [\App\Http\Controllers\Api\V1\Financial\CommissionGoalController::class, 'index']);
        });
        Route::middleware('check.permission:commissions.goal.create')->group(function () {
            Route::post('commission-goals', [\App\Http\Controllers\Api\V1\Financial\CommissionGoalController::class, 'store']);
            Route::post('commission-goals/{goal}/refresh', [\App\Http\Controllers\Api\V1\Financial\CommissionGoalController::class, 'refreshAchievement']);
        });
        Route::middleware('check.permission:commissions.goal.update')->put('commission-goals/{goal}', [\App\Http\Controllers\Api\V1\Financial\CommissionGoalController::class, 'update']);
        Route::middleware('check.permission:commissions.goal.delete')->delete('commission-goals/{goal}', [\App\Http\Controllers\Api\V1\Financial\CommissionGoalController::class, 'destroy']);
        // Campanhas / Aceleradores
        Route::middleware('check.permission:commissions.campaign.view')->group(function () {
            Route::get('commission-campaigns', [\App\Http\Controllers\Api\V1\Financial\CommissionCampaignController::class, 'index']);
        });
        Route::middleware('check.permission:commissions.campaign.create')->post('commission-campaigns', [\App\Http\Controllers\Api\V1\Financial\CommissionCampaignController::class, 'store']);
        Route::middleware('check.permission:commissions.campaign.update')->put('commission-campaigns/{campaign}', [\App\Http\Controllers\Api\V1\Financial\CommissionCampaignController::class, 'update']);
        Route::middleware('check.permission:commissions.campaign.delete')->delete('commission-campaigns/{campaign}', [\App\Http\Controllers\Api\V1\Financial\CommissionCampaignController::class, 'destroy']);
        // Comissões Recorrentes
        Route::middleware('check.permission:commissions.recurring.view')->group(function () {
            Route::get('recurring-commissions', [\App\Http\Controllers\Api\V1\Financial\RecurringCommissionController::class, 'index']);
        });
        Route::middleware('check.permission:commissions.recurring.create')->group(function () {
            Route::post('recurring-commissions', [\App\Http\Controllers\Api\V1\Financial\RecurringCommissionController::class, 'store']);
            Route::post('recurring-commissions/process-monthly', [\App\Http\Controllers\Api\V1\Financial\RecurringCommissionController::class, 'processMonthly']);
            Route::post('recurring-commissions/process', [\App\Http\Controllers\Api\V1\Financial\RecurringCommissionController::class, 'processMonthly']); // compat alias
        });
        Route::middleware('check.permission:commissions.recurring.update')->put('recurring-commissions/{id}/status', [\App\Http\Controllers\Api\V1\Financial\RecurringCommissionController::class, 'updateStatus']);
        Route::middleware('check.permission:commissions.recurring.delete')->delete('recurring-commissions/{id}', [\App\Http\Controllers\Api\V1\Financial\RecurringCommissionController::class, 'destroy']);

        // Despesas
        Route::middleware('check.permission:expenses.expense.view')->group(function () {
            Route::get('expenses', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'index']);
            Route::get('expenses/{expense}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'show']);
            Route::get('expenses/{expense}/history', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'history']);
            Route::get('expense-categories', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'categories']);
            Route::get('expense-summary', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'summary']);
        });
        Route::middleware('check.permission:expenses.expense.create')->group(function () {
            Route::post('expenses', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'store']);
            Route::post('expenses/{expense}/duplicate', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'duplicate']);
            Route::post('expense-categories', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'storeCategory']);
        });
        Route::middleware('check.permission:expenses.expense.update')->group(function () {
            Route::put('expenses/{expense}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'update']);
            Route::put('expense-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'updateCategory']);
        });
        Route::middleware('check.permission:expenses.expense.approve')->put('expenses/{expense}/status', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'updateStatus']);
        Route::middleware('check.permission:expenses.expense.approve')->post('expenses/batch-status', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'batchUpdateStatus']);
        Route::middleware('check.permission:expenses.expense.view')->get('expenses-export', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'export']);
        Route::middleware('check.permission:expenses.expense.view')->get('expense-analytics', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'analytics']);
        Route::middleware('check.permission:expenses.expense.delete')->group(function () {
            Route::delete('expenses/{expense}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'destroy']);
            Route::delete('expense-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'destroyCategory']);
        });

        // Pagamentos
        Route::middleware('check.permission:finance.receivable.view|finance.payable.view')->group(function () {
            Route::get('payments', [\App\Http\Controllers\Api\V1\Financial\PaymentController::class, 'index']);
            Route::get('payments-summary', [\App\Http\Controllers\Api\V1\Financial\PaymentController::class, 'summary']);
        });
        Route::middleware('check.permission:finance.receivable.settle|finance.payable.settle')->delete('payments/{payment}', [\App\Http\Controllers\Api\V1\Financial\PaymentController::class, 'destroy']);

        // Faturamento / NF
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('invoices', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'index']);
            Route::get('invoices/metadata', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'metadata']);
            Route::get('invoices/{invoice}', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'show']);
        });
        Route::middleware('check.permission:finance.receivable.create')->post('invoices', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'store']);
        Route::middleware('check.permission:finance.receivable.update')->put('invoices/{invoice}', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'update']);
        Route::middleware('check.permission:finance.receivable.delete')->delete('invoices/{invoice}', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'destroy']);

        // Categorias de Contas a Pagar (edit�f¡veis)
        Route::middleware('check.permission:finance.payable.view')->get('account-payable-categories', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'index']);
        Route::middleware('check.permission:finance.payable.view')->get('accounts-payable-categories', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'index']); // compat
        Route::middleware('check.permission:finance.payable.create')->post('account-payable-categories', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'store']);
        Route::middleware('check.permission:finance.payable.create')->post('accounts-payable-categories', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'store']); // compat
        Route::middleware('check.permission:finance.payable.update')->put('account-payable-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'update']);
        Route::middleware('check.permission:finance.payable.update')->put('accounts-payable-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'update']); // compat
        Route::middleware('check.permission:finance.payable.delete')->delete('account-payable-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'destroy']);
        Route::middleware('check.permission:finance.payable.delete')->delete('accounts-payable-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'destroy']); // compat

        // Formas de Pagamento
        Route::middleware('check.permission:finance.payable.view|finance.receivable.view')->get('payment-methods', [PaymentMethodController::class, 'index']);
        Route::middleware('check.permission:finance.payable.create')->post('payment-methods', [PaymentMethodController::class, 'store']);
        Route::middleware('check.permission:finance.payable.update')->put('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update']);
        Route::middleware('check.permission:finance.payable.delete')->delete('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy']);

        // Relat�f³rios
        Route::middleware('check.permission:reports.os_report.view')->get('reports/work-orders', [\App\Http\Controllers\Api\V1\ReportController::class, 'workOrders']);
        Route::middleware('check.permission:reports.productivity_report.view')->get('reports/productivity', [\App\Http\Controllers\Api\V1\ReportController::class, 'productivity']);
        Route::middleware('check.permission:reports.financial_report.view')->get('reports/financial', [\App\Http\Controllers\Api\V1\ReportController::class, 'financial']);
        Route::middleware('check.permission:reports.commission_report.view')->get('reports/commissions', [\App\Http\Controllers\Api\V1\ReportController::class, 'commissions']);
        Route::middleware('check.permission:reports.margin_report.view')->get('reports/profitability', [\App\Http\Controllers\Api\V1\ReportController::class, 'profitability']);
        Route::middleware('check.permission:reports.quotes_report.view')->get('reports/quotes', [\App\Http\Controllers\Api\V1\ReportController::class, 'quotes']);
        Route::middleware('check.permission:reports.service_calls_report.view')->get('reports/service-calls', [\App\Http\Controllers\Api\V1\ReportController::class, 'serviceCalls']);
        Route::middleware('check.permission:reports.technician_cash_report.view')->get('reports/technician-cash', [\App\Http\Controllers\Api\V1\ReportController::class, 'technicianCash']);
        Route::middleware('check.permission:reports.crm_report.view')->get('reports/crm', [\App\Http\Controllers\Api\V1\ReportController::class, 'crm']);
        Route::middleware('check.permission:reports.equipments_report.view')->get('reports/equipments', [\App\Http\Controllers\Api\V1\ReportController::class, 'equipments']);
        Route::middleware('check.permission:reports.suppliers_report.view')->get('reports/suppliers', [\App\Http\Controllers\Api\V1\ReportController::class, 'suppliers']);
        Route::middleware('check.permission:reports.stock_report.view')->get('reports/stock', [\App\Http\Controllers\Api\V1\ReportController::class, 'stock']);
        Route::middleware('check.permission:reports.customers_report.view')->get('reports/customers', [\App\Http\Controllers\Api\V1\ReportController::class, 'customers']);
        Route::middleware('check.report.export')->get('reports/{type}/export', [\App\Http\Controllers\Api\V1\PdfController::class, 'reportExport']);
        // Importa�f§�f£o
        Route::middleware('check.permission:import.data.view')->group(function () {
            Route::get('import/fields/{entity}', [\App\Http\Controllers\Api\V1\ImportController::class, 'fields']);
            Route::get('import/history', [\App\Http\Controllers\Api\V1\ImportController::class, 'history']);
            Route::get('import/templates', [\App\Http\Controllers\Api\V1\ImportController::class, 'templates']);
            Route::get('import/sample/{entity}', [\App\Http\Controllers\Api\V1\ImportController::class, 'downloadSample']);
            Route::get('import/export/{entity}', [\App\Http\Controllers\Api\V1\ImportController::class, 'exportData']);
            Route::get('import/{id}/errors', [\App\Http\Controllers\Api\V1\ImportController::class, 'exportErrors']);
            Route::get('import/{id}', [\App\Http\Controllers\Api\V1\ImportController::class, 'show']);
            Route::get('import-stats', [\App\Http\Controllers\Api\V1\ImportController::class, 'stats']);
            Route::get('import-entity-counts', [\App\Http\Controllers\Api\V1\ImportController::class, 'entityCounts']);
        });
        Route::middleware('check.permission:import.data.execute')->group(function () {
            Route::post('import/upload', [\App\Http\Controllers\Api\V1\ImportController::class, 'upload']);
            Route::post('import/preview', [\App\Http\Controllers\Api\V1\ImportController::class, 'preview']);
            Route::post('import/execute', [\App\Http\Controllers\Api\V1\ImportController::class, 'execute']);
            Route::post('import/templates', [\App\Http\Controllers\Api\V1\ImportController::class, 'saveTemplate']);
        });
        Route::middleware('check.permission:import.data.delete')->group(function () {
            Route::delete('import/templates/{id}', [\App\Http\Controllers\Api\V1\ImportController::class, 'deleteTemplate']);
            Route::post('import/{id}/rollback', [\App\Http\Controllers\Api\V1\ImportController::class, 'rollback']);
            Route::delete('import/{id}', [\App\Http\Controllers\Api\V1\ImportController::class, 'destroy']);
        });

        // Inteligência INMETRO
        Route::middleware('check.permission:inmetro.intelligence.view')->group(function () {
            Route::get('inmetro/dashboard', [\App\Http\Controllers\Api\V1\InmetroController::class, 'dashboard']);
            Route::get('inmetro/owners', [\App\Http\Controllers\Api\V1\InmetroController::class, 'owners']);
            Route::get('inmetro/owners/{id}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'showOwner']);
            Route::get('inmetro/instruments', [\App\Http\Controllers\Api\V1\InmetroController::class, 'instruments']);
            Route::get('inmetro/instruments/{id}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'showInstrument']);
            Route::get('inmetro/leads', [\App\Http\Controllers\Api\V1\InmetroController::class, 'leads']);
            Route::get('inmetro/competitors', [\App\Http\Controllers\Api\V1\InmetroController::class, 'competitors']);
            Route::get('inmetro/cities', [\App\Http\Controllers\Api\V1\InmetroController::class, 'cities']);
            Route::get('inmetro/municipalities', [\App\Http\Controllers\Api\V1\InmetroController::class, 'municipalities']);
            Route::get('inmetro/conversion-stats', [\App\Http\Controllers\Api\V1\InmetroController::class, 'conversionStats']);
            Route::get('inmetro/export/leads', [\App\Http\Controllers\Api\V1\InmetroController::class, 'exportLeadsCsv']);
            Route::get('inmetro/export/instruments', [\App\Http\Controllers\Api\V1\InmetroController::class, 'exportInstrumentsCsv']);
        });
        Route::middleware('check.permission:inmetro.intelligence.import')->group(function () {
            Route::post('inmetro/import/xml', [\App\Http\Controllers\Api\V1\InmetroController::class, 'importXml']);
            Route::post('inmetro/import/psie-init', [\App\Http\Controllers\Api\V1\InmetroController::class, 'initPsieScrape']);
            Route::post('inmetro/import/psie-results', [\App\Http\Controllers\Api\V1\InmetroController::class, 'submitPsieResults']);
        });

        Route::middleware('check.permission:inmetro.intelligence.enrich')->group(function () {
            Route::post('inmetro/enrich/{ownerId}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'enrichOwner']);
            Route::post('inmetro/enrich-batch', [\App\Http\Controllers\Api\V1\InmetroController::class, 'enrichBatch']);
        });

        Route::middleware('check.permission:inmetro.intelligence.convert')->group(function () {
            Route::post('inmetro/convert/{ownerId}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'convertToCustomer']);
            Route::patch('inmetro/owners/{ownerId}/status', [\App\Http\Controllers\Api\V1\InmetroController::class, 'updateLeadStatus']);
            Route::post('inmetro/recalculate-priorities', [\App\Http\Controllers\Api\V1\InmetroController::class, 'recalculatePriorities']);
            Route::put('inmetro/owners/{id}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'update']);
            Route::delete('inmetro/owners/{id}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'destroy']);
        });

        // Configurações + Auditoria
        Route::middleware('check.permission:platform.settings.view')->get('settings', [\App\Http\Controllers\Api\V1\SettingsController::class, 'index']);
        Route::middleware('check.permission:platform.settings.manage')->put('settings', [\App\Http\Controllers\Api\V1\SettingsController::class, 'update']);

        // Orçamentos
        Route::middleware('check.permission:quotes.quote.view')->group(function () {
            Route::get('quotes', [\App\Http\Controllers\Api\V1\QuoteController::class, 'index']);
            Route::get('quotes/{quote}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'show']);
            Route::get('quotes-summary', [\App\Http\Controllers\Api\V1\QuoteController::class, 'summary']);
            Route::get('quotes/{quote}/timeline', [\App\Http\Controllers\Api\V1\QuoteController::class, 'timeline']);
            Route::get('quotes-export', [\App\Http\Controllers\Api\V1\QuoteController::class, 'exportCsv']);
        });
        Route::middleware('check.permission:quotes.quote.create')->group(function () {
            Route::post('quotes', [\App\Http\Controllers\Api\V1\QuoteController::class, 'store']);
            Route::post('quotes/{quote}/duplicate', [\App\Http\Controllers\Api\V1\QuoteController::class, 'duplicate']);
        });
        Route::middleware('check.permission:quotes.quote.update')->group(function () {
            Route::put('quotes/{quote}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'update']);
            Route::post('quotes/{quote}/equipments', [\App\Http\Controllers\Api\V1\QuoteController::class, 'addEquipment']);
            Route::put('quote-equipments/{equipment}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'updateEquipment']);
            Route::delete('quotes/{quote}/equipments/{equipment}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'removeEquipment']);
            Route::post('quote-equipments/{equipment}/items', [\App\Http\Controllers\Api\V1\QuoteController::class, 'addItem']);
            Route::put('quote-items/{item}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'updateItem']);
            Route::delete('quote-items/{item}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'removeItem']);
            Route::post('quotes/{quote}/photos', [\App\Http\Controllers\Api\V1\QuoteController::class, 'addPhoto']);
            Route::delete('quote-photos/{photo}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'removePhoto']);
            Route::post('quotes/{quote}/reopen', [\App\Http\Controllers\Api\V1\QuoteController::class, 'reopen']);
        });
        Route::middleware('check.permission:quotes.quote.approve')->group(function () {
            Route::post('quotes/{quote}/approve', [\App\Http\Controllers\Api\V1\QuoteController::class, 'approve']);
            Route::post('quotes/{quote}/reject', [\App\Http\Controllers\Api\V1\QuoteController::class, 'reject']);
        });
        Route::middleware('check.permission:quotes.quote.send')->post('quotes/{quote}/send', [\App\Http\Controllers\Api\V1\QuoteController::class, 'send']);
        Route::middleware('check.permission:quotes.quote.update')->post('quotes/{quote}/convert-to-os', [\App\Http\Controllers\Api\V1\QuoteController::class, 'convertToWorkOrder']);
        Route::middleware('check.permission:quotes.quote.delete')->delete('quotes/{quote}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'destroy']);

        // Chamados T�f©cnicos
        Route::middleware('check.permission:service_calls.service_call.view')->group(function () {
            Route::get('service-calls', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'index']);
            Route::get('service-calls-assignees', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'assignees']);
            Route::get('service-calls-map', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'mapData']);
            Route::get('service-calls/map-data', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'mapData']); // compat
            Route::get('service-calls-agenda', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'agenda']);
            Route::get('service-calls/agenda', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'agenda']); // compat
            Route::get('service-calls-summary', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'summary']);
            Route::get('service-calls-export', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'exportCsv']);
            Route::get('service-calls/{serviceCall}', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'show']);
            Route::get('service-calls/{serviceCall}/comments', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'comments']);
        });
        Route::middleware('check.permission:service_calls.service_call.create')->group(function () {
            Route::post('service-calls', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'store']);
            Route::post('service-calls/{serviceCall}/convert-to-os', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'convertToWorkOrder']);
            Route::post('service-calls/{serviceCall}/comments', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'addComment']);
        });
        Route::middleware('check.permission:service_calls.service_call.update')->group(function () {
            Route::put('service-calls/{serviceCall}', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'update']);
            Route::put('service-calls/{serviceCall}/status', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'updateStatus']);
        });
        Route::middleware('check.permission:service_calls.service_call.assign')->put('service-calls/{serviceCall}/assign', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'assignTechnician']);
        Route::middleware('check.permission:service_calls.service_call.delete')->delete('service-calls/{serviceCall}', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'destroy']);

        // Caixa do T�f©cnico
        Route::middleware('check.permission:technicians.cashbox.view')->group(function () {
            Route::get('technician-cash', [\App\Http\Controllers\Api\V1\TechnicianCashController::class, 'index']);
            Route::get('technician-cash/{userId}', [\App\Http\Controllers\Api\V1\TechnicianCashController::class, 'show']);
            Route::get('technician-cash-summary', [\App\Http\Controllers\Api\V1\TechnicianCashController::class, 'summary']);
        });
        Route::middleware('check.permission:technicians.cashbox.manage')->group(function () {
            Route::post('technician-cash/credit', [\App\Http\Controllers\Api\V1\TechnicianCashController::class, 'addCredit']);
            Route::post('technician-cash/debit', [\App\Http\Controllers\Api\V1\TechnicianCashController::class, 'addDebit']);
        });

        // Equipamentos
        Route::middleware('check.permission:equipments.equipment.view')->group(function () {
            Route::get('equipments', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'index']);
            Route::get('equipments/{equipment}', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'show']);
            Route::get('equipments-dashboard', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'dashboard']);
            Route::get('equipments-alerts', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'alerts']);
            Route::get('equipments-constants', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'constants']);
            Route::get('equipments/{equipment}/calibrations', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'calibrationHistory']);
            Route::get('equipments-export', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'exportCsv']);
        });
        Route::middleware('check.permission:equipments.equipment.create')->group(function () {
            Route::post('equipments', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'store']);
            Route::post('equipments/{equipment}/calibrations', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'addCalibration']);
            Route::post('equipments/{equipment}/maintenances', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'addMaintenance']);
            Route::post('equipments/{equipment}/documents', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'uploadDocument']);
        });
        Route::middleware('check.permission:equipments.equipment.update')->put('equipments/{equipment}', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'update']);
        Route::middleware('check.permission:equipments.equipment.delete')->group(function () {
            Route::delete('equipments/{equipment}', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'destroy']);
            Route::delete('equipment-documents/{document}', [\App\Http\Controllers\Api\V1\EquipmentController::class, 'deleteDocument']);
        });

        // Notifica�f§�fµes
        Route::middleware('check.permission:notifications.notification.view')->group(function () {
            Route::get('notifications', [\App\Http\Controllers\Api\V1\NotificationController::class, 'index']);
            Route::get('notifications/unread-count', [\App\Http\Controllers\Api\V1\NotificationController::class, 'unreadCount']);
        });
        Route::middleware('check.permission:notifications.notification.update')->group(function () {
            Route::put('notifications/{notification}/read', [\App\Http\Controllers\Api\V1\NotificationController::class, 'markRead']);
            Route::put('notifications/read-all', [\App\Http\Controllers\Api\V1\NotificationController::class, 'markAllRead']);
        });

        // PDF / Exports
        Route::middleware('check.permission:os.work_order.view')->get('work-orders/{work_order}/pdf', [\App\Http\Controllers\Api\V1\PdfController::class, 'workOrder']);
        Route::middleware('check.permission:quotes.quote.view')->get('quotes/{quote}/pdf', [\App\Http\Controllers\Api\V1\PdfController::class, 'quote']);
        Route::middleware('check.permission:equipments.equipment.view')->get('equipments/{equipment}/calibrations/{calibration}/pdf', [\App\Http\Controllers\Api\V1\PdfController::class, 'calibrationCertificate']);
        Route::middleware('check.report.export')->get('reports/{type}/export', [\App\Http\Controllers\Api\V1\PdfController::class, 'reportExport']);

        // Perfil do Usu�f¡rio (com permiss�fµes/roles expandidos)
        // FIX-B1: Usar FQCN para Api\V1\UserController (n�f£o confundir com Iam\UserController importado no topo)
        Route::get('profile', [\App\Http\Controllers\Api\V1\UserController::class, 'me']);
        Route::put('profile', [\App\Http\Controllers\Api\V1\UserController::class, 'updateProfile']);

        // Filiais
        Route::middleware('check.permission:platform.branch.view')->group(function () {
            Route::get('branches', [\App\Http\Controllers\Api\V1\BranchController::class, 'index']);
            Route::get('branches/{branch}', [\App\Http\Controllers\Api\V1\BranchController::class, 'show']);
        });
        Route::middleware('check.permission:platform.branch.create')->post('branches', [\App\Http\Controllers\Api\V1\BranchController::class, 'store']);
        Route::middleware('check.permission:platform.branch.update')->put('branches/{branch}', [\App\Http\Controllers\Api\V1\BranchController::class, 'update']);
        Route::middleware('check.permission:platform.branch.delete')->delete('branches/{branch}', [\App\Http\Controllers\Api\V1\BranchController::class, 'destroy']);

        // Tenant Management
        Route::middleware('check.permission:platform.tenant.view')->group(function () {
            Route::get('tenants', [\App\Http\Controllers\Api\V1\TenantController::class, 'index']);
            Route::get('tenants/{tenant}', [\App\Http\Controllers\Api\V1\TenantController::class, 'show']);
            Route::get('tenants-stats', [\App\Http\Controllers\Api\V1\TenantController::class, 'stats']);
        });
        Route::middleware('check.permission:platform.tenant.create')->group(function () {
            Route::post('tenants', [\App\Http\Controllers\Api\V1\TenantController::class, 'store']);
            Route::post('tenants/{tenant}/invite', [\App\Http\Controllers\Api\V1\TenantController::class, 'invite']);
        });
        Route::middleware('check.permission:platform.tenant.update')->group(function () {
            Route::put('tenants/{tenant}', [\App\Http\Controllers\Api\V1\TenantController::class, 'update']);
            Route::delete('tenants/{tenant}/users/{user}', [\App\Http\Controllers\Api\V1\TenantController::class, 'removeUser']);
        });
        Route::middleware('check.permission:platform.tenant.delete')->delete('tenants/{tenant}', [\App\Http\Controllers\Api\V1\TenantController::class, 'destroy']);


        // CRM
        Route::prefix('crm')->group(function () {
            Route::middleware('check.permission:crm.deal.view')->group(function () {
                Route::get('dashboard', [\App\Http\Controllers\Api\V1\CrmController::class, 'dashboard']);
                Route::get('constants', [\App\Http\Controllers\Api\V1\CrmController::class, 'constants']);
                Route::get('deals', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsIndex']);
                Route::get('deals/{deal}', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsShow']);
                Route::get('activities', [\App\Http\Controllers\Api\V1\CrmController::class, 'activitiesIndex']);
                Route::get('customers/{customer}/360', [\App\Http\Controllers\Api\V1\CrmController::class, 'customer360']);
            });
            Route::middleware('check.permission:crm.deal.create')->group(function () {
                Route::post('deals', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsStore']);
                Route::post('activities', [\App\Http\Controllers\Api\V1\CrmController::class, 'activitiesStore']);
            });
            Route::middleware('check.permission:crm.deal.update')->group(function () {
                Route::put('deals/{deal}', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsUpdate']);
                Route::put('deals/{deal}/stage', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsUpdateStage']);
                Route::put('deals/{deal}/won', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsMarkWon']);
                Route::put('deals/{deal}/lost', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsMarkLost']);
                Route::put('activities/{activity}', [\App\Http\Controllers\Api\V1\CrmController::class, 'activitiesUpdate']);
            });
            Route::middleware('check.permission:crm.deal.delete')->group(function () {
                Route::delete('deals/{deal}', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsDestroy']);
                Route::delete('activities/{activity}', [\App\Http\Controllers\Api\V1\CrmController::class, 'activitiesDestroy']);
            });

            // Pipelines
            Route::middleware('check.permission:crm.pipeline.view')->get('pipelines', [\App\Http\Controllers\Api\V1\CrmController::class, 'pipelinesIndex']);
            Route::middleware('check.permission:crm.pipeline.create')->post('pipelines', [\App\Http\Controllers\Api\V1\CrmController::class, 'pipelinesStore']);
            Route::middleware('check.permission:crm.pipeline.update')->group(function () {
                Route::put('pipelines/{pipeline}', [\App\Http\Controllers\Api\V1\CrmController::class, 'pipelinesUpdate']);
                Route::post('pipelines/{pipeline}/stages', [\App\Http\Controllers\Api\V1\CrmController::class, 'stagesStore']);
                Route::put('stages/{stage}', [\App\Http\Controllers\Api\V1\CrmController::class, 'stagesUpdate']);
                Route::delete('stages/{stage}', [\App\Http\Controllers\Api\V1\CrmController::class, 'stagesDestroy']);
                Route::put('pipelines/{pipeline}/stages/reorder', [\App\Http\Controllers\Api\V1\CrmController::class, 'stagesReorder']);
            });
            Route::middleware('check.permission:crm.pipeline.delete')->delete('pipelines/{pipeline}', [\App\Http\Controllers\Api\V1\CrmController::class, 'pipelinesDestroy']);

            // Messages
            Route::middleware('check.permission:crm.message.view')->group(function () {
                Route::get('messages', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'index']);
                Route::get('message-templates', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'templates']);
            });
            Route::middleware('check.permission:crm.message.send')->group(function () {
                Route::post('messages/send', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'send']);
                Route::post('message-templates', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'storeTemplate']);
                Route::put('message-templates/{template}', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'updateTemplate']);
                Route::delete('message-templates/{template}', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'destroyTemplate']);
            });
        });

        // â�?��,�â�?��,�â�?��,� Perfil do Usu�f¡rio â�?��,�â�?��,�â�?��,�
        // FIX-B5: Usar o controller de perfil (Api\V1\UserController), n�f£o o IAM
        Route::post('profile/change-password', [\App\Http\Controllers\Api\V1\UserController::class, 'changePassword']);

        // Relat�f³rios adicionais (suppliers, stock)
        Route::middleware('check.permission:reports.suppliers_report.view')->get('reports/suppliers', [\App\Http\Controllers\Api\V1\ReportController::class, 'suppliers']);
        Route::middleware('check.permission:reports.stock_report.view')->get('reports/stock', [\App\Http\Controllers\Api\V1\ReportController::class, 'stock']);

        // â�?��,�â�?��,�â�?��,� Opera�f§�fµes (Fase 5) â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�
        Route::middleware('check.permission:os.work_order.view')->group(function () {
            Route::apiResource('service-checklists', \App\Http\Controllers\Api\V1\ServiceChecklistController::class);
            Route::apiResource('sla-policies', \App\Http\Controllers\Api\V1\SlaPolicyController::class);
            Route::get('work-orders/{work_order}/checklist-responses', [\App\Http\Controllers\Api\V1\WorkOrderChecklistResponseController::class, 'index']);
        });
        Route::middleware('check.permission:os.work_order.update')->group(function () {
             Route::post('work-orders/{work_order}/checklist-responses', [\App\Http\Controllers\Api\V1\WorkOrderChecklistResponseController::class, 'store']);
        });

        // â�?��,�â�?��,�â�?��,� Agendamento T�f©cnico (Fase 5.4) â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�
        Route::middleware('check.permission:technicians.schedule.view')->group(function () {
            Route::get('schedules/conflicts', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'conflicts']);
            Route::get('schedules/workload', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'workloadSummary']);
            Route::get('schedules/suggest-routing', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'suggestRouting']);
        });

        // �?"�?"�?" Fusão de Clientes (Fase 6.2) �?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"
        Route::prefix('customers')->middleware('check.permission:cadastros.customer.update')->group(function () {
            Route::post('merge', [\App\Http\Controllers\Api\V1\Customer\CustomerMergeController::class, 'merge']);
            Route::get('search-duplicates', [\App\Http\Controllers\Api\V1\Customer\CustomerMergeController::class, 'searchDuplicates']);
        });

        // �?"�?"�?" SLA Dashboard (Brainstorm #13) �?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"�?"
        Route::prefix('sla-dashboard')->middleware('check.permission:os.work_order.view')->group(function () {
            Route::get('overview', [\App\Http\Controllers\Api\V1\SlaDashboardController::class, 'overview']);
            Route::get('breached', [\App\Http\Controllers\Api\V1\SlaDashboardController::class, 'breachedOrders']);
            Route::get('by-policy', [\App\Http\Controllers\Api\V1\SlaDashboardController::class, 'byPolicy']);
        });

        // â�?��,�â�?��,�â�?��,� DRE Comparativo (Brainstorm #7) â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�
        Route::middleware('check.permission:finance.dre.view')->get('cash-flow/dre-comparativo', [\App\Http\Controllers\Api\V1\CashFlowController::class, 'dreComparativo']);

        // â�?��,�â�?��,�â�?��,� Central (Inbox de Trabalho) â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�
        Route::prefix('central')->group(function () {
            Route::middleware('check.permission:central.item.view')->group(function () {
                Route::get('summary', [\App\Http\Controllers\Api\V1\CentralController::class, 'summary']);
                Route::get('constants', [\App\Http\Controllers\Api\V1\CentralController::class, 'constants']);
                Route::get('items', [\App\Http\Controllers\Api\V1\CentralController::class, 'index']);
                Route::get('items/{centralItem}', [\App\Http\Controllers\Api\V1\CentralController::class, 'show']);
                Route::post('items/{centralItem}/comments', [\App\Http\Controllers\Api\V1\CentralController::class, 'comment']);
            });

            Route::middleware('check.permission:central.create.task')->post('items', [\App\Http\Controllers\Api\V1\CentralController::class, 'store']);
            Route::middleware('check.permission:central.close.self')->patch('items/{centralItem}', [\App\Http\Controllers\Api\V1\CentralController::class, 'update']);
            Route::middleware('check.permission:central.assign')->post('items/{centralItem}/assign', [\App\Http\Controllers\Api\V1\CentralController::class, 'assign']);

            // Dashboard gerencial
            Route::middleware('check.permission:central.manage.kpis')->group(function () {
                Route::get('kpis', [\App\Http\Controllers\Api\V1\CentralController::class, 'kpis']);
                Route::get('workload', [\App\Http\Controllers\Api\V1\CentralController::class, 'workload']);
                Route::get('overdue-by-team', [\App\Http\Controllers\Api\V1\CentralController::class, 'overdueByTeam']);
            });

            // Regras de automacao (Fase 3)
            Route::middleware('check.permission:central.manage.rules')->group(function () {
                Route::get('rules', [\App\Http\Controllers\Api\V1\CentralController::class, 'rules']);
                Route::post('rules', [\App\Http\Controllers\Api\V1\CentralController::class, 'storeRule']);
                Route::patch('rules/{centralRule}', [\App\Http\Controllers\Api\V1\CentralController::class, 'updateRule']);
                Route::delete('rules/{centralRule}', [\App\Http\Controllers\Api\V1\CentralController::class, 'destroyRule']);
            });
        });


        // ─── APIs Externas (CEP, CNPJ, IBGE, Feriados) ──────────────
        Route::prefix('external')->group(function () {
            Route::get('cep/{cep}', [\App\Http\Controllers\Api\V1\ExternalApiController::class, 'cep']);
            Route::get('cnpj/{cnpj}', [\App\Http\Controllers\Api\V1\ExternalApiController::class, 'cnpj']);
            Route::get('holidays/{year}', [\App\Http\Controllers\Api\V1\ExternalApiController::class, 'holidays']);
            Route::get('banks', [\App\Http\Controllers\Api\V1\ExternalApiController::class, 'banks']);
            Route::get('ddd/{ddd}', [\App\Http\Controllers\Api\V1\ExternalApiController::class, 'ddd']);
            Route::get('states', [\App\Http\Controllers\Api\V1\ExternalApiController::class, 'states']);
            Route::get('states/{uf}/cities', [\App\Http\Controllers\Api\V1\ExternalApiController::class, 'cities']);
        });

    });
});

// â�?��,�â�?��,�â�?��,� Webhooks (verifica�f§�f£o por assinatura) â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�
Route::prefix('webhooks')->middleware('verify.webhook')->group(function () {
    Route::post('whatsapp', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'webhookWhatsApp']);
    Route::post('email', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'webhookEmail']);
});

// â�?��,�â�?��,�â�?��,� Rotas p�fºblicas (sem autentica�f§�f£o, com token) â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�â�?��,�
Route::prefix('quotes')->group(function () {
    Route::get('{quote}/public-view', [\App\Http\Controllers\Api\V1\QuoteController::class, 'publicView']);
    Route::post('{quote}/public-approve', [\App\Http\Controllers\Api\V1\QuoteController::class, 'publicApprove']);
});
