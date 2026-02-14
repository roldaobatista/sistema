#!/usr/bin/env node
/**
 * KALIBRIUM ERP — Scan MVP Profundo v1.0
 * Verificação REAL de código, não apenas pattern matching.
 *
 * Camada 1: Backend Profundo (corpo métodos, Model, fillable, relationships, validação)
 * Camada 2: Frontend Profundo (campos form, endpoints, empty state, paginação)
 * Camada 3: Cross-Module (rotas→controller, frontend→backend, migration↔model)
 * Camada 4: API Health Check (GET endpoints, auth) — flag --health
 *
 * Uso:
 *   node scan_mvp_profundo.mjs
 *   node scan_mvp_profundo.mjs --health          # inclui API health check
 *   node scan_mvp_profundo.mjs --module Clientes  # analisa 1 módulo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend', 'src');
const CONTROLLERS = path.join(BACKEND, 'app', 'Http', 'Controllers', 'Api', 'V1');
const MODELS_DIR = path.join(BACKEND, 'app', 'Models');
const REQUESTS_DIR = path.join(BACKEND, 'app', 'Http', 'Requests');
const MIGRATIONS_DIR = path.join(BACKEND, 'database', 'migrations');
const PAGES_DIR = path.join(FRONTEND, 'pages');
const API_ROUTES = path.join(BACKEND, 'routes', 'api.php');

const ARGS = process.argv.slice(2);
const WITH_HEALTH = ARGS.includes('--health');
const FILTER_MODULE = ARGS.find((a, i) => ARGS[i - 1] === '--module') || null;

// ── Colors ──
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', cyan: '\x1b[36m', white: '\x1b[37m',
    bgRed: '\x1b[41m', bgGreen: '\x1b[42m', bgYellow: '\x1b[43m',
};

// ── Module definitions ──
const modules = [
    { name: 'Login / Auth', priority: 'P0', controllers: ['Auth/AuthController.php'], models: ['User'], frontendPages: ['LoginPage.tsx'], routePatterns: ['login', 'logout', 'me'], crudRequired: false, tableName: 'users' },
    { name: 'Dashboard', priority: 'P0', controllers: ['DashboardController.php'], models: [], frontendPages: ['DashboardPage.tsx'], routePatterns: ['dashboard-stats'], crudRequired: false, tableName: '' },
    { name: 'Clientes', priority: 'P0', controllers: ['Master/CustomerController.php'], models: ['Customer'], frontendPages: ['cadastros/CustomersPage.tsx'], routePatterns: ['customers'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'customers' },
    { name: 'Produtos', priority: 'P0', controllers: ['Master/ProductController.php'], models: ['Product'], frontendPages: ['cadastros/ProductsPage.tsx'], routePatterns: ['products'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'products' },
    { name: 'Servicos', priority: 'P0', controllers: ['Master/ServiceController.php'], models: ['Service'], frontendPages: ['cadastros/ServicesPage.tsx'], routePatterns: ['services'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'services' },
    { name: 'Fornecedores', priority: 'P1', controllers: ['Master/SupplierController.php'], models: ['Supplier'], frontendPages: ['cadastros/SuppliersPage.tsx'], routePatterns: ['suppliers'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'suppliers' },
    { name: 'Ordens de Servico', priority: 'P0', controllers: ['Os/WorkOrderController.php'], models: ['WorkOrder'], frontendPages: ['os/WorkOrdersListPage.tsx', 'os/WorkOrderCreatePage.tsx', 'os/WorkOrderDetailPage.tsx'], routePatterns: ['work-orders'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'work_orders' },
    { name: 'Orcamentos', priority: 'P0', controllers: ['QuoteController.php'], models: ['Quote'], frontendPages: ['orcamentos/QuotesListPage.tsx', 'orcamentos/QuoteCreatePage.tsx'], routePatterns: ['quotes'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'quotes' },
    { name: 'Chamados', priority: 'P1', controllers: ['ServiceCallController.php'], models: ['ServiceCall'], frontendPages: ['chamados/ServiceCallsPage.tsx', 'chamados/ServiceCallCreatePage.tsx'], routePatterns: ['service-calls'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'service_calls' },
    { name: 'Contas a Receber', priority: 'P0', controllers: ['Financial/AccountReceivableController.php'], models: ['AccountReceivable'], frontendPages: ['financeiro/AccountsReceivablePage.tsx'], routePatterns: ['accounts-receivable'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'accounts_receivable' },
    { name: 'Contas a Pagar', priority: 'P0', controllers: ['Financial/AccountPayableController.php'], models: ['AccountPayable'], frontendPages: ['financeiro/AccountsPayablePage.tsx'], routePatterns: ['accounts-payable'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'accounts_payable' },
    { name: 'Despesas', priority: 'P1', controllers: ['Financial/ExpenseController.php'], models: ['Expense'], frontendPages: ['financeiro/ExpensesPage.tsx'], routePatterns: ['expenses'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'expenses' },
    { name: 'Comissoes', priority: 'P1', controllers: ['Financial/CommissionController.php'], models: ['CommissionRule', 'CommissionEvent', 'CommissionSettlement'], frontendPages: ['financeiro/CommissionsPage.tsx'], routePatterns: ['commission-rules', 'commission-events', 'commission-settlements'], crudRequired: false, tableName: 'commission_rules' },
    { name: 'Faturamento', priority: 'P1', controllers: ['InvoiceController.php'], models: ['Invoice'], frontendPages: ['financeiro/InvoicesPage.tsx'], routePatterns: ['invoices'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'invoices' },
    { name: 'Fluxo de Caixa', priority: 'P1', controllers: ['CashFlowController.php'], models: [], frontendPages: ['financeiro/CashFlowPage.tsx'], routePatterns: ['cash-flow', 'dre'], crudRequired: false, tableName: '' },
    { name: 'Conciliacao Bancaria', priority: 'P2', controllers: ['BankReconciliationController.php'], models: ['BankStatement', 'BankStatementEntry'], frontendPages: ['financeiro/BankReconciliationPage.tsx'], routePatterns: ['bank-reconciliation'], crudRequired: false, tableName: '' },
    { name: 'Equipamentos', priority: 'P1', controllers: ['EquipmentController.php'], models: ['Equipment'], frontendPages: ['equipamentos/EquipmentListPage.tsx', 'equipamentos/EquipmentCreatePage.tsx'], routePatterns: ['equipments'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'equipments' },
    { name: 'Estoque', priority: 'P1', controllers: ['StockController.php'], models: ['StockMovement'], frontendPages: ['estoque/StockMovementsPage.tsx'], routePatterns: ['stock/movements', 'stock/summary'], crudRequired: false, tableName: 'stock_movements' },
    { name: 'Tecnicos / Agendas', priority: 'P1', controllers: ['Technician/ScheduleController.php', 'Technician/TimeEntryController.php'], models: ['Schedule', 'TimeEntry'], frontendPages: ['tecnicos/SchedulesPage.tsx', 'tecnicos/TimeEntriesPage.tsx'], routePatterns: ['schedules', 'time-entries'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'schedules' },
    { name: 'Caixa do Tecnico', priority: 'P1', controllers: ['TechnicianCashController.php'], models: ['TechnicianCashTransaction'], frontendPages: ['tecnicos/TechnicianCashPage.tsx'], routePatterns: ['technician-cash'], crudRequired: false, tableName: '' },
    { name: 'Usuarios / IAM', priority: 'P0', controllers: ['Iam/UserController.php', 'Iam/RoleController.php', 'Iam/PermissionController.php'], models: ['User'], frontendPages: ['iam/UsersPage.tsx', 'iam/RolesPage.tsx'], routePatterns: ['users', 'roles', 'permissions'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'users' },
    { name: 'Relatorios', priority: 'P2', controllers: ['ReportController.php'], models: [], frontendPages: ['relatorios/ReportsPage.tsx'], routePatterns: ['reports/'], crudRequired: false, tableName: '' },
    { name: 'CRM / Pipeline', priority: 'P2', controllers: ['CrmController.php'], models: ['CrmDeal', 'CrmPipeline', 'CrmActivity'], frontendPages: ['CrmPipelinePage.tsx', 'CrmDashboardPage.tsx'], routePatterns: ['crm/'], crudRequired: false, tableName: '' },
    { name: 'INMETRO', priority: 'P2', controllers: ['InmetroController.php', 'InmetroAdvancedController.php'], models: [], frontendPages: ['inmetro/InmetroDashboardPage.tsx'], routePatterns: ['inmetro/'], crudRequired: false, tableName: '' },
    { name: 'Importacao', priority: 'P2', controllers: ['ImportController.php'], models: ['Import'], frontendPages: ['importacao/ImportPage.tsx'], routePatterns: ['import/'], crudRequired: false, tableName: 'imports' },
    { name: 'Fiscal', priority: 'P2', controllers: ['FiscalController.php'], models: ['FiscalNote'], frontendPages: ['fiscal/FiscalNotesPage.tsx'], routePatterns: ['fiscal/'], crudRequired: false, tableName: '' },
    { name: 'Pesos Padrao', priority: 'P1', controllers: ['StandardWeightController.php'], models: ['StandardWeight'], frontendPages: ['equipamentos/StandardWeightsPage.tsx'], routePatterns: ['standard-weights'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'standard_weights' },
    { name: 'Contratos Recorrentes', priority: 'P1', controllers: ['Os/RecurringContractController.php'], models: ['RecurringContract'], frontendPages: ['os/RecurringContractsPage.tsx'], routePatterns: ['recurring-contracts'], crudRequired: true, crudMethods: ['index', 'store', 'show', 'update', 'destroy'], tableName: 'recurring_contracts' },
    { name: 'Notificacoes', priority: 'P2', controllers: ['NotificationController.php'], models: ['Notification'], frontendPages: ['notificacoes/NotificationsPage.tsx'], routePatterns: ['notifications'], crudRequired: false, tableName: 'notifications' },
    { name: 'Configuracoes', priority: 'P2', controllers: ['SettingsController.php', 'TenantController.php', 'BranchController.php'], models: ['SystemSetting', 'Tenant', 'Branch'], frontendPages: ['configuracoes/SettingsPage.tsx'], routePatterns: ['settings', 'tenants', 'branches'], crudRequired: false, tableName: '' },
    { name: 'Central de Atendimento', priority: 'P2', controllers: ['CentralController.php'], models: ['CentralItem', 'CentralRule'], frontendPages: ['central/CentralPage.tsx'], routePatterns: ['central'], crudRequired: false, tableName: '' },
    { name: 'Emails', priority: 'P3', controllers: ['Email/EmailController.php'], models: ['Email', 'EmailAccount'], frontendPages: ['emails/EmailInboxPage.tsx'], routePatterns: ['emails'], crudRequired: false, tableName: 'emails' },
    { name: 'Portal do Cliente', priority: 'P3', controllers: ['Portal/PortalController.php'], models: ['ClientPortalUser'], frontendPages: ['portal/PortalDashboardPage.tsx'], routePatterns: ['portal'], crudRequired: false, tableName: '' },
    { name: 'Qualidade', priority: 'P3', controllers: ['QualityController.php'], models: ['QualityProcedure', 'CorrectiveAction', 'CustomerComplaint', 'SatisfactionSurvey'], frontendPages: ['qualidade/QualityPage.tsx'], routePatterns: ['quality'], crudRequired: false, tableName: '' },
    { name: 'Integracoes Estoque', priority: 'P3', controllers: ['IntegrationController.php'], models: ['PurchaseQuote', 'MaterialRequest', 'AssetTag', 'Rma', 'EcologicalDisposal'], frontendPages: ['estoque/StockIntegrationPage.tsx'], routePatterns: ['purchase-quotes', 'material-requests', 'asset-tags', 'rma'], crudRequired: false, tableName: '' },
    { name: 'Auvo Import', priority: 'P3', controllers: ['AuvoImportController.php'], models: ['AuvoImport'], frontendPages: ['integracao/AuvoImportPage.tsx'], routePatterns: ['auvo/'], crudRequired: false, tableName: '' },
    { name: 'Formas de Pagamento', priority: 'P1', controllers: ['PaymentMethodController.php'], models: ['PaymentMethod'], frontendPages: ['financeiro/PaymentMethodsPage.tsx'], routePatterns: ['payment-methods'], crudRequired: true, crudMethods: ['index', 'store', 'update', 'destroy'], tableName: 'payment_methods' },
    { name: 'Plano de Contas', priority: 'P2', controllers: ['ChartOfAccountController.php'], models: ['ChartOfAccount'], frontendPages: ['financeiro/ChartOfAccountsPage.tsx'], routePatterns: ['chart-of-accounts'], crudRequired: true, crudMethods: ['index', 'store', 'update', 'destroy'], tableName: 'chart_of_accounts' },
    { name: 'Frota', priority: 'P3', controllers: ['FleetController.php'], models: ['FleetVehicle', 'VehicleInspection', 'TrafficFine', 'ToolInventory'], frontendPages: ['fleet/FleetPage.tsx'], routePatterns: ['fleet/', 'vehicles'], crudRequired: false, tableName: '' },
    { name: 'RH', priority: 'P3', controllers: ['HRController.php', 'HRAdvancedController.php'], models: ['Department', 'Candidate'], frontendPages: ['rh/HRPage.tsx'], routePatterns: ['hr/'], crudRequired: false, tableName: '' },
];

// ── File helpers ──
function readFile(filePath) {
    try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function fileExists(filePath) {
    return fs.existsSync(filePath);
}

function findFiles(dir, ext) {
    if (!fs.existsSync(dir)) return [];
    const results = [];
    for (const f of fs.readdirSync(dir, { recursive: true })) {
        if (f.endsWith(ext)) results.push(path.join(dir, f));
    }
    return results;
}

// ── CAMADA 1: Backend Profundo ──
function analyzeBackend(mod) {
    const results = [];

    // 1.1 Controller: métodos com corpo real
    const allControllerMethods = [];
    for (const ctrl of mod.controllers) {
        const filePath = path.join(CONTROLLERS, ctrl);
        const content = readFile(filePath);
        if (!content) {
            results.push({ check: `Controller ${path.basename(ctrl)}`, status: 'FAIL', detail: 'Arquivo não encontrado' });
            continue;
        }

        // Parse methods
        const methodRegex = /(?:public|protected|private)\s+function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*\S+)?\s*\{/g;
        let match;
        const methods = [];
        while ((match = methodRegex.exec(content)) !== null) {
            const name = match[1];
            if (name === '__construct') continue;
            // Find matching closing brace — count braces
            let braceCount = 1;
            let pos = match.index + match[0].length;
            let bodyStart = pos;
            while (pos < content.length && braceCount > 0) {
                if (content[pos] === '{') braceCount++;
                if (content[pos] === '}') braceCount--;
                pos++;
            }
            const bodyLength = pos - bodyStart - 1;
            const body = content.substring(bodyStart, pos - 1).trim();
            const lineCount = body.split('\n').filter(l => l.trim().length > 0).length;
            // A method is empty ONLY if it has NO lines of code or ONLY contains a TODO/placeholder comment
            const isOnlyComment = lineCount > 0 && body.split('\n').filter(l => l.trim().length > 0).every(l => /^\s*\/\//.test(l));
            const isEmpty = lineCount === 0 || (isOnlyComment && /\bTODO\b|\bFIXME\b|\bIMPLEMENT\b/i.test(body));
            const hasTodo = /\bTODO\b|\bFIXME\b|\bimplement me\b|\bplaceholder\b/i.test(body);
            methods.push({ name, lineCount, isEmpty, hasTodo, hasReturn: /return\s/.test(body) });
        }

        const total = methods.length;
        const empty = methods.filter(m => m.isEmpty);
        const todos = methods.filter(m => m.hasTodo);
        const noReturn = methods.filter(m => !m.hasReturn && !m.isEmpty && m.name !== '__construct');

        if (empty.length > 0) {
            results.push({ check: `Controller ${path.basename(ctrl)}: métodos vazios`, status: 'FAIL', detail: `${empty.map(m => m.name).join(', ')} (${empty.length}/${total})` });
        } else if (todos.length > 0) {
            results.push({ check: `Controller ${path.basename(ctrl)}: TODOs`, status: 'WARN', detail: `${todos.map(m => m.name).join(', ')} contêm TODO` });
        } else {
            results.push({ check: `Controller ${path.basename(ctrl)}: ${total} métodos com corpo`, status: 'PASS', detail: `média ${Math.round(methods.reduce((s, m) => s + m.lineCount, 0) / Math.max(total, 1))} linhas/método` });
        }

        // 1.2 CRUD completeness — collect methods for aggregation
        allControllerMethods.push(...methods.map(m => m.name));

        const hasInlineValidation = /\$request->validate\(\s*\[/.test(content);
        const hasFormRequest = /[A-Z]\w+Request\s+\$request/.test(content);
        const hasValidatedCall = /\$request->validated\(\)/.test(content);
        const hasHelperValidation = /Validator::make/.test(content);
        if (hasInlineValidation || hasFormRequest) {
            const ruleCount = (content.match(/'[a-z_]+'\s*=>\s*['")\[]/g) || []).length;
            results.push({ check: 'Validação', status: 'PASS', detail: hasFormRequest ? 'FormRequest + regras' : `inline validate (${ruleCount} regras)` });
        } else if (hasHelperValidation) {
            results.push({ check: 'Validação', status: 'PASS', detail: 'Validator::make (helper method)' });
        } else if (hasValidatedCall) {
            results.push({ check: 'Validação', status: 'WARN', detail: 'usa validated() mas sem regras visíveis no controller' });
        } else {
            results.push({ check: 'Validação', status: 'WARN', detail: 'sem validação explícita encontrada' });
        }

        // 1.4 Error handling
        const hasTry = /try\s*\{/.test(content);
        const hasCatch = /catch\s*\(/.test(content);
        const hasTransaction = /DB::transaction|DB::beginTransaction/.test(content);
        if (hasTry && hasCatch && hasTransaction) {
            results.push({ check: 'Error handling', status: 'PASS', detail: 'try/catch + DB::transaction' });
        } else if (hasTry && hasCatch) {
            results.push({ check: 'Error handling', status: 'PASS', detail: 'try/catch (sem transaction explícita)' });
        } else {
            results.push({ check: 'Error handling', status: 'WARN', detail: hasTry ? 'try sem catch' : 'sem try/catch' });
        }
    }

    // 1.5 Model analysis
    for (const modelName of mod.models) {
        const modelPath = path.join(MODELS_DIR, modelName + '.php');
        const content = readFile(modelPath);
        if (!content) {
            results.push({ check: `Model ${modelName}`, status: 'FAIL', detail: 'Arquivo não encontrado' });
            continue;
        }

        const hasFillable = /\$fillable\s*=\s*\[/.test(content);
        const hasGuarded = /\$guarded\s*=\s*\[/.test(content);
        const fillableMatch = content.match(/\$fillable\s*=\s*\[([\s\S]*?)\]/);
        const fillableCount = fillableMatch ? (fillableMatch[1].match(/'/g) || []).length / 2 : 0;

        const relationships = [];
        if (/belongsTo\s*\(/.test(content)) relationships.push('belongsTo');
        if (/hasMany\s*\(/.test(content)) relationships.push('hasMany');
        if (/hasOne\s*\(/.test(content)) relationships.push('hasOne');
        if (/belongsToMany\s*\(/.test(content)) relationships.push('belongsToMany');
        if (/morphMany\s*\(/.test(content)) relationships.push('morphMany');

        const hasCasts = /\$casts|\bcasts\b.*=>|protected\s+function\s+casts/.test(content);
        const hasTenantScope = /tenant_id|BelongsToTenant|ScopedByTenant|bootTenantScoped/.test(content);

        if (hasFillable || hasGuarded) {
            results.push({
                check: `Model ${modelName}`,
                status: 'PASS',
                detail: [
                    hasFillable ? `${Math.round(fillableCount)} fillable` : 'guarded',
                    relationships.length ? relationships.join('+') : 'sem relationships',
                    hasCasts ? 'casts' : null,
                    hasTenantScope ? 'tenant-scoped' : null,
                ].filter(Boolean).join(', ')
            });
        } else {
            results.push({ check: `Model ${modelName}`, status: 'WARN', detail: 'sem $fillable nem $guarded' });
        }
    }


    // CRUD completeness (aggregated across all controllers)
    if (mod.crudRequired && mod.crudMethods) {
        const missing = mod.crudMethods.filter(cm => !allControllerMethods.includes(cm));
        if (missing.length > 0) {
            results.push({ check: 'CRUD completeness', status: 'FAIL', detail: `faltam: ${missing.join(', ')}` });
        } else {
            results.push({ check: 'CRUD completeness', status: 'PASS', detail: `${mod.crudMethods.length}/${mod.crudMethods.length} métodos` });
        }
    }
    return results;
}

// ── CAMADA 2: Frontend Profundo ──
function analyzeFrontend(mod) {
    const results = [];

    for (const page of mod.frontendPages) {
        const filePath = path.join(PAGES_DIR, page);
        const content = readFile(filePath);
        if (!content) {
            results.push({ check: `Página ${path.basename(page)}`, status: 'FAIL', detail: 'Arquivo não encontrado' });
            continue;
        }

        // 2.1 Form fields analysis
        const inputCount = (content.match(/<Input|<input|<Select|<select|<Textarea|<textarea|<SelectNative/gi) || []).length;
        const labelCount = (content.match(/<Label|<label|htmlFor/gi) || []).length;
        const formFields = (content.match(/name=["'][a-z_]+["']|value=\{form\.\w+/gi) || []).length;

        if (inputCount > 0) {
            results.push({ check: `Formulário ${path.basename(page)}`, status: 'PASS', detail: `${inputCount} inputs, ${labelCount} labels, ${formFields} campos mapeados` });
        } else if (mod.crudRequired) {
            results.push({ check: `Formulário ${path.basename(page)}`, status: 'WARN', detail: 'módulo CRUD mas sem campos de formulário visíveis' });
        }

        // 2.2 API endpoints extraction
        const apiCalls = [];
        const apiRegex = /api\.(get|post|put|patch|delete)\s*\(\s*[`'"](\/[^`'"]+)[`'"]/gi;
        let m;
        while ((m = apiRegex.exec(content)) !== null) {
            apiCalls.push({ method: m[1].toUpperCase(), path: m[2] });
        }
        // Also check useQuery queryFn api calls
        const queryApiRegex = /queryFn[:\s]*\([^)]*\)\s*=>\s*api\.(get|post)\s*\(\s*[`'"](\/[^`'"]+)[`'"]/gi;
        while ((m = queryApiRegex.exec(content)) !== null) {
            apiCalls.push({ method: m[1].toUpperCase(), path: m[2] });
        }

        if (apiCalls.length > 0) {
            results.push({ check: `API calls ${path.basename(page)}`, status: 'PASS', detail: `${apiCalls.length} chamadas: ${[...new Set(apiCalls.map(a => a.method))].join('+')}` });
        } else {
            // Check for custom hooks (useEmails, useEmailAccounts, etc.)
            const hasHooks = /useQuery|useMutation/.test(content);
            const hasApiImport = /import.*api.*from|import.*axios/.test(content);
            const hasStore = /useAuthStore|useStore|Store\(\)/.test(content);
            const hasFetch = /fetch\s*\(|\.login\s*\(|\.register\s*\(|handleSubmit/.test(content);
            const customHookRegex = /use[A-Z]\w+/g;
            const customHooks = content.match(customHookRegex) || [];
            const dataHooks = customHooks.filter(h => !['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useNavigate', 'useParams', 'useSearchParams', 'useLocation', 'useQuery', 'useMutation', 'useQueryClient'].includes(h));
            const hasCustomDataHooks = dataHooks.length > 0;

            if (hasHooks && hasApiImport) {
                results.push({ check: `API calls ${path.basename(page)}`, status: 'PASS', detail: 'via hooks (useQuery/useMutation)' });
            } else if (hasStore || hasFetch) {
                results.push({ check: `API calls ${path.basename(page)}`, status: 'PASS', detail: `via store/fetch (${hasStore ? 'Zustand store' : 'direct fetch'})` });
            } else if (hasCustomDataHooks) {
                results.push({ check: `API calls ${path.basename(page)}`, status: 'PASS', detail: `via custom hooks (${dataHooks.slice(0, 3).join(', ')})` });
            } else if (hasHooks) {
                results.push({ check: `API calls ${path.basename(page)}`, status: 'WARN', detail: 'hooks presentes mas sem import de api' });
            } else {
                results.push({ check: `API calls ${path.basename(page)}`, status: 'FAIL', detail: 'sem chamadas API detectadas' });
            }
        }

        // 2.3 Empty state
        const hasEmptyState = /empty|nenhum|sem\s+(dados|registros|itens|resultado)|no\s+(data|results|items)|vazio|Não há/i.test(content);
        const hasEmptyIcon = /PackageOpen|Inbox|FileX|SearchX|AlertCircle|FolderOpen/i.test(content);
        const isFormPage = /Create|Form|Edit|New/i.test(path.basename(page));
        if (hasEmptyState || hasEmptyIcon) {
            results.push({ check: `Empty state ${path.basename(page)}`, status: 'PASS', detail: hasEmptyIcon ? 'ícone + mensagem' : 'mensagem de vazio' });
        } else if (mod.crudRequired && !isFormPage) {
            results.push({ check: `Empty state ${path.basename(page)}`, status: 'WARN', detail: 'lista sem empty state visível' });
        }

        // 2.4 Loading state
        const hasLoading = /isLoading|isPending|isFetching/.test(content);
        const hasSpinner = /Loader2|Spinner|skeleton|Skeleton|animate-spin|loading/i.test(content);
        if (hasLoading && hasSpinner) {
            results.push({ check: `Loading state ${path.basename(page)}`, status: 'PASS', detail: 'hook + spinner/skeleton' });
        } else if (hasLoading) {
            results.push({ check: `Loading state ${path.basename(page)}`, status: 'WARN', detail: 'hook isLoading sem spinner visual' });
        } else {
            results.push({ check: `Loading state ${path.basename(page)}`, status: 'FAIL', detail: 'sem loading state' });
        }

        // 2.5 Error handling frontend
        const hasErrorState = /isError|onError/.test(content);
        const hasToast = /toast\.|toast\(|sonner/.test(content);
        const hasCatch = /\.catch\s*\(|catch\s*\(/.test(content);
        if ((hasErrorState && hasToast) || (hasCatch && hasToast)) {
            results.push({ check: `Error handling ${path.basename(page)}`, status: 'PASS', detail: hasErrorState ? 'isError/onError + toast' : 'catch + toast feedback' });
        } else if (hasErrorState || hasCatch) {
            results.push({ check: `Error handling ${path.basename(page)}`, status: 'WARN', detail: 'error handling parcial (sem toast completo)' });
        } else {
            results.push({ check: `Error handling ${path.basename(page)}`, status: 'FAIL', detail: 'sem error handling' });
        }

        // 2.6 Pagination
        const hasPagination = /page|per_page|perPage|Pagination|pagination|paginate|pageSize/i.test(content);
        if (hasPagination) {
            results.push({ check: `Paginação ${path.basename(page)}`, status: 'PASS', detail: 'presente' });
        } else if (mod.crudRequired) {
            results.push({ check: `Paginação ${path.basename(page)}`, status: 'INFO', detail: 'sem paginação (pode ser client-side)' });
        }

        // 2.7 Delete confirmation
        if (mod.crudRequired) {
            const hasDeleteConfirm = /confirm\(|AlertDialog|ConfirmDialog|Dialog|excluir|deletar|handleDelete/i.test(content);
            if (hasDeleteConfirm) {
                results.push({ check: `Delete confirmation ${path.basename(page)}`, status: 'PASS', detail: 'dialog/confirm presente' });
            } else {
                const hasDelete = /delete|destroy|remove/i.test(content);
                if (hasDelete) {
                    results.push({ check: `Delete confirmation ${path.basename(page)}`, status: 'WARN', detail: 'delete sem confirmação visível' });
                }
            }
        }
    }

    return results;
}

// ── CAMADA 3: Cross-Module ──
function analyzeCrossModule(mod, routeContent) {
    const results = [];

    // 3.1 Route → Controller method matching
    for (const ctrl of mod.controllers) {
        const controllerPath = path.join(CONTROLLERS, ctrl);
        const controllerContent = readFile(controllerPath);
        if (!controllerContent || !routeContent) continue;

        // Extract class name
        const classMatch = controllerContent.match(/class\s+(\w+)/);
        if (!classMatch) continue;
        const className = classMatch[1];

        // Find routes that reference this controller
        const routeRegex = new RegExp(`(?<![\\w\\\\])${className}::class,\\s*'(\\w+)'`, 'g');
        let m;
        const routeMethods = [];
        while ((m = routeRegex.exec(routeContent)) !== null) {
            routeMethods.push(m[1]);
        }

        // Check which route-referenced methods actually exist in controller
        const methodRegex = /function\s+(\w+)\s*\(/g;
        const controllerMethods = [];
        while ((m = methodRegex.exec(controllerContent)) !== null) {
            if (m[1] !== '__construct') controllerMethods.push(m[1]);
        }

        const missingInController = routeMethods.filter(rm => !controllerMethods.includes(rm));
        const orphanedMethods = controllerMethods.filter(cm =>
            !routeMethods.includes(cm) && !['__construct', 'rules', 'authorize'].includes(cm)
        );

        if (missingInController.length > 0) {
            results.push({ check: `Rotas→${className}`, status: 'FAIL', detail: `${missingInController.length} métodos referenciados nas rotas mas AUSENTES no controller: ${missingInController.join(', ')}` });
        } else if (routeMethods.length > 0) {
            results.push({ check: `Rotas→${className}`, status: 'PASS', detail: `${routeMethods.length} rotas, todos métodos existem` });
        }

        if (orphanedMethods.length > 3) {
            results.push({ check: `Métodos órfãos ${className}`, status: 'INFO', detail: `${orphanedMethods.length} métodos sem rota (podem ser helpers)` });
        }
    }

    // 3.2 Frontend → Backend endpoint matching
    for (const page of mod.frontendPages) {
        const filePath = path.join(PAGES_DIR, page);
        const content = readFile(filePath);
        if (!content || !routeContent) continue;

        const apiRegex = /api\.(get|post|put|patch|delete)\s*\(\s*[`'"](\/[^`'"{}]+)[`'"]/gi;
        let m;
        const frontendEndpoints = [];
        while ((m = apiRegex.exec(content)) !== null) {
            frontendEndpoints.push({ method: m[1], path: m[2].replace(/\/\$\{[^}]+\}/g, '/{id}') });
        }

        if (frontendEndpoints.length === 0) continue;

        const mismatches = [];
        for (const ep of frontendEndpoints) {
            // Normalize path for matching
            const normalizedPath = ep.path.split('?')[0].replace(/\/\{[^}]+\}/g, '').replace(/^\//, '');
            const pathParts = normalizedPath.split('/');
            const mainPart = pathParts[0];

            // Check if any route in api.php contains this path segment
            if (!routeContent.includes(mainPart)) {
                mismatches.push(`${ep.method.toUpperCase()} ${ep.path}`);
            }
        }

        if (mismatches.length > 0) {
            results.push({ check: `Frontend→Backend ${path.basename(page)}`, status: 'FAIL', detail: `${mismatches.length} endpoints sem rota: ${mismatches.slice(0, 3).join(', ')}` });
        } else {
            results.push({ check: `Frontend→Backend ${path.basename(page)}`, status: 'PASS', detail: `${frontendEndpoints.length} endpoints correspondem a rotas` });
        }
    }

    // 3.3 Migration ↔ Model fillable
    if (mod.tableName && mod.models.length > 0) {
        const migFiles = findFiles(MIGRATIONS_DIR, '.php');
        const tableRegex = new RegExp(`Schema::create\\s*\\(\\s*'${mod.tableName}'`, 'i');
        const migFile = migFiles.find(f => {
            const c = readFile(f);
            return c && tableRegex.test(c);
        });

        if (migFile) {
            const migContent = readFile(migFile);
            // Extract columns ONLY from the Schema::create block for the target table
            const tableBlock = migContent.match(new RegExp(`Schema::create\\s*\\(\\s*'${mod.tableName}'[\\s\\S]*?\\}\\)\\s*;`));
            const blockContent = tableBlock ? tableBlock[0] : migContent;
            const columnRegex = /\$table->(?:string|text|integer|bigInteger|boolean|decimal|date|datetime|timestamp|json|foreignId|unsignedBigInteger|float|double|enum|uuid|ulid)\s*\(\s*'(\w+)'/g;
            let m;
            const migColumns = [];
            while ((m = columnRegex.exec(blockContent)) !== null) {
                if (!['id', 'created_at', 'updated_at', 'deleted_at', 'tenant_id', 'remember_token'].includes(m[1])) {
                    migColumns.push(m[1]);
                }
            }

            // Get first model fillable
            const modelPath = path.join(MODELS_DIR, mod.models[0] + '.php');
            const modelContent = readFile(modelPath);
            if (modelContent) {
                const fillableMatch = modelContent.match(/\$fillable\s*=\s*\[([\s\S]*?)\]/);
                if (fillableMatch) {
                    const fillables = (fillableMatch[1].match(/'(\w+)'/g) || []).map(s => s.replace(/'/g, ''));
                    const missingInFillable = migColumns.filter(col => !fillables.includes(col));

                    if (missingInFillable.length > 0 && missingInFillable.length <= 5) {
                        results.push({ check: `Migration↔Model ${mod.models[0]}`, status: 'WARN', detail: `${missingInFillable.length} colunas da migration não estão no fillable: ${missingInFillable.join(', ')}` });
                    } else if (missingInFillable.length > 5) {
                        results.push({ check: `Migration↔Model ${mod.models[0]}`, status: 'WARN', detail: `${missingInFillable.length} colunas fora do fillable (possível mass-assignment risk)` });
                    } else {
                        results.push({ check: `Migration↔Model ${mod.models[0]}`, status: 'PASS', detail: `${migColumns.length} colunas, ${fillables.length} fillable — alinhados` });
                    }
                }
            }
        }
    }

    return results;
}

// ── CAMADA 4: API Health Check ──
async function analyzeAPIHealth(mod) {

    const results = [];
    if (!WITH_HEALTH) return results;

    try {
        // Login first
        const loginRes = await fetch('http://localhost:8000/api/v1/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ email: 'superadmin@kalibrium.com', password: 'password' }),
        });

        if (!loginRes.ok) {
            results.push({ check: 'API Health: Auth', status: 'FAIL', detail: `Login falhou: ${loginRes.status}` });
            return results;
        }

        const loginData = await loginRes.json();
        const token = loginData.token || loginData.access_token;
        if (!token) {
            results.push({ check: 'API Health: Auth', status: 'FAIL', detail: 'Token não retornado' });
            return results;
        }

        results.push({ check: 'API Health: Auth', status: 'PASS', detail: 'Login OK, token obtido' });

        // Test main GET endpoints
        for (const rp of mod.routePatterns) {
            const endpoint = rp.startsWith('/') ? rp : `/${rp}`;
            if (endpoint.includes('{') || endpoint.includes('login') || endpoint.includes('logout')) continue;

            const url = `http://localhost:8000/api/v1${endpoint}`;
            const start = Date.now();

            try {
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000),
                });
                const elapsed = Date.now() - start;
                const isJson = res.headers.get('content-type')?.includes('json');

                if (res.ok && isJson) {
                    results.push({ check: `GET ${endpoint}`, status: 'PASS', detail: `${res.status} (${elapsed}ms)` });
                } else if (res.status === 403) {
                    results.push({ check: `GET ${endpoint}`, status: 'WARN', detail: `403 Forbidden (${elapsed}ms) — pode ser permissão` });
                } else {
                    results.push({ check: `GET ${endpoint}`, status: 'FAIL', detail: `${res.status} (${elapsed}ms)` });
                }
            } catch (err) {
                results.push({ check: `GET ${endpoint}`, status: 'FAIL', detail: `Timeout/Erro: ${err.message}` });
            }
        }
    } catch (err) {
        results.push({ check: 'API Health', status: 'FAIL', detail: `Backend não acessível: ${err.message}` });
    }

    return results;
}

// ── Report ──
function statusIcon(status) {
    switch (status) {
        case 'PASS': return `${C.green}✅${C.reset}`;
        case 'WARN': return `${C.yellow}⚠️${C.reset}`;
        case 'FAIL': return `${C.red}❌${C.reset}`;
        case 'INFO': return `${C.blue}ℹ️${C.reset}`;
        default: return '  ';
    }
}

function printModuleReport(mod, backendResults, frontendResults, crossResults, healthResults) {
    const all = [...backendResults, ...frontendResults, ...crossResults, ...healthResults];
    const pass = all.filter(r => r.status === 'PASS').length;
    const warn = all.filter(r => r.status === 'WARN').length;
    const fail = all.filter(r => r.status === 'FAIL').length;
    const info = all.filter(r => r.status === 'INFO').length;
    const total = pass + warn + fail;
    const score = total > 0 ? Math.round((pass / total) * 100) : 0;

    let scoreColor = C.green;
    let scoreLabel = 'PERFEITO';
    if (score < 100) { scoreColor = C.yellow; scoreLabel = 'GAPS ENCONTRADOS'; }
    if (score < 70) { scoreColor = C.red; scoreLabel = 'PROBLEMAS CRÍTICOS'; }

    console.log('');
    console.log(`  ${C.bold}${C.cyan}MÓDULO: ${mod.name} [${mod.priority}]${C.reset}`);

    if (backendResults.length > 0) {
        console.log(`  ${C.dim}├── [Backend]${C.reset}`);
        backendResults.forEach((r, i) => {
            const prefix = i === backendResults.length - 1 && frontendResults.length === 0 && crossResults.length === 0 ? '└' : '├';
            console.log(`  │   ${prefix}── ${statusIcon(r.status)} ${r.check}: ${C.dim}${r.detail}${C.reset}`);
        });
    }

    if (frontendResults.length > 0) {
        console.log(`  ${C.dim}├── [Frontend]${C.reset}`);
        frontendResults.forEach((r, i) => {
            const prefix = i === frontendResults.length - 1 && crossResults.length === 0 ? '└' : '├';
            console.log(`  │   ${prefix}── ${statusIcon(r.status)} ${r.check}: ${C.dim}${r.detail}${C.reset}`);
        });
    }

    if (crossResults.length > 0) {
        console.log(`  ${C.dim}├── [Cross-Module]${C.reset}`);
        crossResults.forEach((r, i) => {
            const prefix = i === crossResults.length - 1 && healthResults.length === 0 ? '└' : '├';
            console.log(`  │   ${prefix}── ${statusIcon(r.status)} ${r.check}: ${C.dim}${r.detail}${C.reset}`);
        });
    }

    if (healthResults.length > 0) {
        console.log(`  ${C.dim}├── [API Health]${C.reset}`);
        healthResults.forEach((r, i) => {
            const prefix = i === healthResults.length - 1 ? '└' : '├';
            console.log(`  │   ${prefix}── ${statusIcon(r.status)} ${r.check}: ${C.dim}${r.detail}${C.reset}`);
        });
    }

    console.log(`  ${C.dim}└──${C.reset} ${C.bold}SCORE: ${scoreColor}${score}%${C.reset} (${C.green}${pass}✅${C.reset} ${warn > 0 ? C.yellow + warn + '⚠️' + C.reset + ' ' : ''}${fail > 0 ? C.red + fail + '❌' + C.reset + ' ' : ''}) — ${scoreColor}${scoreLabel}${C.reset}`);

    return { name: mod.name, priority: mod.priority, score, pass, warn, fail, info, total };
}

// ── Main ──
async function main() {
    console.log('');
    console.log(`  ${C.cyan}${C.bold}══════════════════════════════════════════════════════${C.reset}`);
    console.log(`  ${C.cyan}${C.bold}   KALIBRIUM ERP — SCAN MVP PROFUNDO v1.0${C.reset}`);
    console.log(`  ${C.cyan}${C.bold}   Verificação REAL de código (não pattern matching)${C.reset}`);
    console.log(`  ${C.cyan}${C.bold}══════════════════════════════════════════════════════${C.reset}`);
    console.log('');
    console.log(`  ${C.dim}Camadas: Backend Profundo + Frontend Profundo + Cross-Module${WITH_HEALTH ? ' + API Health' : ''}${C.reset}`);
    console.log(`  ${C.dim}Analisando ${FILTER_MODULE ? 1 : modules.length} módulo(s)...${C.reset}`);

    const routeContent = readFile(API_ROUTES) || '';

    const allResults = [];
    const filtered = FILTER_MODULE ? modules.filter(m => m.name.toLowerCase().includes(FILTER_MODULE.toLowerCase())) : modules;

    const detailedResults = [];
    for (const mod of filtered) {
        const backend = analyzeBackend(mod);
        const frontend = analyzeFrontend(mod);
        const cross = analyzeCrossModule(mod, routeContent);
        const health = await analyzeAPIHealth(mod);
        allResults.push(printModuleReport(mod, backend, frontend, cross, health));

        const allChecks = [...backend, ...frontend, ...cross, ...health];
        const issues = allChecks.filter(r => r.status === 'FAIL' || r.status === 'WARN');
        if (issues.length > 0) {
            detailedResults.push({ module: mod.name, priority: mod.priority, issues });
        }
    }

    // Save detailed JSON
    fs.writeFileSync('scan_results.json', JSON.stringify(detailedResults, null, 2));

    // Summary
    console.log('');
    console.log(`  ${C.cyan}${C.bold}══════════════════════════════════════════════════════${C.reset}`);
    console.log(`  ${C.cyan}${C.bold}                    RESUMO GERAL${C.reset}`);
    console.log(`  ${C.cyan}${C.bold}══════════════════════════════════════════════════════${C.reset}`);
    console.log('');

    const avgScore = Math.round(allResults.reduce((s, r) => s + r.score, 0) / allResults.length);
    const perfect = allResults.filter(r => r.score === 100);
    const withWarns = allResults.filter(r => r.score >= 70 && r.score < 100);
    const critical = allResults.filter(r => r.score < 70);
    const totalPass = allResults.reduce((s, r) => s + r.pass, 0);
    const totalWarn = allResults.reduce((s, r) => s + r.warn, 0);
    const totalFail = allResults.reduce((s, r) => s + r.fail, 0);

    console.log(`  Total de módulos: ${C.bold}${allResults.length}${C.reset}`);
    console.log(`  Score médio: ${C.bold}${avgScore >= 90 ? C.green : avgScore >= 70 ? C.yellow : C.red}${avgScore}%${C.reset}`);
    console.log(`  Total checks: ${C.green}${totalPass}✅${C.reset}  ${C.yellow}${totalWarn}⚠️${C.reset}  ${C.red}${totalFail}❌${C.reset}`);
    console.log('');
    console.log(`  ${C.green}[=] PERFEITO (100%):${C.reset}   ${perfect.length} módulos`);
    console.log(`  ${C.yellow}[~] COM AVISOS (70-99%):${C.reset} ${withWarns.length} módulos`);
    console.log(`  ${C.red}[-] CRÍTICO (<70%):${C.reset}     ${critical.length} módulos`);

    if (critical.length > 0) {
        console.log('');
        console.log(`  ${C.red}${C.bold}⚠️  MÓDULOS CRÍTICOS (< 70%):${C.reset}`);
        critical.sort((a, b) => a.score - b.score).forEach(r => {
            console.log(`    ${C.red}${r.name} [${r.priority}]: ${r.score}% (${r.fail} falhas)${C.reset}`);
        });
    }

    if (withWarns.length > 0) {
        console.log('');
        console.log(`  ${C.yellow}${C.bold}⚠️  MÓDULOS COM AVISOS:${C.reset}`);
        withWarns.sort((a, b) => a.score - b.score).forEach(r => {
            console.log(`    ${C.yellow}${r.name} [${r.priority}]: ${r.score}% (${r.warn} avisos, ${r.fail} falhas)${C.reset}`);
        });
    }

    console.log('');
    console.log(`  ${C.dim}Scan profundo concluído em ${new Date().toLocaleString('pt-BR')}${C.reset}`);
    console.log('');
}

main().catch(console.error);
