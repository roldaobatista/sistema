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
| API Routes — /api/v1/*
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // --- Auth (público) ---
    Route::post('/login', [AuthController::class, 'login']);

    // --- Rotas autenticadas ---
    Route::middleware(['auth:sanctum', 'tenant.scope'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/my-tenants', [AuthController::class, 'myTenants']);
        Route::post('/switch-tenant', [AuthController::class, 'switchTenant']);
        Route::middleware('check.permission:platform.dashboard.view')->get('/dashboard-stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);
        Route::middleware('check.permission:finance.cashflow.view')->get('/cash-flow', [\App\Http\Controllers\Api\V1\CashFlowController::class, 'cashFlow']);
        Route::middleware('check.permission:finance.dre.view')->get('/dre', [\App\Http\Controllers\Api\V1\CashFlowController::class, 'dre']);

        // IAM
        Route::middleware('check.permission:iam.user.view')->group(function () {
            Route::apiResource('users', UserController::class)->only(['index', 'show']);
        });
        Route::middleware('check.permission:iam.user.create')->post('users', [UserController::class, 'store']);
        Route::middleware('check.permission:iam.user.update')->group(function () {
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::post('users/{user}/toggle-active', [UserController::class, 'toggleActive']);
            Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
        });
        Route::middleware('check.permission:iam.user.view')->get('users/by-role/{role}', [UserController::class, 'byRole']);
        Route::middleware('check.permission:iam.user.delete')->delete('users/{user}', [UserController::class, 'destroy']);
        Route::middleware('check.permission:iam.role.view')->group(function () {
            Route::apiResource('roles', RoleController::class)->only(['index', 'show']);
            Route::get('permissions', [PermissionController::class, 'index']);
            Route::get('permissions/matrix', [PermissionController::class, 'matrix']);
        });
        Route::middleware('check.permission:iam.role.create')->post('roles', [RoleController::class, 'store']);
        Route::middleware('check.permission:iam.role.update')->put('roles/{role}', [RoleController::class, 'update']);
        Route::middleware('check.permission:iam.role.delete')->delete('roles/{role}', [RoleController::class, 'destroy']);

        // Cadastros
        Route::middleware('check.permission:cadastros.customer.view')->get('customers', [CustomerController::class, 'index']);
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

        // OS
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
        Route::middleware('check.permission:os.work_order.change_status')->post('work-orders/{work_order}/status', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'updateStatus']);
        Route::middleware('check.permission:os.work_order.delete')->delete('work-orders/{work_order}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'destroy']);
        // Anexos/Fotos da OS
        Route::middleware('check.permission:os.work_order.view')->get('work-orders/{work_order}/attachments', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'attachments']);
        Route::middleware('check.permission:os.work_order.update')->group(function () {
            Route::post('work-orders/{work_order}/attachments', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'storeAttachment']);
            Route::delete('work-orders/{work_order}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'destroyAttachment']);
            Route::post('work-orders/{work_order}/signature', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'storeSignature']);
            // Equipamentos da OS (múltiplos)
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

        // Técnicos / Campo
        Route::middleware('check.permission:technicians.schedule.view')->group(function () {
            Route::get('schedules', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'index']);
            Route::get('schedules/{schedule}', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'show']);
            Route::get('schedules-unified', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'unified']);
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

        // Financeiro — Contas a Receber
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

        // Financeiro — Contas a Pagar
        Route::middleware('check.permission:finance.payable.view')->group(function () {
            Route::get('accounts-payable', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'index']);
            Route::get('accounts-payable/{account_payable}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'show']);
            Route::get('accounts-payable-summary', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'summary']);
        });
        Route::middleware('check.permission:finance.payable.create')->post('accounts-payable', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'store']);
        Route::middleware('check.permission:finance.payable.settle')->post('accounts-payable/{account_payable}/pay', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'pay']);
        Route::middleware('check.permission:finance.payable.update')->put('accounts-payable/{account_payable}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'update']);
        Route::middleware('check.permission:finance.payable.delete')->delete('accounts-payable/{account_payable}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableController::class, 'destroy']);

        // Exportação Financeira (#27)
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('financial/export/ofx', [\App\Http\Controllers\Api\V1\Financial\FinancialExportController::class, 'ofx']);
            Route::get('financial/export/csv', [\App\Http\Controllers\Api\V1\Financial\FinancialExportController::class, 'csv']);
        });
        Route::middleware('check.permission:finance.payable.view')->group(function () {
            Route::get('financial/export/payables/ofx', [\App\Http\Controllers\Api\V1\Financial\FinancialExportController::class, 'ofx']);
            Route::get('financial/export/payables/csv', [\App\Http\Controllers\Api\V1\Financial\FinancialExportController::class, 'csv']);
        });

        // Comissões
        Route::middleware('check.permission:commissions.rule.view')->group(function () {
            Route::get('commission-rules', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'rules']);
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
        });

        // Despesas
        Route::middleware('check.permission:expenses.expense.view')->group(function () {
            Route::get('expenses', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'index']);
            Route::get('expenses/{expense}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'show']);
            Route::get('expense-categories', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'categories']);
            Route::get('expense-summary', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'summary']);
        });
        Route::middleware('check.permission:expenses.expense.create')->group(function () {
            Route::post('expenses', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'store']);
            Route::post('expense-categories', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'storeCategory']);
        });
        Route::middleware('check.permission:expenses.expense.update')->group(function () {
            Route::put('expenses/{expense}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'update']);
            Route::put('expense-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'updateCategory']);
        });
        Route::middleware('check.permission:expenses.expense.approve')->put('expenses/{expense}/status', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'updateStatus']);
        Route::middleware('check.permission:expenses.expense.delete')->group(function () {
            Route::delete('expenses/{expense}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'destroy']);
            Route::delete('expense-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'destroyCategory']);
        });

        // Pagamentos (listagem read-only)
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('payments', [\App\Http\Controllers\Api\V1\Financial\PaymentController::class, 'index']);
            Route::get('payments-summary', [\App\Http\Controllers\Api\V1\Financial\PaymentController::class, 'summary']);
        });

        // Faturamento / NF
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('invoices', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'index']);
            Route::get('invoices/{invoice}', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'show']);
        });
        Route::middleware('check.permission:finance.receivable.create')->post('invoices', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'store']);
        Route::middleware('check.permission:finance.receivable.update')->put('invoices/{invoice}', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'update']);
        Route::middleware('check.permission:finance.receivable.delete')->delete('invoices/{invoice}', [\App\Http\Controllers\Api\V1\InvoiceController::class, 'destroy']);

        // Categorias de Contas a Pagar (editáveis)
        Route::get('account-payable-categories', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'index']);
        Route::middleware('check.permission:finance.payable.create')->post('account-payable-categories', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'store']);
        Route::middleware('check.permission:finance.payable.update')->put('account-payable-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'update']);
        Route::middleware('check.permission:finance.payable.delete')->delete('account-payable-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\AccountPayableCategoryController::class, 'destroy']);

        // Formas de Pagamento
        Route::get('payment-methods', [PaymentMethodController::class, 'index']);
        Route::middleware('check.permission:platform.settings.manage')->group(function () {
            Route::post('payment-methods', [PaymentMethodController::class, 'store']);
            Route::put('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update']);
            Route::delete('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy']);
        });

        // Relatórios
        Route::middleware('check.permission:reports.os_report.view')->get('reports/work-orders', [\App\Http\Controllers\Api\V1\ReportController::class, 'workOrders']);
        Route::middleware('check.permission:reports.productivity_report.view')->get('reports/productivity', [\App\Http\Controllers\Api\V1\ReportController::class, 'productivity']);
        Route::middleware('check.permission:reports.financial_report.view')->get('reports/financial', [\App\Http\Controllers\Api\V1\ReportController::class, 'financial']);
        Route::middleware('check.permission:reports.commission_report.view')->get('reports/commissions', [\App\Http\Controllers\Api\V1\ReportController::class, 'commissions']);
        Route::middleware('check.permission:reports.margin_report.view')->get('reports/profitability', [\App\Http\Controllers\Api\V1\ReportController::class, 'profitability']);
        Route::middleware('check.permission:reports.os_report.view')->get('reports/quotes', [\App\Http\Controllers\Api\V1\ReportController::class, 'quotes']);
        Route::middleware('check.permission:reports.os_report.view')->get('reports/service-calls', [\App\Http\Controllers\Api\V1\ReportController::class, 'serviceCalls']);
        Route::middleware('check.permission:reports.financial_report.view')->get('reports/technician-cash', [\App\Http\Controllers\Api\V1\ReportController::class, 'technicianCash']);
        Route::middleware('check.permission:reports.os_report.view')->get('reports/crm', [\App\Http\Controllers\Api\V1\ReportController::class, 'crm']);
        Route::middleware('check.permission:reports.os_report.view')->get('reports/equipments', [\App\Http\Controllers\Api\V1\ReportController::class, 'equipments']);
        // Importação
        Route::middleware('check.permission:import.data.view')->group(function () {
            Route::get('import/fields/{entity}', [\App\Http\Controllers\Api\V1\ImportController::class, 'fields']);
            Route::get('import/history', [\App\Http\Controllers\Api\V1\ImportController::class, 'history']);
            Route::get('import/templates', [\App\Http\Controllers\Api\V1\ImportController::class, 'templates']);
        });
        Route::middleware('check.permission:import.data.execute')->group(function () {
            Route::post('import/upload', [\App\Http\Controllers\Api\V1\ImportController::class, 'upload']);
            Route::post('import/preview', [\App\Http\Controllers\Api\V1\ImportController::class, 'preview']);
            Route::post('import/execute', [\App\Http\Controllers\Api\V1\ImportController::class, 'execute']);
            Route::post('import/templates', [\App\Http\Controllers\Api\V1\ImportController::class, 'saveTemplate']);
        });

        // Configurações + Auditoria
        Route::middleware('check.permission:platform.settings.view')->get('settings', [\App\Http\Controllers\Api\V1\SettingsController::class, 'index']);
        Route::middleware('check.permission:platform.settings.manage')->put('settings', [\App\Http\Controllers\Api\V1\SettingsController::class, 'update']);
        Route::middleware('check.permission:iam.audit_log.view')->get('audit-logs', [\App\Http\Controllers\Api\V1\SettingsController::class, 'auditLogs']);

        // Orçamentos
        Route::middleware('check.permission:quotes.quote.view')->group(function () {
            Route::get('quotes', [\App\Http\Controllers\Api\V1\QuoteController::class, 'index']);
            Route::get('quotes/{quote}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'show']);
            Route::get('quotes-summary', [\App\Http\Controllers\Api\V1\QuoteController::class, 'summary']);
        });
        Route::middleware('check.permission:quotes.quote.create')->group(function () {
            Route::post('quotes', [\App\Http\Controllers\Api\V1\QuoteController::class, 'store']);
            Route::post('quotes/{quote}/duplicate', [\App\Http\Controllers\Api\V1\QuoteController::class, 'duplicate']);
        });
        Route::middleware('check.permission:quotes.quote.update')->group(function () {
            Route::put('quotes/{quote}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'update']);
            Route::post('quotes/{quote}/equipments', [\App\Http\Controllers\Api\V1\QuoteController::class, 'addEquipment']);
            Route::delete('quotes/{quote}/equipments/{equipment}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'removeEquipment']);
            Route::post('quote-equipments/{equipment}/items', [\App\Http\Controllers\Api\V1\QuoteController::class, 'addItem']);
            Route::delete('quote-items/{item}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'removeItem']);
            Route::post('quotes/{quote}/photos', [\App\Http\Controllers\Api\V1\QuoteController::class, 'addPhoto']);
            Route::delete('quote-photos/{photo}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'removePhoto']);
        });
        Route::middleware('check.permission:quotes.quote.approve')->group(function () {
            Route::post('quotes/{quote}/approve', [\App\Http\Controllers\Api\V1\QuoteController::class, 'approve']);
            Route::post('quotes/{quote}/reject', [\App\Http\Controllers\Api\V1\QuoteController::class, 'reject']);
        });
        Route::middleware('check.permission:quotes.quote.send')->post('quotes/{quote}/send', [\App\Http\Controllers\Api\V1\QuoteController::class, 'send']);
        Route::middleware('check.permission:quotes.quote.update')->post('quotes/{quote}/convert-to-os', [\App\Http\Controllers\Api\V1\QuoteController::class, 'convertToWorkOrder']);
        Route::middleware('check.permission:quotes.quote.delete')->delete('quotes/{quote}', [\App\Http\Controllers\Api\V1\QuoteController::class, 'destroy']);

        // Chamados Técnicos
        Route::middleware('check.permission:service_calls.service_call.view')->group(function () {
            Route::get('service-calls', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'index']);
            Route::get('service-calls/{serviceCall}', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'show']);
            Route::get('service-calls-map', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'mapData']);
            Route::get('service-calls-agenda', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'agenda']);
            Route::get('service-calls-summary', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'summary']);
        });
        Route::middleware('check.permission:service_calls.service_call.create')->group(function () {
            Route::post('service-calls', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'store']);
            Route::post('service-calls/{serviceCall}/convert-to-os', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'convertToWorkOrder']);
        });
        Route::middleware('check.permission:service_calls.service_call.update')->group(function () {
            Route::put('service-calls/{serviceCall}', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'update']);
            Route::put('service-calls/{serviceCall}/status', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'updateStatus']);
        });
        Route::middleware('check.permission:service_calls.service_call.assign')->put('service-calls/{serviceCall}/assign', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'assignTechnician']);
        Route::middleware('check.permission:service_calls.service_call.delete')->delete('service-calls/{serviceCall}', [\App\Http\Controllers\Api\V1\ServiceCallController::class, 'destroy']);

        // Caixa do Técnico
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

        // Notificações
        Route::get('notifications', [\App\Http\Controllers\Api\V1\NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [\App\Http\Controllers\Api\V1\NotificationController::class, 'unreadCount']);
        Route::put('notifications/{notification}/read', [\App\Http\Controllers\Api\V1\NotificationController::class, 'markRead']);
        Route::put('notifications/read-all', [\App\Http\Controllers\Api\V1\NotificationController::class, 'markAllRead']);

        // PDF / Exports
        Route::middleware('check.permission:os.work_order.view')->get('work-orders/{work_order}/pdf', [\App\Http\Controllers\Api\V1\PdfController::class, 'workOrder']);
        Route::middleware('check.permission:quotes.quote.view')->get('quotes/{quote}/pdf', [\App\Http\Controllers\Api\V1\PdfController::class, 'quote']);
        Route::middleware('check.permission:equipments.equipment.view')->get('equipments/{equipment}/calibrations/{calibration}/pdf', [\App\Http\Controllers\Api\V1\PdfController::class, 'calibrationCertificate']);
        Route::middleware('check.permission:reports.os_report.view')->get('reports/{type}/export', [\App\Http\Controllers\Api\V1\PdfController::class, 'reportExport']);

        // Perfil do Usuário (com permissões/roles expandidos)
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
        Route::middleware('check.permission:platform.tenant.update')->put('tenants/{tenant}', [\App\Http\Controllers\Api\V1\TenantController::class, 'update']);
        Route::middleware('check.permission:platform.tenant.delete')->group(function () {
            Route::delete('tenants/{tenant}', [\App\Http\Controllers\Api\V1\TenantController::class, 'destroy']);
            Route::delete('tenants/{tenant}/users/{user}', [\App\Http\Controllers\Api\V1\TenantController::class, 'removeUser']);
        });

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
            });
            Route::middleware('check.permission:crm.deal.delete')->delete('deals/{deal}', [\App\Http\Controllers\Api\V1\CrmController::class, 'dealsDestroy']);

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

        // ─── Perfil do Usuário ───
        Route::post('profile/change-password', [UserController::class, 'changePassword']);

        // ─── Relatórios (#18, #19 — novos) ───
        Route::prefix('reports')->group(function () {
            Route::get('work-orders', [\App\Http\Controllers\Api\V1\ReportController::class, 'workOrders']);
            Route::get('productivity', [\App\Http\Controllers\Api\V1\ReportController::class, 'productivity']);
            Route::get('financial', [\App\Http\Controllers\Api\V1\ReportController::class, 'financial']);
            Route::get('commissions', [\App\Http\Controllers\Api\V1\ReportController::class, 'commissions']);
            Route::get('profitability', [\App\Http\Controllers\Api\V1\ReportController::class, 'profitability']);
            Route::get('quotes', [\App\Http\Controllers\Api\V1\ReportController::class, 'quotes']);
            Route::get('service-calls', [\App\Http\Controllers\Api\V1\ReportController::class, 'serviceCalls']);
            Route::get('technician-cash', [\App\Http\Controllers\Api\V1\ReportController::class, 'technicianCash']);
            Route::get('crm', [\App\Http\Controllers\Api\V1\ReportController::class, 'crm']);
            Route::get('equipments', [\App\Http\Controllers\Api\V1\ReportController::class, 'equipments']);
            Route::get('suppliers', [\App\Http\Controllers\Api\V1\ReportController::class, 'suppliers']);
            Route::get('stock', [\App\Http\Controllers\Api\V1\ReportController::class, 'stock']);
        });
    });
});

// ─── Webhooks (verificação por assinatura) ────────────────────
Route::prefix('webhooks')->middleware('verify.webhook')->group(function () {
    Route::post('whatsapp', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'webhookWhatsApp']);
    Route::post('email', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'webhookEmail']);
});

// ─── Rotas públicas (sem autenticação, com token) ────────────────────
Route::prefix('quotes')->group(function () {
    Route::get('{quote}/public-view', [\App\Http\Controllers\Api\V1\QuoteController::class, 'publicView']);
    Route::post('{quote}/public-approve', [\App\Http\Controllers\Api\V1\QuoteController::class, 'publicApprove']);
});
