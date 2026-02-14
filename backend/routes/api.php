<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\Operational\ExpressWorkOrderController;
use App\Http\Controllers\Api\V1\Operational\NpsController;
use App\Http\Controllers\Api\V1\Operational\ChecklistController;
use App\Http\Controllers\Api\V1\Operational\ChecklistSubmissionController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Iam\UserController;
use App\Http\Controllers\Api\V1\Iam\RoleController;
use App\Http\Controllers\Api\V1\Iam\PermissionController;
use App\Http\Controllers\Api\V1\Master\CustomerController;
use App\Http\Controllers\Api\V1\Master\ProductController;
use App\Http\Controllers\Api\V1\Master\ServiceController;
use App\Http\Controllers\Api\V1\Master\SupplierController;
use App\Http\Controllers\Api\V1\PaymentMethodController;
use App\Http\Controllers\Api\V1\WarehouseController;
use App\Http\Controllers\Api\V1\WarehouseStockController;
use App\Http\Controllers\Api\V1\BatchController;
use App\Http\Controllers\Api\V1\XmlImportController;
use App\Http\Controllers\Api\V1\ProductKitController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\KardexController;
use App\Http\Controllers\Api\V1\StockIntelligenceController;
use App\Http\Controllers\Api\V1\Fleet\VehicleTireController;
use App\Http\Controllers\Api\V1\Fleet\FuelLogController;
use App\Http\Controllers\Api\V1\Fleet\VehiclePoolController;
use App\Http\Controllers\Api\V1\Fleet\VehicleAccidentController;
use App\Http\Controllers\Api\V1\Fleet\VehicleInspectionController;

/*
|--------------------------------------------------------------------------
| API Routes â�,��?� /api/v1/*
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // --- Auth (público) ---
    Route::middleware('throttle:60,1')->post('/login', [AuthController::class, 'login']);

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
        Route::post('/user/location', [\App\Http\Controllers\Api\V1\Iam\UserLocationController::class, 'update']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/my-tenants', [AuthController::class, 'myTenants']);
        Route::post('/switch-tenant', [AuthController::class, 'switchTenant']);
        Route::middleware('check.permission:platform.dashboard.view')->get('/dashboard-stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);
        Route::get('/tv/dashboard', [\App\Http\Controllers\TvDashboardController::class, 'index']); // Wallboard
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
        Route::middleware('check.permission:iam.permission.manage')->post('permissions/toggle', [PermissionController::class, 'toggleRolePermission']);
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
        Route::middleware('check.permission:cadastros.customer.view')->get('customers/options', [CustomerController::class, 'options']);
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

        // CRM & BI
        Route::middleware('check.permission:reports.crm_report.view')->group(function () {
            Route::get('crm/customer-360/{id}', [\App\Http\Controllers\Api\V1\CrmController::class, 'customer360']);
            Route::get('crm/customer-360/{id}/pdf', [\App\Http\Controllers\Api\V1\CrmController::class, 'export360']);
            Route::get('crm/dashboard', [\App\Http\Controllers\Api\V1\CrmController::class, 'dashboard']);
        });

        // Estoque
        Route::middleware('check.permission:estoque.movement.view')->group(function () {
            Route::get('stock/movements', [\App\Http\Controllers\Api\V1\StockController::class, 'movements']);
            Route::get('stock/summary', [\App\Http\Controllers\Api\V1\StockController::class, 'summary']);
            Route::get('stock/low-alerts', [\App\Http\Controllers\Api\V1\StockController::class, 'lowStockAlerts']);
            Route::get('stock/low-stock-alerts', [\App\Http\Controllers\Api\V1\StockController::class, 'lowStockAlerts']); // compat alias
            
            // Kits
            Route::get('products/{product}/kit', [ProductKitController::class, 'index']);
            Route::post('products/{product}/kit', [ProductKitController::class, 'store']);
            Route::delete('products/{product}/kit/{childId}', [ProductKitController::class, 'destroy']);

            // Inventário Cego
            Route::get('inventories', [InventoryController::class, 'index']);
            Route::post('inventories', [InventoryController::class, 'store']);
            Route::get('inventories/{inventory}', [InventoryController::class, 'show']);
            Route::put('inventories/{inventory}/items/{item}', [InventoryController::class, 'updateItem']);
            Route::post('inventories/{inventory}/complete', [InventoryController::class, 'complete']);
            Route::post('inventories/{inventory}/cancel', [InventoryController::class, 'cancel']);

            // Kardex
            Route::get('products/{product}/kardex', [KardexController::class, 'show']);

            // Inteligência de Estoque
            Route::get('stock/intelligence/abc-curve', [StockIntelligenceController::class, 'abcCurve']);
            Route::get('stock/intelligence/turnover', [StockIntelligenceController::class, 'turnover']);
            Route::get('stock/intelligence/average-cost', [StockIntelligenceController::class, 'averageCost']);
            Route::get('stock/intelligence/reorder-points', [StockIntelligenceController::class, 'reorderPoints']);
            Route::get('stock/intelligence/reservations', [StockIntelligenceController::class, 'reservations']);
        });
        Route::middleware('check.permission:estoque.movement.create')->group(function () {
            Route::post('stock/movements', [\App\Http\Controllers\Api\V1\StockController::class, 'store']);
            Route::post('stock/import-xml', [\App\Http\Controllers\Api\V1\XmlImportController::class, 'import']);
        });

        // ═══ Cotação de Compras ═══
        Route::middleware('check.permission:estoque.movement.view')->group(function () {
            Route::get('purchase-quotes', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'purchaseQuoteIndex']);
            Route::post('purchase-quotes', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'purchaseQuoteStore']);
            Route::get('purchase-quotes/{purchaseQuote}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'purchaseQuoteShow']);
            Route::put('purchase-quotes/{purchaseQuote}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'purchaseQuoteUpdate']);
            Route::delete('purchase-quotes/{purchaseQuote}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'purchaseQuoteDestroy']);
        });

        // ═══ Solicitação de Material ═══
        Route::middleware('check.permission:estoque.movement.view')->group(function () {
            Route::get('material-requests', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'materialRequestIndex']);
            Route::post('material-requests', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'materialRequestStore']);
            Route::get('material-requests/{materialRequest}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'materialRequestShow']);
            Route::put('material-requests/{materialRequest}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'materialRequestUpdate']);
        });

        // ═══ Tags RFID/QR ═══
        Route::middleware('check.permission:estoque.movement.view')->group(function () {
            Route::get('asset-tags', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'assetTagIndex']);
            Route::post('asset-tags', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'assetTagStore']);
            Route::get('asset-tags/{assetTag}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'assetTagShow']);
            Route::put('asset-tags/{assetTag}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'assetTagUpdate']);
            Route::post('asset-tags/{assetTag}/scan', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'assetTagScan']);
        });

        // ═══ RMA (Devolução) ═══
        Route::middleware('check.permission:estoque.movement.view')->group(function () {
            Route::get('rma', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'rmaIndex']);
            Route::post('rma', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'rmaStore']);
            Route::get('rma/{rmaRequest}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'rmaShow']);
            Route::put('rma/{rmaRequest}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'rmaUpdate']);
        });

        // ═══ Descarte Ecológico ═══
        Route::middleware('check.permission:estoque.movement.view')->group(function () {
            Route::get('stock-disposals', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'disposalIndex']);
            Route::post('stock-disposals', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'disposalStore']);
            Route::get('stock-disposals/{stockDisposal}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'disposalShow']);
            Route::put('stock-disposals/{stockDisposal}', [\App\Http\Controllers\Api\V1\StockIntegrationController::class, 'disposalUpdate']);
        });

        // Armazéns e Saldos por Local
        Route::middleware('check.permission:estoque.warehouse.view')->group(function () {
            Route::apiResource('warehouses', \App\Http\Controllers\Api\V1\WarehouseController::class);
            Route::apiResource('batches', \App\Http\Controllers\Api\V1\BatchController::class);
            Route::get('warehouse-stocks', \App\Http\Controllers\Api\V1\WarehouseStockController::class . '@index');
            Route::get('warehouses/{warehouse}/stocks', \App\Http\Controllers\Api\V1\WarehouseStockController::class . '@byWarehouse');
            Route::get('products/{product}/warehouse-stocks', \App\Http\Controllers\Api\V1\WarehouseStockController::class . '@byProduct');
        });

        // Conciliação Bancária (expandido com Motor de Regras)
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('bank-reconciliation/summary', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'summary']);
            Route::get('bank-reconciliation/statements', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'statements']);
            Route::get('bank-reconciliation/statements/{statement}/entries', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'entries']);
            Route::get('bank-reconciliation/entries/{entry}/suggestions', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'suggestions']);
            Route::get('bank-reconciliation/entries/{entry}/history', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'entryHistory']);
            Route::get('bank-reconciliation/search-financials', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'searchFinancials']);
            Route::get('bank-reconciliation/statements/{statement}/export', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'exportStatement']);
            Route::get('bank-reconciliation/statements/{statement}/export-pdf', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'exportPdf']);
            Route::get('bank-reconciliation/dashboard', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'dashboardData']);
        });
        Route::middleware('check.permission:finance.receivable.create')->group(function () {
            Route::post('bank-reconciliation/import', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'import']);
            Route::post('bank-reconciliation/entries/{entry}/match', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'matchEntry']);
            Route::post('bank-reconciliation/entries/{entry}/ignore', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'ignoreEntry']);
            Route::post('bank-reconciliation/entries/{entry}/unmatch', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'unmatchEntry']);
            Route::post('bank-reconciliation/entries/{entry}/suggest-rule', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'suggestRule']);
            Route::post('bank-reconciliation/bulk-action', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'bulkAction']);
        });
        Route::middleware('check.permission:finance.receivable.delete')->delete('bank-reconciliation/statements/{statement}', [\App\Http\Controllers\Api\V1\BankReconciliationController::class, 'destroyStatement']);

        // Regras de Conciliação Automática
        Route::middleware('check.permission:finance.receivable.view')->group(function () {
            Route::get('reconciliation-rules', [\App\Http\Controllers\Api\V1\ReconciliationRuleController::class, 'index']);
            Route::get('reconciliation-rules/{rule}', [\App\Http\Controllers\Api\V1\ReconciliationRuleController::class, 'show']);
            Route::post('reconciliation-rules/test', [\App\Http\Controllers\Api\V1\ReconciliationRuleController::class, 'testRule']);
        });
        Route::middleware('check.permission:finance.receivable.create')->group(function () {
            Route::post('reconciliation-rules', [\App\Http\Controllers\Api\V1\ReconciliationRuleController::class, 'store']);
            Route::put('reconciliation-rules/{rule}', [\App\Http\Controllers\Api\V1\ReconciliationRuleController::class, 'update']);
            Route::post('reconciliation-rules/{rule}/toggle', [\App\Http\Controllers\Api\V1\ReconciliationRuleController::class, 'toggleActive']);
        });
        Route::middleware('check.permission:finance.receivable.delete')->delete('reconciliation-rules/{rule}', [\App\Http\Controllers\Api\V1\ReconciliationRuleController::class, 'destroy']);

        // Fiscal — NF-e / NFS-e
        Route::middleware('check.permission:fiscal.note.view')->group(function () {
            Route::get('fiscal/notas', [\App\Http\Controllers\Api\V1\FiscalController::class, 'index']);
            Route::get('fiscal/notas/{id}', [\App\Http\Controllers\Api\V1\FiscalController::class, 'show']);
            Route::get('fiscal/notas/{id}/pdf', [\App\Http\Controllers\Api\V1\FiscalController::class, 'downloadPdf']);
            Route::get('fiscal/notas/{id}/xml', [\App\Http\Controllers\Api\V1\FiscalController::class, 'downloadXml']);
        });
        Route::middleware('check.permission:fiscal.note.create')->group(function () {
            Route::post('fiscal/nfe', [\App\Http\Controllers\Api\V1\FiscalController::class, 'emitirNFe']);
            Route::post('fiscal/nfse', [\App\Http\Controllers\Api\V1\FiscalController::class, 'emitirNFSe']);
        });
        Route::middleware('check.permission:fiscal.note.cancel')->post('fiscal/notas/{id}/cancelar', [\App\Http\Controllers\Api\V1\FiscalController::class, 'cancelar']);

        // Push Notifications
        Route::post('push/subscribe', [\App\Http\Controllers\Api\V1\PushSubscriptionController::class, 'subscribe']);
        Route::delete('push/unsubscribe', [\App\Http\Controllers\Api\V1\PushSubscriptionController::class, 'unsubscribe']);
        Route::middleware('check.permission:platform.settings.manage')->post('push/test', [\App\Http\Controllers\Api\V1\PushSubscriptionController::class, 'test']);
        Route::get('push/vapid-key', [\App\Http\Controllers\Api\V1\PushSubscriptionController::class, 'vapidKey']);

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
        Route::middleware('check.permission:os.work_order.create')->group(function () {
            Route::post('work-orders', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'store']);
            Route::post('operational/work-orders/express', [ExpressWorkOrderController::class, 'store']);
            Route::post('operational/nps', [NpsController::class, 'store']);
            Route::get('operational/nps/stats', [NpsController::class, 'stats']);
        });
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
        // GAP-02: Dispatch authorization
        Route::middleware('check.permission:os.work_order.authorize_dispatch')->post('work-orders/{work_order}/authorize-dispatch', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'authorizeDispatch']);
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

        // Tf©cnicos / Campo
        Route::middleware('check.permission:technicians.schedule.view')->group(function () {
            Route::get('schedules-unified', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'unified']);
            Route::get('schedules', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'index']);
            Route::get('schedules/{schedule}', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'show']);
            Route::get('technicians/recommendation', [\App\Http\Controllers\Api\V1\Technician\TechnicianRecommendationController::class, 'recommend']);
        });
        Route::middleware('check.permission:technicians.schedule.manage')->group(function () {
            Route::post('schedules', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'store']);
            Route::put('schedules/{schedule}', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'update']);
            Route::delete('schedules/{schedule}', [\App\Http\Controllers\Api\V1\Technician\ScheduleController::class, 'destroy']);
        });

        // Atualização de Localização do Cliente pelo Técnico
        Route::middleware('check.permission:technicians.schedule.view')->group(function () {
             Route::post('technicians/customers/{customer}/geolocation', [\App\Http\Controllers\Api\V1\Technician\CustomerLocationController::class, 'update']);
        });

        // Checklists (Pré-Visita)
        Route::middleware('check.permission:technicians.checklist.view')->group(function () {
            Route::get('checklists', [ChecklistController::class, 'index']);
            Route::get('checklists/{checklist}', [ChecklistController::class, 'show']);
            Route::get('checklist-submissions', [ChecklistSubmissionController::class, 'index']);
            Route::get('checklist-submissions/{checklistSubmission}', [ChecklistSubmissionController::class, 'show']);
        });
        Route::middleware('check.permission:technicians.checklist.manage')->group(function () {
            Route::post('checklists', [ChecklistController::class, 'store']);
            Route::put('checklists/{checklist}', [ChecklistController::class, 'update']);
            Route::delete('checklists/{checklist}', [ChecklistController::class, 'destroy']);
        });
        Route::middleware('check.permission:technicians.checklist.create')->group(function () {
            Route::post('checklist-submissions', [ChecklistSubmissionController::class, 'store']);
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

        // Otimização de Rotas
        Route::middleware('check.permission:os.work_order.view')->post('operational/route-optimization', [\App\Http\Controllers\Api\V1\Operational\RouteOptimizationController::class, 'optimize']);

        // Financeiro â,? Contas a Receber
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
        // GAP-25: Settlement approval workflow (Nayara closes → Roldão approves)
        Route::middleware('check.permission:commissions.settlement.approve')->group(function () {
            Route::post('commission-settlements/{commission_settlement}/approve', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'approveSettlement']);
            Route::post('commission-settlements/{commission_settlement}/reject', [\App\Http\Controllers\Api\V1\Financial\CommissionController::class, 'rejectSettlement']);
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
        Route::middleware('check.permission:commissions.dispute.view')->group(function () {
            Route::get('commission-disputes/{dispute}', [\App\Http\Controllers\Api\V1\Financial\CommissionDisputeController::class, 'show']);
        });
        Route::middleware('check.permission:commissions.dispute.create')->group(function () {
            Route::delete('commission-disputes/{dispute}', [\App\Http\Controllers\Api\V1\Financial\CommissionDisputeController::class, 'destroy']);
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
        // GAP-20: Expense review step (conferência before approval)
        Route::middleware('check.permission:expenses.expense.review')->post('expenses/{expense}/review', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'review']);
        Route::middleware('check.permission:expenses.expense.view')->get('expenses-export', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'export']);
        Route::middleware('check.permission:expenses.expense.view')->get('expense-analytics', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'analytics']);
        Route::middleware('check.permission:expenses.expense.delete')->group(function () {
            Route::delete('expenses/{expense}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'destroy']);
            Route::delete('expense-categories/{category}', [\App\Http\Controllers\Api\V1\Financial\ExpenseController::class, 'destroyCategory']);
        });

        // GAP-09: Fueling Logs (motorista)
        Route::middleware('check.permission:expenses.fueling_log.view')->group(function () {
            Route::get('fueling-logs', [\App\Http\Controllers\Api\V1\Financial\FuelingLogController::class, 'index']);
            Route::get('fueling-logs/{fuelingLog}', [\App\Http\Controllers\Api\V1\Financial\FuelingLogController::class, 'show']);
        });
        Route::middleware('check.permission:expenses.fueling_log.create')->post('fueling-logs', [\App\Http\Controllers\Api\V1\Financial\FuelingLogController::class, 'store']);
        Route::middleware('check.permission:expenses.fueling_log.update')->put('fueling-logs/{fuelingLog}', [\App\Http\Controllers\Api\V1\Financial\FuelingLogController::class, 'update']);
        Route::middleware('check.permission:expenses.fueling_log.approve')->post('fueling-logs/{fuelingLog}/approve', [\App\Http\Controllers\Api\V1\Financial\FuelingLogController::class, 'approve']);
        Route::middleware('check.permission:expenses.fueling_log.delete')->delete('fueling-logs/{fuelingLog}', [\App\Http\Controllers\Api\V1\Financial\FuelingLogController::class, 'destroy']);

        // --- Módulo Frota Avançado ---
        Route::middleware('check.permission:fleet.management')->group(function () {
            // Gestão de Pneus
            Route::get('fleet/tires', [\App\Http\Controllers\Api\V1\Fleet\VehicleTireController::class, 'index']);
            Route::post('fleet/tires', [\App\Http\Controllers\Api\V1\Fleet\VehicleTireController::class, 'store']);
            Route::get('fleet/tires/{tire}', [\App\Http\Controllers\Api\V1\Fleet\VehicleTireController::class, 'show']);
            Route::put('fleet/tires/{tire}', [\App\Http\Controllers\Api\V1\Fleet\VehicleTireController::class, 'update']);
            Route::delete('fleet/tires/{tire}', [\App\Http\Controllers\Api\V1\Fleet\VehicleTireController::class, 'destroy']);

            // Gestão de Abastecimento Avançado (API unificada)
            Route::get('fleet/fuel-logs', [\App\Http\Controllers\Api\V1\Fleet\FuelLogController::class, 'index']);
            Route::post('fleet/fuel-logs', [\App\Http\Controllers\Api\V1\Fleet\FuelLogController::class, 'store']);
            Route::get('fleet/fuel-logs/{log}', [\App\Http\Controllers\Api\V1\Fleet\FuelLogController::class, 'show']);
            Route::put('fleet/fuel-logs/{log}', [\App\Http\Controllers\Api\V1\Fleet\FuelLogController::class, 'update']);
            Route::delete('fleet/fuel-logs/{log}', [\App\Http\Controllers\Api\V1\Fleet\FuelLogController::class, 'destroy']);

            // Pool de Veículos
            Route::get('fleet/pool-requests', [\App\Http\Controllers\Api\V1\Fleet\VehiclePoolController::class, 'index']);
            Route::post('fleet/pool-requests', [\App\Http\Controllers\Api\V1\Fleet\VehiclePoolController::class, 'store']);
            Route::get('fleet/pool-requests/{request}', [\App\Http\Controllers\Api\V1\Fleet\VehiclePoolController::class, 'show']);
            Route::patch('fleet/pool-requests/{request}/status', [\App\Http\Controllers\Api\V1\Fleet\VehiclePoolController::class, 'updateStatus']);
            Route::delete('fleet/pool-requests/{request}', [\App\Http\Controllers\Api\V1\Fleet\VehiclePoolController::class, 'destroy']);

            // Gestão de Acidentes
            Route::get('fleet/accidents', [\App\Http\Controllers\Api\V1\Fleet\VehicleAccidentController::class, 'index']);
            Route::post('fleet/accidents', [\App\Http\Controllers\Api\V1\Fleet\VehicleAccidentController::class, 'store']);
            Route::get('fleet/accidents/{accident}', [\App\Http\Controllers\Api\V1\Fleet\VehicleAccidentController::class, 'show']);
            Route::put('fleet/accidents/{accident}', [\App\Http\Controllers\Api\V1\Fleet\VehicleAccidentController::class, 'update']);
            Route::delete('fleet/accidents/{accident}', [\App\Http\Controllers\Api\V1\Fleet\VehicleAccidentController::class, 'destroy']);

            // Inspeções / Checklists Móveis
            Route::get('fleet/inspections', [\App\Http\Controllers\Api\V1\Fleet\VehicleInspectionController::class, 'index']);
            Route::post('fleet/inspections', [\App\Http\Controllers\Api\V1\Fleet\VehicleInspectionController::class, 'store']);
            Route::get('fleet/inspections/{inspection}', [\App\Http\Controllers\Api\V1\Fleet\VehicleInspectionController::class, 'show']);
            Route::put('fleet/inspections/{inspection}', [\App\Http\Controllers\Api\V1\Fleet\VehicleInspectionController::class, 'update']);
            Route::delete('fleet/inspections/{inspection}', [\App\Http\Controllers\Api\V1\Fleet\VehicleInspectionController::class, 'destroy']);

            // Seguros de Frota
            Route::get('fleet/insurances', [\App\Http\Controllers\Api\V1\Fleet\VehicleInsuranceController::class, 'index']);
            Route::post('fleet/insurances', [\App\Http\Controllers\Api\V1\Fleet\VehicleInsuranceController::class, 'store']);
            Route::get('fleet/insurances/alerts', [\App\Http\Controllers\Api\V1\Fleet\VehicleInsuranceController::class, 'alerts']);
            Route::get('fleet/insurances/{insurance}', [\App\Http\Controllers\Api\V1\Fleet\VehicleInsuranceController::class, 'show']);
            Route::put('fleet/insurances/{insurance}', [\App\Http\Controllers\Api\V1\Fleet\VehicleInsuranceController::class, 'update']);
            Route::delete('fleet/insurances/{insurance}', [\App\Http\Controllers\Api\V1\Fleet\VehicleInsuranceController::class, 'destroy']);

            // Dashboard Avançado & Ferramentas
            Route::get('fleet/dashboard', [\App\Http\Controllers\Api\V1\Fleet\FleetAdvancedController::class, 'dashboard']);
            Route::post('fleet/fuel-comparison', [\App\Http\Controllers\Api\V1\Fleet\FleetAdvancedController::class, 'fuelComparison']);
            Route::post('fleet/trip-simulation', [\App\Http\Controllers\Api\V1\Fleet\FleetAdvancedController::class, 'tripSimulation']);
            Route::get('fleet/driver-score/{driverId}', [\App\Http\Controllers\Api\V1\Fleet\FleetAdvancedController::class, 'driverScore']);
            Route::get('fleet/driver-ranking', [\App\Http\Controllers\Api\V1\Fleet\FleetAdvancedController::class, 'driverRanking']);

            // GPS em Tempo Real
            Route::get('fleet/gps/live', [\App\Http\Controllers\Api\V1\Fleet\GpsTrackingController::class, 'livePositions']);
            Route::post('fleet/gps/update', [\App\Http\Controllers\Api\V1\Fleet\GpsTrackingController::class, 'updatePosition']);
            Route::get('fleet/gps/history/{vehicleId}', [\App\Http\Controllers\Api\V1\Fleet\GpsTrackingController::class, 'history']);

            // Integração de Pedágio
            Route::get('fleet/tolls', [\App\Http\Controllers\Api\V1\Fleet\TollIntegrationController::class, 'index']);
            Route::post('fleet/tolls', [\App\Http\Controllers\Api\V1\Fleet\TollIntegrationController::class, 'store']);
            Route::get('fleet/tolls/summary', [\App\Http\Controllers\Api\V1\Fleet\TollIntegrationController::class, 'summary']);
            Route::delete('fleet/tolls/{id}', [\App\Http\Controllers\Api\V1\Fleet\TollIntegrationController::class, 'destroy']);
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

        // Integração Auvo API v2
        Route::middleware('check.permission:auvo.import.view')->group(function () {
            Route::get('auvo/status', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'testConnection']);
            Route::get('auvo/sync-status', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'syncStatus']);
            Route::get('auvo/preview/{entity}', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'preview']);
            Route::get('auvo/history', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'history']);
            Route::get('auvo/mappings', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'mappings']);
        });
        Route::middleware('check.permission:auvo.import.execute')->group(function () {
            Route::post('auvo/import/{entity}', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'import']);
            Route::post('auvo/import-all', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'importAll']);
            Route::put('auvo/config', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'config']);
        });
        Route::middleware('check.permission:auvo.import.delete')->group(function () {
            Route::post('auvo/rollback/{id}', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'rollback']);
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
            Route::get('inmetro/instrument-types', [\App\Http\Controllers\Api\V1\InmetroController::class, 'instrumentTypes']);
            Route::get('inmetro/available-ufs', [\App\Http\Controllers\Api\V1\InmetroController::class, 'availableUfs']);
            Route::get('inmetro/config', [\App\Http\Controllers\Api\V1\InmetroController::class, 'getConfig']);
            Route::get('inmetro/cross-reference-stats', [\App\Http\Controllers\Api\V1\InmetroController::class, 'crossReferenceStats']);
            Route::get('inmetro/customer-profile/{customerId}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'customerInmetroProfile']);
            Route::get('inmetro/map-data', [\App\Http\Controllers\Api\V1\InmetroController::class, 'mapData']);
            Route::get('inmetro/market-overview', [\App\Http\Controllers\Api\V1\InmetroController::class, 'marketOverview']);
            Route::get('inmetro/competitor-analysis', [\App\Http\Controllers\Api\V1\InmetroController::class, 'competitorAnalysis']);
            Route::get('inmetro/regional-analysis', [\App\Http\Controllers\Api\V1\InmetroController::class, 'regionalAnalysis']);
            Route::get('inmetro/brand-analysis', [\App\Http\Controllers\Api\V1\InmetroController::class, 'brandAnalysis']);
            Route::get('inmetro/expiration-forecast', [\App\Http\Controllers\Api\V1\InmetroController::class, 'expirationForecast']);
            Route::get('inmetro/monthly-trends', [\App\Http\Controllers\Api\V1\InmetroController::class, 'monthlyTrends']);
            Route::get('inmetro/revenue-ranking', [\App\Http\Controllers\Api\V1\InmetroController::class, 'revenueRanking']);
            Route::get('inmetro/export/leads-pdf', [\App\Http\Controllers\Api\V1\InmetroController::class, 'exportLeadsPdf']);
            Route::get('inmetro/base-config', [\App\Http\Controllers\Api\V1\InmetroController::class, 'getBaseConfig']);
            Route::get('inmetro/available-datasets', [\App\Http\Controllers\Api\V1\InmetroController::class, 'availableDatasets']);
        });
        Route::middleware('check.permission:inmetro.intelligence.import')->group(function () {
            Route::post('inmetro/import/xml', [\App\Http\Controllers\Api\V1\InmetroController::class, 'importXml']);
            Route::post('inmetro/import/psie-init', [\App\Http\Controllers\Api\V1\InmetroController::class, 'initPsieScrape']);
            Route::post('inmetro/import/psie-results', [\App\Http\Controllers\Api\V1\InmetroController::class, 'submitPsieResults']);
            Route::put('inmetro/config', [\App\Http\Controllers\Api\V1\InmetroController::class, 'updateConfig']);
            Route::post('inmetro/geocode', [\App\Http\Controllers\Api\V1\InmetroController::class, 'geocodeLocations']);
            Route::post('inmetro/calculate-distances', [\App\Http\Controllers\Api\V1\InmetroController::class, 'calculateDistances']);
            Route::put('inmetro/base-config', [\App\Http\Controllers\Api\V1\InmetroController::class, 'updateBaseConfig']);
        });

        Route::middleware('check.permission:inmetro.intelligence.enrich')->group(function () {
            Route::post('inmetro/enrich/{ownerId}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'enrichOwner']);
            Route::post('inmetro/enrich-batch', [\App\Http\Controllers\Api\V1\InmetroController::class, 'enrichBatch']);
            Route::post('inmetro/enrich-dadosgov/{ownerId}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'enrichFromDadosGov']);
        });

        Route::middleware('check.permission:inmetro.intelligence.convert')->group(function () {
            Route::post('inmetro/convert/{ownerId}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'convertToCustomer']);
            Route::patch('inmetro/owners/{ownerId}/status', [\App\Http\Controllers\Api\V1\InmetroController::class, 'updateLeadStatus']);
            Route::post('inmetro/recalculate-priorities', [\App\Http\Controllers\Api\V1\InmetroController::class, 'recalculatePriorities']);
            Route::post('inmetro/cross-reference', [\App\Http\Controllers\Api\V1\InmetroController::class, 'crossReference']);
            Route::put('inmetro/owners/{id}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'update']);
            Route::delete('inmetro/owners/{id}', [\App\Http\Controllers\Api\V1\InmetroController::class, 'destroy']);
        });

        // ─── INMETRO Advanced (50 Features) ─────────────────────────
        // Prospection & Lead Management (view-level)
        Route::middleware('check.permission:inmetro.intelligence.view')->group(function () {
            Route::get('inmetro/advanced/contact-queue', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'getContactQueue']);
            Route::get('inmetro/advanced/follow-ups', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'followUps']);
            Route::get('inmetro/advanced/lead-score/{ownerId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'calculateLeadScore']);
            Route::get('inmetro/advanced/churn', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'detectChurn']);
            Route::get('inmetro/advanced/new-registrations', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'newRegistrations']);
            Route::get('inmetro/advanced/next-calibrations', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'suggestNextCalibrations']);
            Route::get('inmetro/advanced/segment-distribution', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'segmentDistribution']);
            Route::get('inmetro/advanced/reject-alerts', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'rejectAlerts']);
            Route::get('inmetro/advanced/conversion-ranking', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'conversionRanking']);
            Route::get('inmetro/advanced/interactions/{ownerId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'interactionHistory']);
            // Territorial Intelligence
            Route::get('inmetro/advanced/map-layers', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'layeredMapData']);
            Route::get('inmetro/advanced/competitor-zones', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'competitorZones']);
            Route::get('inmetro/advanced/coverage-potential', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'coverageVsPotential']);
            Route::get('inmetro/advanced/nearby-leads', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'nearbyLeads']);
            // Competitor Tracking
            Route::get('inmetro/advanced/market-share-timeline', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'marketShareTimeline']);
            Route::get('inmetro/advanced/competitor-movements', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'competitorMovements']);
            Route::get('inmetro/advanced/pricing-estimate', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'estimatePricing']);
            Route::get('inmetro/advanced/competitor-profile/{competitorId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'competitorProfile']);
            Route::get('inmetro/advanced/win-loss', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'winLossAnalysis']);
            // Operational Bridge
            Route::get('inmetro/advanced/suggest-equipments/{customerId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'suggestLinkedEquipments']);
            Route::get('inmetro/advanced/prefill-certificate/{instrumentId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'prefillCertificate']);
            Route::get('inmetro/advanced/instrument-timeline/{instrumentId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'instrumentTimeline']);
            Route::get('inmetro/advanced/compare-calibrations/{instrumentId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'compareCalibrations']);
            // Reporting
            Route::get('inmetro/advanced/executive-dashboard', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'executiveDashboard']);
            Route::get('inmetro/advanced/revenue-forecast', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'revenueForecast']);
            Route::get('inmetro/advanced/conversion-funnel', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'conversionFunnel']);
            Route::get('inmetro/advanced/export-data', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'exportData']);
            Route::get('inmetro/advanced/year-over-year', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'yearOverYear']);
            // Compliance
            Route::get('inmetro/advanced/compliance-checklists', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'complianceChecklists']);
            Route::get('inmetro/advanced/regulatory-traceability/{instrumentId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'regulatoryTraceability']);
            Route::get('inmetro/advanced/corporate-groups', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'corporateGroups']);
            Route::get('inmetro/advanced/compliance-instrument-types', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'instrumentTypes']);
            Route::get('inmetro/advanced/anomalies', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'detectAnomalies']);
            Route::get('inmetro/advanced/renewal-probability', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'renewalProbability']);
            // Webhooks & API
            Route::get('inmetro/advanced/public-data', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'publicInstrumentData']);
            Route::get('inmetro/advanced/webhooks', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'listWebhooks']);
            Route::get('inmetro/advanced/webhook-events', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'availableWebhookEvents']);
        });

        // INMETRO Advanced — Write operations (manage permission)
        Route::middleware('check.permission:inmetro.intelligence.convert')->group(function () {
            // Prospection actions
            Route::post('inmetro/advanced/generate-queue', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'generateDailyQueue']);
            Route::patch('inmetro/advanced/queue/{queueId}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'markQueueItem']);
            Route::post('inmetro/advanced/recalculate-scores', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'recalculateAllScores']);
            Route::post('inmetro/advanced/classify-segments', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'classifySegments']);
            Route::post('inmetro/advanced/interactions', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'logInteraction']);
            // Territorial actions
            Route::post('inmetro/advanced/optimize-route', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'optimizeRoute']);
            Route::post('inmetro/advanced/density-viability', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'densityViability']);
            // Competitor actions
            Route::post('inmetro/advanced/snapshot-market-share', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'snapshotMarketShare']);
            Route::post('inmetro/advanced/win-loss', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'recordWinLoss']);
            // Operational Bridge
            Route::post('inmetro/advanced/link-instrument', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'linkInstrument']);
            // Compliance actions
            Route::post('inmetro/advanced/compliance-checklists', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'createChecklist']);
            Route::put('inmetro/advanced/compliance-checklists/{id}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'updateChecklist']);
            Route::post('inmetro/advanced/simulate-impact', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'simulateRegulatoryImpact']);
            // Webhooks CRUD
            Route::post('inmetro/advanced/webhooks', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'createWebhook']);
            Route::put('inmetro/advanced/webhooks/{id}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'updateWebhook']);
            Route::delete('inmetro/advanced/webhooks/{id}', [\App\Http\Controllers\Api\V1\InmetroAdvancedController::class, 'deleteWebhook']);
        });

        // ─── Integração Auvo ─────────────────────────────────────────
        Route::middleware('check.permission:auvo.import.view')->group(function () {
            Route::get('auvo/status', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'testConnection']);
            Route::get('auvo/sync-status', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'syncStatus']);
            Route::get('auvo/preview/{entity}', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'preview']);
            Route::get('auvo/history', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'history']);
            Route::get('auvo/mappings', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'mappings']);
        });
        Route::middleware('check.permission:auvo.import.execute')->group(function () {
            Route::post('auvo/import/{entity}', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'import']);
            Route::post('auvo/import-all', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'importAll']);
            Route::post('auvo/rollback/{id}', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'rollback']);
            Route::put('auvo/config', [\App\Http\Controllers\Api\V1\AuvoImportController::class, 'config']);
        });

        // Auvo Export (Sistema -> Auvo)
        Route::middleware('check.permission:auvo.export.execute')->group(function () {
            Route::post('auvo/export/customer/{customer}', [\App\Http\Controllers\Api\V1\AuvoExportController::class, 'exportCustomer']);
            Route::post('auvo/export/product/{product}', [\App\Http\Controllers\Api\V1\AuvoExportController::class, 'exportProduct']);
            Route::post('auvo/export/service/{service}', [\App\Http\Controllers\Api\V1\AuvoExportController::class, 'exportService']);
            Route::post('auvo/export/quote/{quote}', [\App\Http\Controllers\Api\V1\AuvoExportController::class, 'exportQuote']);
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
        // GAP-01: Internal approval (before sending to client)
        Route::middleware('check.permission:quotes.quote.internal_approve')->post('quotes/{quote}/internal-approve', [\App\Http\Controllers\Api\V1\QuoteController::class, 'internalApprove']);
        Route::middleware('check.permission:quotes.quote.send')->post('quotes/{quote}/send', [\App\Http\Controllers\Api\V1\QuoteController::class, 'send']);
        Route::middleware('check.permission:quotes.quote.convert')->post('quotes/{quote}/convert-to-os', [\App\Http\Controllers\Api\V1\QuoteController::class, 'convertToWorkOrder']);
        Route::middleware('check.permission:quotes.quote.convert')->post('quotes/{quote}/convert-to-chamado', [\App\Http\Controllers\Api\V1\QuoteController::class, 'convertToServiceCall']);
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

        // Contas Bancárias
        Route::middleware('check.permission:financial.bank_account.view')->group(function () {
            Route::get('bank-accounts', [\App\Http\Controllers\Api\V1\Financial\BankAccountController::class, 'index']);
            Route::get('bank-accounts/{bankAccount}', [\App\Http\Controllers\Api\V1\Financial\BankAccountController::class, 'show']);
        });
        Route::middleware('check.permission:financial.bank_account.create')->post('bank-accounts', [\App\Http\Controllers\Api\V1\Financial\BankAccountController::class, 'store']);
        Route::middleware('check.permission:financial.bank_account.update')->put('bank-accounts/{bankAccount}', [\App\Http\Controllers\Api\V1\Financial\BankAccountController::class, 'update']);
        Route::middleware('check.permission:financial.bank_account.delete')->delete('bank-accounts/{bankAccount}', [\App\Http\Controllers\Api\V1\Financial\BankAccountController::class, 'destroy']);

        // Transferências para Técnicos
        Route::middleware('check.permission:financial.fund_transfer.view')->group(function () {
            Route::get('fund-transfers', [\App\Http\Controllers\Api\V1\Financial\FundTransferController::class, 'index']);
            Route::get('fund-transfers/summary', [\App\Http\Controllers\Api\V1\Financial\FundTransferController::class, 'summary']);
            Route::get('fund-transfers/{fundTransfer}', [\App\Http\Controllers\Api\V1\Financial\FundTransferController::class, 'show']);
        });
        Route::middleware('check.permission:financial.fund_transfer.create')->post('fund-transfers', [\App\Http\Controllers\Api\V1\Financial\FundTransferController::class, 'store']);
        Route::middleware('check.permission:financial.fund_transfer.cancel')->post('fund-transfers/{fundTransfer}/cancel', [\App\Http\Controllers\Api\V1\Financial\FundTransferController::class, 'cancel']);

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

        // Pesos Padrão (Standard Weights)
        Route::middleware('check.permission:equipments.standard_weight.view')->group(function () {
            Route::get('standard-weights', [\App\Http\Controllers\Api\V1\StandardWeightController::class, 'index']);
            Route::get('standard-weights/expiring', [\App\Http\Controllers\Api\V1\StandardWeightController::class, 'expiring']);
            Route::get('standard-weights/constants', [\App\Http\Controllers\Api\V1\StandardWeightController::class, 'constants']);
            Route::get('standard-weights/export', [\App\Http\Controllers\Api\V1\StandardWeightController::class, 'exportCsv']);
            Route::get('standard-weights/{standardWeight}', [\App\Http\Controllers\Api\V1\StandardWeightController::class, 'show']);
        });
        Route::middleware('check.permission:equipments.standard_weight.create')->post('standard-weights', [\App\Http\Controllers\Api\V1\StandardWeightController::class, 'store']);
        Route::middleware('check.permission:equipments.standard_weight.update')->put('standard-weights/{standardWeight}', [\App\Http\Controllers\Api\V1\StandardWeightController::class, 'update']);
        Route::middleware('check.permission:equipments.standard_weight.delete')->delete('standard-weights/{standardWeight}', [\App\Http\Controllers\Api\V1\StandardWeightController::class, 'destroy']);

        // Numeração / Sequências
        Route::middleware('check.permission:platform.settings.manage')->group(function () {
            Route::get('numbering-sequences', [\App\Http\Controllers\Api\V1\NumberingSequenceController::class, 'index']);
            Route::put('numbering-sequences/{numberingSequence}', [\App\Http\Controllers\Api\V1\NumberingSequenceController::class, 'update']);
            Route::get('numbering-sequences/{numberingSequence}/preview', [\App\Http\Controllers\Api\V1\NumberingSequenceController::class, 'preview']);
        });

        // Notificações�f§�fµes
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
        // (Rota reports/{type}/export já registrada na seção de Relatórios acima — L477)

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

        // â?,â?,â?, Perfil do Usuf¡rio â?,â?,â?,
        // FIX-B5: Usar o controller de perfil (Api\V1\UserController), nf£o o IAM
        Route::post('profile/change-password', [\App\Http\Controllers\Api\V1\UserController::class, 'changePassword']);

        // (Rotas reports/suppliers e reports/stock já registradas na seção de Relatórios — L474-475)

        // â?,â?,â?, Operaf§fµes (Fase 5) â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,
        Route::middleware('check.permission:os.work_order.view')->group(function () {
            Route::apiResource('service-checklists', \App\Http\Controllers\Api\V1\ServiceChecklistController::class);
            Route::apiResource('sla-policies', \App\Http\Controllers\Api\V1\SlaPolicyController::class);
            Route::get('work-orders/{work_order}/checklist-responses', [\App\Http\Controllers\Api\V1\WorkOrderChecklistResponseController::class, 'index']);
        });
        Route::middleware('check.permission:os.work_order.update')->group(function () {
            Route::post('work-orders/{work_order}/checklist-responses', [\App\Http\Controllers\Api\V1\WorkOrderChecklistResponseController::class, 'store']);
            Route::post('work-orders/{work_order}/chats', [\App\Http\Controllers\Api\V1\Os\WorkOrderChatController::class, 'store']);
            Route::post('work-orders/{work_order}/chats/read', [\App\Http\Controllers\Api\V1\Os\WorkOrderChatController::class, 'markAsRead']);
        });

        Route::middleware('check.permission:os.work_order.view')->group(function () {
            Route::get('work-orders/{work_order}/chats', [\App\Http\Controllers\Api\V1\Os\WorkOrderChatController::class, 'index']);
            Route::get('work-orders/{work_order}/audit-trail', [\App\Http\Controllers\Api\V1\Os\WorkOrderController::class, 'auditTrail']);
        });

        // ═══ Kits de Peças ═══════════════════════════════════════════
        Route::middleware('check.permission:os.work_order.view')->group(function () {
            Route::get('parts-kits', [\App\Http\Controllers\Api\V1\Os\PartsKitController::class, 'index']);
            Route::get('parts-kits/{id}', [\App\Http\Controllers\Api\V1\Os\PartsKitController::class, 'show']);
        });
        Route::middleware('check.permission:os.work_order.update')->group(function () {
            Route::post('parts-kits', [\App\Http\Controllers\Api\V1\Os\PartsKitController::class, 'store']);
            Route::put('parts-kits/{id}', [\App\Http\Controllers\Api\V1\Os\PartsKitController::class, 'update']);
            Route::delete('parts-kits/{id}', [\App\Http\Controllers\Api\V1\Os\PartsKitController::class, 'destroy']);
            Route::post('work-orders/{work_order}/apply-kit/{parts_kit}', [\App\Http\Controllers\Api\V1\Os\PartsKitController::class, 'applyToWorkOrder']);
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

        // ─── Tech Sync (PWA Mobile Offline) ─────────────────────────
        Route::prefix('tech')->group(function () {
            Route::get('sync', [\App\Http\Controllers\Api\V1\TechSyncController::class, 'pull']);
            Route::post('sync/batch', [\App\Http\Controllers\Api\V1\TechSyncController::class, 'batchPush']);
            Route::post('sync/photo', [\App\Http\Controllers\Api\V1\TechSyncController::class, 'uploadPhoto']);
        });

        // ─── FLEET (Frota) ─────────────────────────────────────────
        Route::prefix('fleet')->group(function () {
            Route::middleware('check.permission:fleet.vehicle.view')->group(function () {
                Route::get('vehicles', [\App\Http\Controllers\Api\V1\FleetController::class, 'indexVehicles']);
                Route::get('vehicles/{vehicle}', [\App\Http\Controllers\Api\V1\FleetController::class, 'showVehicle']);
                Route::get('vehicles/{vehicle}/inspections', [\App\Http\Controllers\Api\V1\FleetController::class, 'indexInspections']);
                Route::get('dashboard', [\App\Http\Controllers\Api\V1\FleetController::class, 'dashboardFleet']);
            });
            Route::middleware('check.permission:fleet.vehicle.create')->post('vehicles', [\App\Http\Controllers\Api\V1\FleetController::class, 'storeVehicle']);
            Route::middleware('check.permission:fleet.vehicle.update')->put('vehicles/{vehicle}', [\App\Http\Controllers\Api\V1\FleetController::class, 'updateVehicle']);
            Route::middleware('check.permission:fleet.vehicle.delete')->delete('vehicles/{vehicle}', [\App\Http\Controllers\Api\V1\FleetController::class, 'destroyVehicle']);
            Route::middleware('check.permission:fleet.inspection.create')->post('vehicles/{vehicle}/inspections', [\App\Http\Controllers\Api\V1\FleetController::class, 'storeInspection']);
            Route::middleware('check.permission:fleet.fine.view')->get('fines', [\App\Http\Controllers\Api\V1\FleetController::class, 'indexFines']);
            Route::middleware('check.permission:fleet.fine.create')->post('fines', [\App\Http\Controllers\Api\V1\FleetController::class, 'storeFine']);
            Route::middleware('check.permission:fleet.fine.update')->put('fines/{fine}', [\App\Http\Controllers\Api\V1\FleetController::class, 'updateFine']);
            Route::middleware('check.permission:fleet.tool_inventory.view')->get('tools', [\App\Http\Controllers\Api\V1\FleetController::class, 'indexTools']);
            Route::middleware('check.permission:fleet.tool_inventory.manage')->group(function () {
                Route::post('tools', [\App\Http\Controllers\Api\V1\FleetController::class, 'storeTool']);
                Route::put('tools/{tool}', [\App\Http\Controllers\Api\V1\FleetController::class, 'updateTool']);
                Route::delete('tools/{tool}', [\App\Http\Controllers\Api\V1\FleetController::class, 'destroyTool']);
            });
        });

        // ─── HR (RH & Equipe) ────────────────────────────────────────
        Route::prefix('hr')->group(function () {
            Route::middleware('check.permission:hr.schedule.view')->group(function () {
                Route::get('schedules', [\App\Http\Controllers\Api\V1\HRController::class, 'indexSchedules']);
                Route::get('dashboard', [\App\Http\Controllers\Api\V1\HRController::class, 'dashboard']);
            });
            Route::middleware('check.permission:hr.schedule.manage')->group(function () {
                Route::post('schedules', [\App\Http\Controllers\Api\V1\HRController::class, 'storeSchedule']);
                Route::post('schedules/batch', [\App\Http\Controllers\Api\V1\HRController::class, 'batchSchedule']);
            });
            Route::middleware('check.permission:hr.clock.manage')->group(function () {
                Route::post('clock/in', [\App\Http\Controllers\Api\V1\HRController::class, 'clockIn']);
                Route::post('clock/out', [\App\Http\Controllers\Api\V1\HRController::class, 'clockOut']);
            });
            Route::middleware('check.permission:hr.clock.view')->group(function () {
                Route::get('clock/my', [\App\Http\Controllers\Api\V1\HRController::class, 'myClockHistory']);
                Route::get('clock/all', [\App\Http\Controllers\Api\V1\HRController::class, 'allClockEntries']);
            });
            Route::middleware('check.permission:hr.training.view')->get('trainings', [\App\Http\Controllers\Api\V1\HRController::class, 'indexTrainings']);
            Route::middleware('check.permission:hr.training.manage')->group(function () {
                Route::post('trainings', [\App\Http\Controllers\Api\V1\HRController::class, 'storeTraining']);
                Route::put('trainings/{training}', [\App\Http\Controllers\Api\V1\HRController::class, 'updateTraining']);
                Route::get('trainings/{training}', [\App\Http\Controllers\Api\V1\HRController::class, 'showTraining']);
                Route::delete('trainings/{training}', [\App\Http\Controllers\Api\V1\HRController::class, 'destroyTraining']);
            });
            Route::middleware('check.permission:hr.performance.view')->get('reviews', [\App\Http\Controllers\Api\V1\HRController::class, 'indexReviews']);
            Route::middleware('check.permission:hr.performance.manage')->group(function () {
                Route::post('reviews', [\App\Http\Controllers\Api\V1\HRController::class, 'storeReview']);
                Route::put('reviews/{review}', [\App\Http\Controllers\Api\V1\HRController::class, 'updateReview']);
            });

            // ─── ADVANCED: Ponto Digital Avançado (Wave 1) ──────────
            Route::middleware('check.permission:hr.clock.manage')->group(function () {
                Route::post('advanced/clock-in', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'advancedClockIn']);
                Route::post('advanced/clock-out', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'advancedClockOut']);
            });
            Route::middleware('check.permission:hr.clock.view')->group(function () {
                Route::get('advanced/clock/status', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'currentClockStatus']);
                Route::get('advanced/clock/pending', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'pendingClockEntries']);
            });
            Route::middleware('check.permission:hr.clock.approve')->group(function () {
                Route::post('advanced/clock/{id}/approve', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'approveClockEntry']);
                Route::post('advanced/clock/{id}/reject', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'rejectClockEntry']);
            });

            // ─── ADVANCED: Geofences ────────────────────────────────
            Route::middleware('check.permission:hr.geofence.view')->get('geofences', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'indexGeofences']);
            Route::middleware('check.permission:hr.geofence.manage')->group(function () {
                Route::post('geofences', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'storeGeofence']);
                Route::put('geofences/{geofence}', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'updateGeofence']);
                Route::delete('geofences/{geofence}', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'destroyGeofence']);
            });

            // ─── ADVANCED: Ajustes de Ponto ─────────────────────────
            Route::middleware('check.permission:hr.adjustment.view')->get('adjustments', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'indexAdjustments']);
            Route::middleware('check.permission:hr.adjustment.create')->post('adjustments', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'storeAdjustment']);
            Route::middleware('check.permission:hr.adjustment.approve')->group(function () {
                Route::post('adjustments/{id}/approve', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'approveAdjustment']);
                Route::post('adjustments/{id}/reject', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'rejectAdjustment']);
            });

            // ─── ADVANCED: Jornada & Banco de Horas (Wave 1) ────────
            Route::middleware('check.permission:hr.journey.view')->group(function () {
                Route::get('journey-rules', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'indexJourneyRules']);
                Route::get('journey-entries', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'journeyEntries']);
                Route::get('hour-bank/balance', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'hourBankBalance']);
            });
            Route::middleware('check.permission:hr.journey.manage')->group(function () {
                Route::post('journey-rules', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'storeJourneyRule']);
                Route::put('journey-rules/{rule}', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'updateJourneyRule']);
                Route::post('journey/calculate', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'calculateJourney']);
            });

            // ─── ADVANCED: Feriados ─────────────────────────────────
            Route::middleware('check.permission:hr.holiday.view')->get('holidays', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'indexHolidays']);
            Route::middleware('check.permission:hr.holiday.manage')->group(function () {
                Route::post('holidays', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'storeHoliday']);
                Route::delete('holidays/{holiday}', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'destroyHoliday']);
            });

            // ─── ADVANCED: Férias & Afastamentos (Wave 2) ───────────
            Route::middleware('check.permission:hr.leave.view')->group(function () {
                Route::get('leaves', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'indexLeaves']);
                Route::get('vacation-balances', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'vacationBalances']);
            });
            Route::middleware('check.permission:hr.leave.create')->post('leaves', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'storeLeave']);
            Route::middleware('check.permission:hr.leave.approve')->group(function () {
                Route::post('leaves/{leave}/approve', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'approveLeave']);
                Route::post('leaves/{leave}/reject', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'rejectLeave']);
            });

            // ─── ADVANCED: Documentos do Colaborador (Wave 2) ───────
            Route::middleware('check.permission:hr.document.view')->group(function () {
                Route::get('documents', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'indexDocuments']);
                Route::get('documents/expiring', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'expiringDocuments']);
            });
            Route::middleware('check.permission:hr.document.manage')->group(function () {
                Route::post('documents', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'storeDocument']);
                Route::delete('documents/{document}', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'destroyDocument']);
            });

            // ─── ADVANCED: Onboarding (Wave 2) ─────────────────────
            Route::middleware('check.permission:hr.onboarding.view')->group(function () {
                Route::get('onboarding/templates', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'indexTemplates']);
                Route::get('onboarding/checklists', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'indexChecklists']);
            });
            Route::middleware('check.permission:hr.onboarding.manage')->group(function () {
                Route::post('onboarding/templates', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'storeTemplate']);
                Route::post('onboarding/start', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'startOnboarding']);
                Route::post('onboarding/items/{itemId}/complete', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'completeChecklistItem']);
            });

            // ─── ADVANCED: Dashboard Expandido ──────────────────────
            Route::middleware('check.permission:hr.dashboard.view')->get('advanced/dashboard', [\App\Http\Controllers\Api\V1\HRAdvancedController::class, 'advancedDashboard']);
        });

        // ─── QUALITY (Qualidade & SGQ) ───────────────────────────────
        Route::prefix('quality')->group(function () {
            Route::middleware('check.permission:quality.procedure.view')->group(function () {
                Route::get('procedures', [\App\Http\Controllers\Api\V1\QualityController::class, 'indexProcedures']);
                Route::get('procedures/{procedure}', [\App\Http\Controllers\Api\V1\QualityController::class, 'showProcedure']);
            });
            Route::middleware('check.permission:quality.procedure.manage')->group(function () {
                Route::post('procedures', [\App\Http\Controllers\Api\V1\QualityController::class, 'storeProcedure']);
                Route::put('procedures/{procedure}', [\App\Http\Controllers\Api\V1\QualityController::class, 'updateProcedure']);
                Route::post('procedures/{procedure}/approve', [\App\Http\Controllers\Api\V1\QualityController::class, 'approveProcedure']);
                Route::delete('procedures/{procedure}', [\App\Http\Controllers\Api\V1\QualityController::class, 'destroyProcedure']);
            });
            Route::middleware('check.permission:quality.corrective_action.view')->get('corrective-actions', [\App\Http\Controllers\Api\V1\QualityController::class, 'indexCorrectiveActions']);
            Route::middleware('check.permission:quality.corrective_action.manage')->group(function () {
                Route::post('corrective-actions', [\App\Http\Controllers\Api\V1\QualityController::class, 'storeCorrectiveAction']);
                Route::put('corrective-actions/{action}', [\App\Http\Controllers\Api\V1\QualityController::class, 'updateCorrectiveAction']);
                Route::delete('corrective-actions/{action}', [\App\Http\Controllers\Api\V1\QualityController::class, 'destroyCorrectiveAction']);
            });
            Route::middleware('check.permission:quality.complaint.view')->get('complaints', [\App\Http\Controllers\Api\V1\QualityController::class, 'indexComplaints']);
            Route::middleware('check.permission:quality.complaint.manage')->group(function () {
                Route::post('complaints', [\App\Http\Controllers\Api\V1\QualityController::class, 'storeComplaint']);
                Route::put('complaints/{complaint}', [\App\Http\Controllers\Api\V1\QualityController::class, 'updateComplaint']);
                Route::delete('complaints/{complaint}', [\App\Http\Controllers\Api\V1\QualityController::class, 'destroyComplaint']);
            });
            Route::middleware('check.permission:customer.satisfaction.view')->get('surveys', [\App\Http\Controllers\Api\V1\QualityController::class, 'indexSurveys']);
            Route::middleware('check.permission:customer.satisfaction.manage')->post('surveys', [\App\Http\Controllers\Api\V1\QualityController::class, 'storeSurvey']);
            Route::middleware('check.permission:customer.nps.view')->get('nps', [\App\Http\Controllers\Api\V1\QualityController::class, 'npsDashboard']);
            Route::middleware('check.permission:quality.dashboard.view')->get('dashboard', [\App\Http\Controllers\Api\V1\QualityController::class, 'dashboard']);
        });

        // ─── AUTOMATION (Automações & Webhooks) ──────────────────────
        Route::prefix('automation')->group(function () {
            Route::middleware('check.permission:automation.rule.view')->group(function () {
                Route::get('rules', [\App\Http\Controllers\Api\V1\AutomationController::class, 'indexRules']);
                Route::get('events', [\App\Http\Controllers\Api\V1\AutomationController::class, 'availableEvents']);
                Route::get('actions', [\App\Http\Controllers\Api\V1\AutomationController::class, 'availableActions']);
            });
            Route::middleware('check.permission:automation.rule.manage')->group(function () {
                Route::post('rules', [\App\Http\Controllers\Api\V1\AutomationController::class, 'storeRule']);
                Route::put('rules/{rule}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'updateRule']);
                Route::delete('rules/{rule}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'destroyRule']);
            });
            Route::middleware('check.permission:automation.webhook.view')->group(function () {
                Route::get('webhooks', [\App\Http\Controllers\Api\V1\AutomationController::class, 'indexWebhooks']);
                Route::get('webhooks/{webhook}/logs', [\App\Http\Controllers\Api\V1\AutomationController::class, 'webhookLogs']);
            });
            Route::middleware('check.permission:automation.webhook.manage')->group(function () {
                Route::post('webhooks', [\App\Http\Controllers\Api\V1\AutomationController::class, 'storeWebhook']);
                Route::put('webhooks/{webhook}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'updateWebhook']);
                Route::delete('webhooks/{webhook}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'destroyWebhook']);
            });
            Route::middleware('check.permission:reports.scheduled.view')->get('reports', [\App\Http\Controllers\Api\V1\AutomationController::class, 'indexScheduledReports']);
            Route::middleware('check.permission:reports.scheduled.manage')->group(function () {
                Route::post('reports', [\App\Http\Controllers\Api\V1\AutomationController::class, 'storeScheduledReport']);
                Route::put('reports/{report}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'updateScheduledReport']);
                Route::delete('reports/{report}', [\App\Http\Controllers\Api\V1\AutomationController::class, 'destroyScheduledReport']);
            });
        });

        // ─── EMAIL INTEGRATION ───────────────────────────────────────
        // Inbox (view, read, star, archive, batch)
        Route::middleware('check.permission:email.inbox.view')->group(function () {
            Route::get('emails', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'index']);
            Route::get('emails/stats', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'stats']);
            Route::get('emails/{email}', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'show']);
            Route::post('emails/{email}/toggle-star', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'toggleStar']);
            Route::post('emails/{email}/mark-read', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'markRead']);
            Route::post('emails/{email}/mark-unread', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'markUnread']);
            Route::post('emails/{email}/archive', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'archive']);
            Route::post('emails/{email}/link-entity', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'linkEntity']);
            Route::post('emails/batch-action', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'batchAction']);
        });
        // Send / Reply / Forward
        Route::middleware('check.permission:email.inbox.send')->group(function () {
            Route::post('emails/compose', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'compose']);
            Route::post('emails/{email}/reply', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'reply']);
            Route::post('emails/{email}/forward', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'forward']);
        });
        // Create task/chamado from email
        Route::middleware('check.permission:email.inbox.create_task')->post('emails/{email}/create-task', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'createTask']);
        // Email Accounts (admin)
        Route::middleware('check.permission:email.account.view')->group(function () {
            Route::get('email-accounts', [\App\Http\Controllers\Api\V1\Email\EmailAccountController::class, 'index']);
            Route::get('email-accounts/{emailAccount}', [\App\Http\Controllers\Api\V1\Email\EmailAccountController::class, 'show']);
        });
        Route::middleware('check.permission:email.account.create')->post('email-accounts', [\App\Http\Controllers\Api\V1\Email\EmailAccountController::class, 'store']);
        Route::middleware('check.permission:email.account.update')->group(function () {
            Route::put('email-accounts/{emailAccount}', [\App\Http\Controllers\Api\V1\Email\EmailAccountController::class, 'update']);
            Route::post('email-accounts/{emailAccount}/test-connection', [\App\Http\Controllers\Api\V1\Email\EmailAccountController::class, 'testConnection']);
        });
        Route::middleware('check.permission:email.account.sync')->post('email-accounts/{emailAccount}/sync', [\App\Http\Controllers\Api\V1\Email\EmailAccountController::class, 'syncNow']);
        Route::middleware('check.permission:email.account.delete')->delete('email-accounts/{emailAccount}', [\App\Http\Controllers\Api\V1\Email\EmailAccountController::class, 'destroy']);
        // Email Rules (automation)
        Route::middleware('check.permission:email.rule.view')->group(function () {
            Route::get('email-rules', [\App\Http\Controllers\Api\V1\Email\EmailRuleController::class, 'index']);
            Route::get('email-rules/{emailRule}', [\App\Http\Controllers\Api\V1\Email\EmailRuleController::class, 'show']);
        });
        Route::middleware('check.permission:email.rule.create')->post('email-rules', [\App\Http\Controllers\Api\V1\Email\EmailRuleController::class, 'store']);
        Route::middleware('check.permission:email.rule.update')->group(function () {
            Route::put('email-rules/{emailRule}', [\App\Http\Controllers\Api\V1\Email\EmailRuleController::class, 'update']);
            Route::post('email-rules/{emailRule}/toggle-active', [\App\Http\Controllers\Api\V1\Email\EmailRuleController::class, 'toggleActive']);
        });
        Route::middleware('check.permission:email.rule.delete')->delete('email-rules/{emailRule}', [\App\Http\Controllers\Api\V1\Email\EmailRuleController::class, 'destroy']);

        // ─── EMAIL ADVANCED (Phase 2) ───────────────────────────────
        // Templates
        Route::middleware('check.permission:email.template.view')->group(function () {
            Route::get('email-templates', [\App\Http\Controllers\Api\V1\Email\EmailTemplateController::class, 'index']);
            Route::get('email-templates/{emailTemplate}', [\App\Http\Controllers\Api\V1\Email\EmailTemplateController::class, 'show']);
        });
        Route::middleware('check.permission:email.template.create')->post('email-templates', [\App\Http\Controllers\Api\V1\Email\EmailTemplateController::class, 'store']);
        Route::middleware('check.permission:email.template.update')->put('email-templates/{emailTemplate}', [\App\Http\Controllers\Api\V1\Email\EmailTemplateController::class, 'update']);
        Route::middleware('check.permission:email.template.delete')->delete('email-templates/{emailTemplate}', [\App\Http\Controllers\Api\V1\Email\EmailTemplateController::class, 'destroy']);

        // Signatures
        Route::middleware('check.permission:email.signature.view')->get('email-signatures', [\App\Http\Controllers\Api\V1\Email\EmailSignatureController::class, 'index']);
        Route::middleware('check.permission:email.signature.manage')->group(function () {
            Route::post('email-signatures', [\App\Http\Controllers\Api\V1\Email\EmailSignatureController::class, 'store']);
            Route::put('email-signatures/{emailSignature}', [\App\Http\Controllers\Api\V1\Email\EmailSignatureController::class, 'update']);
            Route::delete('email-signatures/{emailSignature}', [\App\Http\Controllers\Api\V1\Email\EmailSignatureController::class, 'destroy']);
        });

        // Tags
        Route::middleware('check.permission:email.tag.view')->get('email-tags', [\App\Http\Controllers\Api\V1\Email\EmailTagController::class, 'index']);
        Route::middleware('check.permission:email.tag.manage')->group(function () {
            Route::post('email-tags', [\App\Http\Controllers\Api\V1\Email\EmailTagController::class, 'store']);
            Route::put('email-tags/{emailTag}', [\App\Http\Controllers\Api\V1\Email\EmailTagController::class, 'update']);
            Route::delete('email-tags/{emailTag}', [\App\Http\Controllers\Api\V1\Email\EmailTagController::class, 'destroy']);
            Route::post('emails/{email}/tags/{emailTag}', [\App\Http\Controllers\Api\V1\Email\EmailTagController::class, 'toggleTag']);
        });

        // Notes
        Route::middleware('check.permission:email.inbox.view')->get('emails/{email}/notes', [\App\Http\Controllers\Api\V1\Email\EmailNoteController::class, 'index']);
        Route::middleware('check.permission:email.inbox.manage')->group(function () {
            Route::post('emails/{email}/notes', [\App\Http\Controllers\Api\V1\Email\EmailNoteController::class, 'store']);
            Route::delete('email-notes/{emailNote}', [\App\Http\Controllers\Api\V1\Email\EmailNoteController::class, 'destroy']);
        });

        // Activity / Assignment / Snooze
        Route::middleware('check.permission:email.inbox.view')->get('emails/{email}/activities', [\App\Http\Controllers\Api\V1\Email\EmailActivityController::class, 'index']);
        Route::middleware('check.permission:email.inbox.manage')->group(function () {
            Route::post('emails/{email}/assign', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'assign']);
            Route::post('emails/{email}/snooze', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'snooze']);
        });


        // ─── ADVANCED FEATURES ───────────────────────────────────────
        Route::prefix('advanced')->group(function () {
            // Follow-ups
            Route::middleware('check.permission:commercial.followup.view')->get('follow-ups', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'indexFollowUps']);
            Route::middleware('check.permission:commercial.followup.manage')->group(function () {
                Route::post('follow-ups', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'storeFollowUp']);
                Route::put('follow-ups/{followUp}/complete', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'completeFollowUp']);
            });
            // Price tables
            Route::middleware('check.permission:commercial.price_table.view')->group(function () {
                Route::get('price-tables', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'indexPriceTables']);
                Route::get('price-tables/{priceTable}', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'showPriceTable']);
            });
            Route::middleware('check.permission:commercial.price_table.manage')->group(function () {
                Route::post('price-tables', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'storePriceTable']);
                Route::put('price-tables/{priceTable}', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'updatePriceTable']);
                Route::delete('price-tables/{priceTable}', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'destroyPriceTable']);
            });
        });

        // ─── PUBLIC ROUTES ───────────────────────────────────────────
        Route::get('pixel/{tracking_id}', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'track']);

            // Customer documents
            Route::middleware('check.permission:customer.document.view')->get('customers/{customer}/documents', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'indexCustomerDocuments']);
            Route::middleware('check.permission:customer.document.manage')->group(function () {
                Route::post('customers/{customer}/documents', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'storeCustomerDocument']);
                Route::delete('customer-documents/{document}', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'destroyCustomerDocument']);
            });
            // Cost centers
            Route::middleware('check.permission:finance.cost_center.view')->get('cost-centers', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'indexCostCenters']);
            Route::middleware('check.permission:finance.cost_center.manage')->group(function () {
                Route::post('cost-centers', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'storeCostCenter']);
                Route::put('cost-centers/{costCenter}', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'updateCostCenter']);
                Route::delete('cost-centers/{costCenter}', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'destroyCostCenter']);
            });
            // Collection rules
            Route::middleware('check.permission:finance.collection.view')->get('collection-rules', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'indexCollectionRules']);
            Route::middleware('check.permission:finance.collection.manage')->group(function () {
                Route::post('collection-rules', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'storeCollectionRule']);
                Route::put('collection-rules/{rule}', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'updateCollectionRule']);
            });
            // Route plans
            Route::middleware('check.permission:route.plan.view')->get('route-plans', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'indexRoutePlans']);
            Route::middleware('check.permission:route.plan.manage')->post('route-plans', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'storeRoutePlan']);
        });

        // Recrutamento (Vagas e Candidatos)
        Route::middleware('check.permission:hr.recruitment.manage')->group(function () {
            Route::apiResource('hr/job-postings', \App\Http\Controllers\Api\V1\JobPostingController::class);
            Route::post('hr/job-postings/{jobPosting}/candidates', [\App\Http\Controllers\Api\V1\JobPostingController::class, 'storeCandidate']);
            Route::put('hr/candidates/{candidate}', [\App\Http\Controllers\Api\V1\JobPostingController::class, 'updateCandidate']);
        });

        Route::middleware('check.permission:hr.recruitment.view')
            ->get('hr/job-postings/{jobPosting}/candidates', [\App\Http\Controllers\Api\V1\JobPostingController::class, 'candidates']);

        // Analytics
        Route::middleware('check.permission:hr.analytics.view')
            ->get('hr/analytics/dashboard', [\App\Http\Controllers\Api\V1\PeopleAnalyticsController::class, 'dashboard']);

        // Relatórios Contábeis
        Route::middleware('check.permission:hr.reports.view')->group(function () {
            Route::get('hr/reports/accounting', [\App\Http\Controllers\Api\V1\AccountingReportController::class, 'index']);
            Route::get('hr/reports/accounting/export', [\App\Http\Controllers\Api\V1\AccountingReportController::class, 'export']);
        });

        // --- Wave 3: Organization ---
        Route::middleware('check.permission:hr.organization.view')->group(function () {
            Route::get('hr/departments', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'indexDepartments']);
            Route::get('hr/positions', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'indexPositions']);
            Route::get('hr/org-chart', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'orgChart']);
        });
        Route::middleware('check.permission:hr.organization.manage')->group(function () {
            Route::post('hr/departments', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'storeDepartment']);
            Route::put('hr/departments/{department}', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'updateDepartment']);
            Route::delete('hr/departments/{department}', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'destroyDepartment']);

            Route::post('hr/positions', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'storePosition']);
            Route::put('hr/positions/{position}', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'updatePosition']);
            Route::delete('hr/positions/{position}', [\App\Http\Controllers\Api\V1\OrganizationController::class, 'destroyPosition']);
        });

        // --- Wave 3: Skills Matrix ---
        Route::middleware('check.permission:hr.skills.view')->group(function () {
            Route::apiResource('hr/skills', \App\Http\Controllers\Api\V1\SkillsController::class)->only(['index', 'show']);
            Route::get('hr/skills-matrix', [\App\Http\Controllers\Api\V1\SkillsController::class, 'matrix']);
        });
        Route::middleware('check.permission:hr.skills.manage')->group(function () {
            Route::apiResource('hr/skills', \App\Http\Controllers\Api\V1\SkillsController::class)->only(['store', 'update', 'destroy']);
            Route::post('hr/skills/assess/{user}', [\App\Http\Controllers\Api\V1\SkillsController::class, 'assessUser']);
        });

        // --- Wave 3: Performance & Feedback ---
        Route::middleware('check.permission:hr.performance.view')->group(function () {
            Route::get('hr/performance-reviews', [\App\Http\Controllers\Api\V1\PerformanceReviewController::class, 'indexReviews']);
            Route::get('hr/performance-reviews/{review}', [\App\Http\Controllers\Api\V1\PerformanceReviewController::class, 'showReview']);
        });
        Route::middleware('check.permission:hr.performance.manage')->group(function () {
            Route::post('hr/performance-reviews', [\App\Http\Controllers\Api\V1\PerformanceReviewController::class, 'storeReview']);
            Route::put('hr/performance-reviews/{review}', [\App\Http\Controllers\Api\V1\PerformanceReviewController::class, 'updateReview']);
            Route::delete('hr/performance-reviews/{review}', [\App\Http\Controllers\Api\V1\PerformanceReviewController::class, 'destroyReview']);
        });

        // Feedback routes with specific permissions
        Route::middleware('check.permission:hr.feedback.view')->group(function () {
            Route::get('hr/continuous-feedback', [\App\Http\Controllers\Api\V1\PerformanceReviewController::class, 'indexFeedback']);
        });
        Route::middleware('check.permission:hr.feedback.create')->group(function () {
            Route::post('hr/continuous-feedback', [\App\Http\Controllers\Api\V1\PerformanceReviewController::class, 'storeFeedback']);
        });

        // --- Wave 4: Benefits ---
        Route::middleware('check.permission:hr.benefits.view')->group(function () {
            Route::apiResource('hr/benefits', \App\Http\Controllers\Api\V1\EmployeeBenefitController::class)->only(['index', 'show']);
        });
        Route::middleware('check.permission:hr.benefits.manage')->group(function () {
            Route::apiResource('hr/benefits', \App\Http\Controllers\Api\V1\EmployeeBenefitController::class)->only(['store', 'update', 'destroy']);
        });

        // ═══ Financeiro Avançado ══════════════════════════════════════
        Route::prefix('financial')->middleware('check.permission:financeiro.view')->group(function () {
            Route::get('supplier-contracts', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'supplierContracts']);
            Route::post('supplier-contracts', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'storeSupplierContract']);
            Route::post('tax-calculation', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'taxCalculation']);
            Route::get('expense-reimbursements', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'expenseReimbursements']);
            Route::post('expense-reimbursements/{expense}/approve', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'approveReimbursement'])
                ->middleware('check.permission:financeiro.approve');
            Route::get('checks', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'checks']);
            Route::post('checks', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'storeCheck']);
            Route::patch('checks/{check}/status', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'updateCheckStatus']);
            Route::post('receivables-simulator', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'receivablesSimulator']);
            Route::get('collection-rules', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'collectionRules']);
            Route::get('supplier-advances', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'supplierAdvances']);
            Route::post('supplier-advances', [\App\Http\Controllers\Api\V1\Financial\FinancialAdvancedController::class, 'storeSupplierAdvance']);
        });

        // ═══ Estoque Avançado ═════════════════════════════════════════
        Route::prefix('stock-advanced')->middleware('check.permission:estoque.view')->group(function () {
            // Purchase Quotations
            Route::get('purchase-quotations', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'purchaseQuotations']);
            Route::post('purchase-quotations', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'storePurchaseQuotation']);
            // Stock Transfers
            Route::get('transfers', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'stockTransfers']);
            Route::get('transfers/suggest', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'suggestTransfers']);
            Route::post('transfers', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'storeTransfer']);
            // Serial Numbers
            Route::get('serial-numbers', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'serialNumbers']);
            Route::post('serial-numbers', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'storeSerialNumber']);
            // Material Requests
            Route::get('material-requests', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'materialRequests']);
            Route::post('material-requests', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'storeMaterialRequest']);
            Route::post('material-requests/{id}/approve', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'approveMaterialRequest']);
            // RMA
            Route::get('rma', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'rmaList']);
            Route::post('rma', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'storeRma']);
            Route::patch('rma/{id}/status', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'updateRmaStatus']);
            // Asset Tags (RFID/QR)
            Route::get('asset-tags', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'assetTags']);
            Route::post('asset-tags', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'storeAssetTag']);
            Route::post('asset-tags/scan', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'scanAssetTag']);
            // Ecological Disposal
            Route::get('ecological-disposals', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'ecologicalDisposals']);
            Route::post('ecological-disposals', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'storeEcologicalDisposal']);
            // NF-e XML Import
            Route::post('import-nfe-xml', [\App\Http\Controllers\Api\V1\StockAdvancedController::class, 'importNfeXml']);
        });

        // ═══ CRM Avançado ═════════════════════════════════════════════
        Route::prefix('crm-advanced')->middleware('check.permission:crm.view')->group(function () {
            Route::get('proposal-pdf/{quoteId}', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'generateProposalPdf']);
            Route::get('multi-option-quotes', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'multiOptionQuotes']);
            Route::post('quotes/{quoteId}/variant', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'createQuoteVariant']);
            Route::get('client-heat-map', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'clientHeatMap']);
            Route::get('sales-gamification', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'salesGamification']);
            Route::post('import-leads', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'importLeads']);
            Route::get('email-campaigns', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'emailCampaigns']);
            Route::post('email-campaigns', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'storeEmailCampaign']);
            Route::post('whatsapp/send', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'sendWhatsApp']);
            Route::get('whatsapp/history', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'whatsAppHistory']);
            Route::get('self-service/catalog', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'selfServiceCatalog']);
            Route::post('self-service/quote-request', [\App\Http\Controllers\Api\V1\CrmAdvancedController::class, 'selfServiceQuoteRequest']);
        });

        // ═══ Laboratório Avançado ═════════════════════════════════════
        Route::prefix('lab-advanced')->middleware('check.permission:qualidade.view')->group(function () {
            Route::post('rr-study', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'rrStudy']);
            Route::get('sensor-readings', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'sensorReadings']);
            Route::post('sensor-readings', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'storeSensorReading']);
            Route::post('sign-certificate', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'signCertificate']);
            Route::get('retention-samples', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'retentionSamples']);
            Route::post('retention-samples', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'storeRetentionSample']);
            Route::get('logbook', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'labLogbook']);
            Route::post('logbook', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'storeLogbookEntry']);
            Route::get('raw-data-backups', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'rawDataBackups']);
            Route::post('raw-data-backups', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'triggerRawDataBackup']);
            Route::get('scale-readings', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'scaleReadings']);
            Route::post('scale-readings', [\App\Http\Controllers\Api\V1\LabAdvancedController::class, 'storeScaleReading']);
        });

        // ═══ Portal do Cliente ════════════════════════════════════════
        Route::prefix('portal')->group(function () {
            Route::get('dashboard/{customerId}', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'executiveDashboard']);
            Route::post('certificates/batch-download', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'batchCertificateDownload']);
            Route::post('tickets/qr-code', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'openTicketByQrCode']);
            Route::post('quotes/{quoteId}/approve', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'oneClickApproval']);
            Route::get('chat/{ticketId}/messages', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'chatMessages']);
            Route::post('chat/{ticketId}/messages', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'sendChatMessage']);
            Route::get('financial/{customerId}', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'financialHistory']);
            Route::get('schedule/slots', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'availableSlots']);
            Route::post('schedule/book', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'bookSlot']);
            Route::post('push/subscribe', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'registerPushSubscription']);
            Route::get('knowledge-base', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'knowledgeBase']);
            Route::post('knowledge-base', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'storeArticle']);
            Route::get('customers/{customerId}/locations', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'customerLocations']);
            Route::post('customers/{customerId}/locations', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'storeLocation']);
            Route::get('api-docs', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'publicApiOverview']);
            Route::get('white-label', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'whiteLabelConfig']);
            Route::put('white-label', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'updateWhiteLabelConfig']);
            Route::get('nps', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'npsSurveys']);
            Route::post('nps', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'submitNps']);
            Route::get('equipment-map/{customerId}', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'equipmentMap']);
            Route::post('bi-report/{customerId}', [\App\Http\Controllers\Api\V1\PortalClienteController::class, 'biSelfServiceReport']);
        });

        // ═══ Integrações ══════════════════════════════════════════════
        Route::prefix('integrations')->group(function () {
            Route::get('webhooks', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'webhooks']);
            Route::post('webhooks', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'storeWebhook']);
            Route::delete('webhooks/{id}', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'deleteWebhook']);
            Route::get('erp-sync', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'erpSyncStatus']);
            Route::post('erp-sync', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'triggerErpSync']);
            Route::get('marketplace', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'marketplace']);
            Route::post('marketplace/request', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'requestPartnerIntegration']);
            Route::get('sso', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'ssoConfig']);
            Route::put('sso', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'updateSsoConfig']);
            Route::get('notification-channels', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'slackTeamsConfig']);
            Route::post('notification-channels', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'storeNotificationChannel']);
            Route::post('shipping/calculate', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'calculateShipping']);
            Route::get('marketing', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'marketingIntegrationConfig']);
            Route::put('marketing', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'updateMarketingConfig']);
            Route::get('swagger', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'swaggerDoc']);
            Route::get('email-plugin/manifest', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'emailPluginManifest']);
            Route::post('email-plugin/webhook', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'emailPluginWebhook']);
            Route::post('power-bi/export', [\App\Http\Controllers\Api\V1\IntegrationController::class, 'powerBiDataExport']);
        });

        // ═══ Segurança ════════════════════════════════════════════════
        Route::prefix('security')->group(function () {
            Route::post('2fa/enable', [\App\Http\Controllers\Api\V1\SecurityController::class, 'enable2fa']);
            Route::post('2fa/verify', [\App\Http\Controllers\Api\V1\SecurityController::class, 'verify2fa']);
            Route::get('sessions', [\App\Http\Controllers\Api\V1\SecurityController::class, 'activeSessions']);
            Route::delete('sessions/{sessionId}', [\App\Http\Controllers\Api\V1\SecurityController::class, 'revokeSession']);
            Route::post('sessions/revoke-all', [\App\Http\Controllers\Api\V1\SecurityController::class, 'revokeAllSessions']);
            Route::get('data-masking', [\App\Http\Controllers\Api\V1\SecurityController::class, 'dataMaskingRules']);
            Route::post('data-masking', [\App\Http\Controllers\Api\V1\SecurityController::class, 'storeDataMaskingRule']);
            Route::get('backups', [\App\Http\Controllers\Api\V1\SecurityController::class, 'backupHistory']);
            Route::post('backups', [\App\Http\Controllers\Api\V1\SecurityController::class, 'triggerBackup']);
            Route::get('password-policy', [\App\Http\Controllers\Api\V1\SecurityController::class, 'passwordPolicy']);
            Route::put('password-policy', [\App\Http\Controllers\Api\V1\SecurityController::class, 'updatePasswordPolicy']);
            Route::get('geo-alerts', [\App\Http\Controllers\Api\V1\SecurityController::class, 'geoLoginAlerts']);
            Route::get('consents', [\App\Http\Controllers\Api\V1\SecurityController::class, 'consentRecords']);
            Route::post('consents', [\App\Http\Controllers\Api\V1\SecurityController::class, 'storeConsent']);
            Route::get('watermark', [\App\Http\Controllers\Api\V1\SecurityController::class, 'watermarkConfig']);
            Route::put('watermark', [\App\Http\Controllers\Api\V1\SecurityController::class, 'updateWatermarkConfig']);
            Route::get('access-restrictions', [\App\Http\Controllers\Api\V1\SecurityController::class, 'accessRestrictions']);
            Route::post('access-restrictions', [\App\Http\Controllers\Api\V1\SecurityController::class, 'storeAccessRestriction']);
            Route::get('vulnerability-scans', [\App\Http\Controllers\Api\V1\SecurityController::class, 'vulnerabilityScanResults']);
            Route::post('vulnerability-scans', [\App\Http\Controllers\Api\V1\SecurityController::class, 'triggerScan']);
        });

        // ═══ Frota Avançada (GPS, Pedágio, Rotas) ═════════════════════
        Route::prefix('fleet-advanced')->group(function () {
            Route::get('tolls', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'tollTransactions']);
            Route::post('tolls', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'storeTollTransaction']);
            Route::get('gps', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'gpsTracking']);
            Route::post('gps', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'storeGpsPosition']);
            Route::get('route-analysis', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'routeAnalysis']);
        });

        // ═══ RH Avançado (Portal, EPI, Gamificação, Organograma) ══════
        Route::prefix('hr-advanced')->group(function () {
            Route::get('employee-portal', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'employeePortal']);
            Route::get('epi', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'epiList']);
            Route::post('epi', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'storeEpi']);
            Route::get('gamification', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'productivityGamification']);
            Route::get('org-chart', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'orgChart']);
        });

        // ═══ Financeiro Avançado (Boleto, NFS-e, Gateway, Portal, Bloqueio) ═
        Route::prefix('financial-extra')->middleware('check.permission:financeiro.view')->group(function () {
            Route::post('boleto', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'generateBoleto']);
            Route::post('nfse', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'emitNfse']);
            Route::get('payment-gateway', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'paymentGatewayConfig']);
            Route::post('payment-gateway/pay', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'processOnlinePayment']);
            Route::get('portal-overview', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'financialPortalOverview']);
            Route::post('customers/{customerId}/block', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'toggleCustomerBlock']);
        });

        // ═══ Mobile ═══════════════════════════════════════════════════
        Route::prefix('mobile')->group(function () {
            Route::get('preferences', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'userPreferences']);
            Route::put('preferences', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'updatePreferences']);
            Route::get('sync-queue', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'syncQueue']);
            Route::post('sync-queue', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'addToSyncQueue']);
            Route::get('notifications', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'interactiveNotifications']);
            Route::post('notifications/{notificationId}/respond', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'respondToNotification']);
            Route::get('barcode/lookup', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'barcodeLookup']);
            Route::post('signature', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'storeSignature']);
            Route::get('print-jobs', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'printJobs']);
            Route::post('print-jobs', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'createPrintJob']);
            Route::post('voice-report', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'storeVoiceReport']);
            Route::get('biometric', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'biometricConfig']);
            Route::put('biometric', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'updateBiometricConfig']);
            Route::post('photo-annotation', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'storePhotoAnnotation']);
            Route::post('thermal-readings', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'storeThermalReading']);
            Route::get('kiosk-config', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'kioskConfig']);
            Route::put('kiosk-config', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'updateKioskConfig']);
            Route::get('offline-map-regions', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'offlineMapRegions']);
        });

        // ═══ Inovação ════════════════════════════════════════════════
        Route::prefix('innovation')->group(function () {
            Route::get('theme', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'themeConfig']);
            Route::put('theme', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'updateThemeConfig']);
            Route::get('referrals', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'referralProgram']);
            Route::post('referrals/generate', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'generateReferralCode']);
            Route::post('roi-calculator', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'roiCalculator']);
            Route::get('presentation', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'presentationData']);
            Route::get('easter-egg/{code}', [\App\Http\Controllers\Api\V1\RemainingModulesController::class, 'easterEgg']);
        });

        // Inventário e Selos INMETRO
        Route::prefix('inventory')->group(function () {
            Route::middleware('check.permission:inmetro.intelligence.view')->group(function () {
                Route::get('seals', [\App\Http\Controllers\Inventory\InmetroSealController::class, 'index']);
                Route::get('seals/my', [\App\Http\Controllers\Inventory\InmetroSealController::class, 'mySeals']);
                Route::get('seals/export', [\App\Http\Controllers\Inventory\InmetroSealController::class, 'export']);
                Route::get('seals/audit', [\App\Http\Controllers\Inventory\InmetroSealController::class, 'audit']);
            });
            Route::middleware('check.permission:inmetro.intelligence.convert')->group(function () {
                Route::post('seals/batch', [\App\Http\Controllers\Inventory\InmetroSealController::class, 'storeBatch']);
                Route::post('seals/assign', [\App\Http\Controllers\Inventory\InmetroSealController::class, 'assignToTechnician']);
                Route::post('seals/{id}/use', [\App\Http\Controllers\Inventory\InmetroSealController::class, 'useSeal']);
            });
        });

        // ═══ Análise Financeira ═══════════════════════════════════════
        Route::prefix('financial')->middleware('check.permission:financeiro.view')->group(function () {
            Route::get('cash-flow-projection', [\App\Http\Controllers\Api\V1\Financial\FinancialAnalyticsController::class, 'cashFlowProjection']);
            Route::get('dre', [\App\Http\Controllers\Api\V1\Financial\FinancialAnalyticsController::class, 'dre']);
            Route::get('aging-report', [\App\Http\Controllers\Api\V1\Financial\FinancialAnalyticsController::class, 'agingReport']);
            Route::get('expense-allocation', [\App\Http\Controllers\Api\V1\Financial\FinancialAnalyticsController::class, 'expenseAllocation']);
            Route::get('batch-payment-approval', [\App\Http\Controllers\Api\V1\Financial\FinancialAnalyticsController::class, 'batchPaymentApproval']);
        });
        Route::post('financial/batch-payment-approval', [\App\Http\Controllers\Api\V1\Financial\FinancialAnalyticsController::class, 'approveBatchPayment'])
            ->middleware('check.permission:financeiro.approve');


        // ═══ Análise Comercial ════════════════════════════════════════
        Route::prefix('sales')->middleware('check.permission:comercial.view')->group(function () {
            Route::get('quote-rentability/{quote}', [\App\Http\Controllers\Api\V1\SalesAnalyticsController::class, 'quoteRentability']);
            Route::get('follow-up-queue', [\App\Http\Controllers\Api\V1\SalesAnalyticsController::class, 'followUpQueue']);
            Route::get('loss-reasons', [\App\Http\Controllers\Api\V1\SalesAnalyticsController::class, 'lossReasons']);
            Route::get('client-segmentation', [\App\Http\Controllers\Api\V1\SalesAnalyticsController::class, 'clientSegmentation']);
            Route::get('upsell-suggestions/{customer}', [\App\Http\Controllers\Api\V1\SalesAnalyticsController::class, 'upsellSuggestions']);
            Route::get('discount-requests', [\App\Http\Controllers\Api\V1\SalesAnalyticsController::class, 'discountRequests']);
        });

        // ═══ Kardex de Produto ═══════════════════════════════════════
        Route::middleware('check.permission:estoque.view')->group(function () {
            Route::get('products/{product}/kardex', [\App\Http\Controllers\Api\V1\ProductKardexController::class, 'index']);
            Route::get('products/{product}/kardex/summary', [\App\Http\Controllers\Api\V1\ProductKardexController::class, 'monthlySummary']);
        });

        // ═══ Rastreamento de Ferramentas ═════════════════════════════
        Route::prefix('tools')->middleware('check.permission:estoque.manage')->group(function () {
            Route::get('checkouts', [\App\Http\Controllers\Api\V1\ToolTrackingController::class, 'index']);
            Route::post('checkout', [\App\Http\Controllers\Api\V1\ToolTrackingController::class, 'checkout']);
            Route::post('checkin/{checkout}', [\App\Http\Controllers\Api\V1\ToolTrackingController::class, 'checkin']);
            Route::get('overdue', [\App\Http\Controllers\Api\V1\ToolTrackingController::class, 'overdue']);
        });

        // ═══ IA & Análise ═══════════════════════════════════════════════
        Route::prefix('ai')->middleware('check.permission:ai.analytics.view')->group(function () {
            Route::get('predictive-maintenance', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'predictiveMaintenance']);
            Route::get('expense-ocr-analysis', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'expenseOcrAnalysis']);
            Route::get('triage-suggestions', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'triageSuggestions']);
            Route::get('sentiment-analysis', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'sentimentAnalysis']);
            Route::get('dynamic-pricing', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'dynamicPricing']);
            Route::get('financial-anomalies', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'financialAnomalies']);
            Route::get('voice-commands', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'voiceCommandSuggestions']);
            Route::get('natural-language-report', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'naturalLanguageReport']);
            Route::get('customer-clustering', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'customerClustering']);
            Route::get('equipment-image-analysis', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'equipmentImageAnalysis']);
            Route::get('demand-forecast', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'demandForecast']);
            Route::get('route-optimization', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'aiRouteOptimization']);
            Route::get('smart-ticket-labeling', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'smartTicketLabeling']);
            Route::get('churn-prediction', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'churnPrediction']);
            Route::get('service-summary/{workOrderId}', [\App\Http\Controllers\Api\V1\AIAnalyticsController::class, 'serviceSummary']);
        });

    });


// ─── PUBLIC: Work Order Rating ───────────────────────────────
Route::post('rate/{token}', [\App\Http\Controllers\Api\V1\AdvancedFeaturesController::class, 'submitRating']);

// â?,â?,â?, Webhooks (verificaf§f£o por assinatura) â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,
Route::prefix('webhooks')->middleware('verify.webhook')->group(function () {
    Route::post('whatsapp', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'webhookWhatsApp']);
    Route::post('email', [\App\Http\Controllers\Api\V1\CrmMessageController::class, 'webhookEmail']);
});

// â?,â?,â?, Rotas pfºblicas (sem autenticaf§f£o, com token) â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,â?,
Route::prefix('quotes')->group(function () {
    Route::get('{quote}/public-view', [\App\Http\Controllers\Api\V1\QuoteController::class, 'publicView']);
    Route::post('{quote}/public-approve', [\App\Http\Controllers\Api\V1\QuoteController::class, 'publicApprove']);
});

// Email Tracking (Pixel)
Route::get('pixel/{trackingId}', [\App\Http\Controllers\Api\V1\Email\EmailController::class, 'track']);
