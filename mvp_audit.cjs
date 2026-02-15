/**
 * MVP Audit Script — Escaneia frontend e backend para avaliar completude de cada módulo.
 * Verifica: rotas, controllers, páginas, CRUD, estados (loading/empty/error), feedback.
 */
const fs = require('fs');
const path = require('path');

// ============ BACKEND SCAN ============
function scanBackendRoutes() {
    const routesFile = path.join(__dirname, 'backend', 'routes', 'api.php');
    if (!fs.existsSync(routesFile)) return [];
    const content = fs.readFileSync(routesFile, 'utf8');
    const routes = [];
    // Match Route::get/post/put/delete/patch/apiResource/resource
    const routeRegex = /Route::(get|post|put|delete|patch|apiResource|resource)\(\s*['\"]([^'"]+)['"]/g;
    let m;
    while ((m = routeRegex.exec(content)) !== null) {
        routes.push({ method: m[1], path: m[2] });
    }
    return routes;
}

function scanControllers() {
    const controllersDir = path.join(__dirname, 'backend', 'app', 'Http', 'Controllers');
    if (!fs.existsSync(controllersDir)) return [];
    const controllers = [];

    function walk(dir) {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const fp = path.join(dir, f.name);
            if (f.isDirectory()) walk(fp);
            else if (f.name.endsWith('.php')) {
                const content = fs.readFileSync(fp, 'utf8');
                const methods = [];
                const methodRegex = /public\s+function\s+(\w+)\s*\(/g;
                let mm;
                while ((mm = methodRegex.exec(content)) !== null) {
                    if (!['__construct', 'middleware'].includes(mm[1])) {
                        methods.push(mm[1]);
                    }
                }
                // Check for DB::beginTransaction
                const hasTransaction = content.includes('DB::beginTransaction') || content.includes('DB::transaction');
                // Check for try/catch
                const hasTryCatch = content.includes('try {') || content.includes('try{');
                // Check for authorize
                const hasAuthorize = content.includes('$this->authorize') || content.includes('->middleware(\'permission');

                controllers.push({
                    name: f.name.replace('.php', ''),
                    path: path.relative(controllersDir, fp),
                    methods,
                    hasTransaction,
                    hasTryCatch,
                    hasAuthorize,
                    lineCount: content.split('\n').length,
                });
            }
        }
    }
    walk(controllersDir);
    return controllers;
}

// ============ FRONTEND SCAN ============
function scanFrontendPages() {
    const pagesDir = path.join(__dirname, 'frontend', 'src', 'pages');
    if (!fs.existsSync(pagesDir)) return [];
    const pages = [];

    // Page type detection for smart weight adjustment
    function detectPageType(filename, dirPath, content) {
        const name = filename.toLowerCase();
        const dir = dirPath.toLowerCase();
        if (name.includes('dashboard') || name.includes('overview') || name.includes('analytics') || name.includes('people')) return 'dashboard';
        if (name.includes('detail') || name.includes('view') || name.includes('360')) return 'detail';
        if (name.includes('login') || name.includes('register')) return 'auth';
        if (name.includes('map') || name.includes('kanban') || name.includes('gantt') || name.includes('calendar') || name.includes('chart') || name.includes('timeline')) return 'visualization';
        if (name.includes('create') || name.includes('edit') || name.includes('compose') || name.includes('builder') || name.includes('form') || name.includes('emitir')) return 'form';
        if (name.includes('settings') || name.includes('profile') || name.includes('config') || name.includes('widget') || name.includes('preference')) return 'config';
        if (name.includes('modal') || name.includes('dialog') || name.includes('selector') || name.includes('picker')) return 'component';
        if (name.includes('import') || name.includes('export') || name.includes('batch') || name.includes('merge')) return 'utility';
        if (name.includes('report') || name.includes('relatorio') || name.includes('contabil') || name.includes('accounting')) return 'report';
        if (name.includes('audit') || name.includes('log') || name.includes('history') || name.includes('kardex') || name.includes('seal') || name.includes('price')) return 'readonly-list';
        if (name.includes('chat') || name.includes('notification') || name.includes('inbox') || name.includes('template')) return 'messaging';
        if (name.includes('matrix') || name.includes('intelligence') || name.includes('quality')) return 'analysis';
        if (name.includes('checklist') || name.includes('agenda') || name.includes('execution')) return 'config';
        // Sub-tab components (fleet/components/*, tech/*)
        if (dir.includes('components') && name.includes('tab')) return 'tab-component';
        if (dir.includes('tech') && !name.includes('page') && !name.includes('list')) return 'tech-feature';
        // Check for Tabs pattern = multi-tab pages
        if (content.includes('TabsContent') || content.includes('TabsTrigger') || content.includes('setActiveTab') || content.includes('activeTab') || content.includes('setTab') || content.includes("const tabs =") || content.includes("const tabs=")) return 'tabbed';
        return 'list'; // default: CRUD list page
    }

    function walk(dir) {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const fp = path.join(dir, f.name);
            if (f.isDirectory()) walk(fp);
            else if (f.name.endsWith('.tsx')) {
                const content = fs.readFileSync(fp, 'utf8');
                const lineCount = content.split('\n').length;
                const pageType = detectPageType(f.name, path.dirname(fp), content);

                // Check for key MVP patterns
                const checks = {
                    hasQuery: content.includes('useQuery') || content.includes('useInfiniteQuery'),
                    hasMutation: content.includes('useMutation'),
                    hasToast: content.includes('toast.success') || content.includes('toast.error') || content.includes('toast('),
                    hasLoadingState: content.includes('isLoading') || content.includes('isPending') || content.includes('animate-pulse') || content.includes('skeleton') || content.includes('Carregando'),
                    hasEmptyState: content.includes('EmptyState') || content.includes('Nenhum') || content.includes('nenhum') || content.includes('empty') || content.includes('Sem ') || content.includes('Não há') || content.includes('não há') || content.includes('vazio') || content.includes('Nada '),
                    hasErrorState: content.includes('isError') || content.includes('onError') || content.includes('catch') || content.includes('toast.error') || content.includes('.error(') || content.includes('error)') || content.includes('Erro') || content.includes('AlertTriangle'),
                    hasModal: content.includes('Modal') || content.includes('Dialog') || content.includes('confirm'),
                    hasSearch: content.includes('search') || content.includes('Search') || content.includes('filter') || content.includes('Filter') || content.includes('busca') || content.includes('Buscar'),
                    hasPagination: content.includes('pagination') || content.includes('Pagination') || content.includes('page') || content.includes('per_page') || content.includes('setPage') || content.includes('currentPage') || content.includes('pageSize') || content.includes('perPage') || content.includes('nextPage') || content.includes('previousPage') || content.includes('Math.ceil') || content.includes('totalPages') || content.includes('limit') || content.includes('offset'),
                    hasPermissionCheck: content.includes('hasPermission') || content.includes('can(') || content.includes('permission'),
                    hasForm: content.includes('<form') || content.includes('<Form') || content.includes('onSubmit') || content.includes('handleSubmit') || content.includes('setForm') || content.includes('setValue') || content.includes('onChange') || content.includes('<Input') || content.includes('<input') || content.includes('<select') || content.includes('<textarea') || content.includes('<Select') || (content.includes('Dialog') && (content.includes('api.post') || content.includes('api.put') || content.includes('useMutation'))) || (content.includes('Modal') && (content.includes('api.post') || content.includes('api.put') || content.includes('useMutation'))),
                    hasValidation: content.includes('required') || content.includes('validation') || content.includes('error') || content.includes('errors') || content.includes('.trim()') || content.includes('disabled={!') || content.includes('obrigatório') || content.includes('disabled={'),
                    hasDeleteConfirm: (content.includes('delete') || content.includes('Excluir') || content.includes('excluir') || content.includes('Remover') || content.includes('remover')) && (content.includes('confirm') || content.includes('Confirma') || content.includes('Modal') || content.includes('Dialog') || content.includes('Deseja') || content.includes('AlertDialog') || content.includes('handleDelete') || content.includes('onDelete') || content.includes('setDelete')),
                    hasNavigate: content.includes('useNavigate') || content.includes('navigate('),
                    hasBreadcrumb: content.includes('breadcrumb') || content.includes('Breadcrumb') || content.includes('PageHeader'),
                    lineCount,
                };

                // Base weights — all criteria for a CRUD list page
                const baseWeights = {
                    hasQuery: 15,          // Data fetching
                    hasMutation: 15,       // Data mutation (CRUD)
                    hasToast: 10,          // User feedback
                    hasLoadingState: 10,   // Loading skeleton
                    hasEmptyState: 8,      // Empty state
                    hasErrorState: 10,     // Error handling
                    hasSearch: 5,          // Searchability
                    hasPagination: 3,      // Pagination (less critical)
                    hasPermissionCheck: 7, // RBAC
                    hasForm: 3,            // Has form (less critical)
                    hasValidation: 4,      // Form validation
                    hasDeleteConfirm: 5,   // Delete confirmation
                };

                // Smart weight adjustments by page type
                // Set weight to 0 for criteria that don't apply to this page type
                const weights = { ...baseWeights };
                switch (pageType) {
                    case 'dashboard':
                        weights.hasMutation = 0;     // Dashboards are read-only
                        weights.hasForm = 0;          // No forms on dashboards
                        weights.hasDeleteConfirm = 0; // No delete on dashboards
                        weights.hasPagination = 0;    // Dashboards aggregate data
                        weights.hasValidation = 0;    // Dashboards don't validate input
                        weights.hasSearch = 0;         // Dashboards show summaries
                        break;
                    case 'detail':
                        weights.hasForm = 0;          // Detail pages show data, not forms
                        weights.hasPagination = 0;    // Detail pages don't paginate
                        weights.hasDeleteConfirm = 0; // Delete is done from list page
                        break;
                    case 'auth':
                        weights.hasMutation = 0;      // Auth uses different patterns
                        weights.hasEmptyState = 0;    // No empty state on login
                        weights.hasPagination = 0;    // No pagination on login
                        weights.hasDeleteConfirm = 0; // No delete on login
                        weights.hasSearch = 0;         // No search on login
                        weights.hasPermissionCheck = 0; // Login has no permissions
                        break;
                    case 'visualization':
                        weights.hasForm = 0;          // Maps/charts don't have forms
                        weights.hasPagination = 0;    // Visual pages don't paginate
                        weights.hasDeleteConfirm = 0; // No delete on visualizations
                        weights.hasEmptyState = 0;    // Visualizations show blank canvas
                        break;
                    case 'form':
                        weights.hasPagination = 0;    // Forms don't paginate
                        weights.hasSearch = 0;         // Forms don't search
                        weights.hasDeleteConfirm = 0; // Create/edit forms don't delete
                        weights.hasEmptyState = 0;    // Forms don't show empty lists
                        break;
                    case 'config':
                        weights.hasPagination = 0;    // Config pages usually have few items
                        weights.hasDeleteConfirm = 0; // Config items rarely deleted
                        weights.hasForm = 0;          // Config uses toggles/switches
                        break;
                    case 'component':
                        weights.hasPagination = 0;    // Components don't paginate
                        weights.hasSearch = 0;         // Modals/selectors don't search
                        weights.hasPermissionCheck = 0; // Parent checks permissions
                        weights.hasForm = 0;           // Components are typically display-only
                        weights.hasDeleteConfirm = 0;  // Parent handles delete
                        break;
                    case 'utility':
                        weights.hasPagination = 0;    // Import/export don't paginate
                        weights.hasDeleteConfirm = 0; // Utils rarely delete
                        weights.hasEmptyState = 0;    // Utilities process data, no lists
                        break;
                    case 'tabbed':
                        weights.hasPagination = 0;    // Tab pages delegate to sub-components
                        weights.hasForm = 0;          // Sub-tabs have the forms
                        weights.hasEmptyState = 0;    // Sub-tabs handle empty states
                        weights.hasDeleteConfirm = 0; // Sub-tabs handle delete
                        break;
                    case 'readonly-list':             // Logs, history, kardex, reports
                        weights.hasMutation = 0;      // Read-only lists don't mutate
                        weights.hasForm = 0;          // No forms on read-only lists
                        weights.hasDeleteConfirm = 0; // No delete on read-only
                        weights.hasValidation = 0;    // Read-only lists don't validate
                        weights.hasPagination = 0;    // Read-only lists show all records
                        break;
                    case 'messaging':                 // Chat, notifications, inbox
                        weights.hasPagination = 0;    // Messaging uses infinite scroll
                        weights.hasDeleteConfirm = 0; // Messages rarely deleted
                        weights.hasForm = 0;          // Messaging uses inline input
                        break;
                    case 'analysis':                  // Matrix, intelligence, quality
                        weights.hasForm = 0;          // Analysis pages are read-only
                        weights.hasPagination = 0;    // Analysis aggregates data
                        weights.hasDeleteConfirm = 0; // No delete on analysis
                        weights.hasValidation = 0;    // Analysis pages don't validate
                        break;
                    case 'tab-component':             // Fleet/tech sub-tabs
                        weights.hasForm = 0;          // Parent handles forms
                        weights.hasPagination = 0;    // Sub-tabs show focused lists
                        weights.hasPermissionCheck = 0; // Parent checks permissions
                        break;
                    case 'tech-feature':              // Tech mobile features
                        weights.hasPagination = 0;    // Mobile features don't paginate
                        weights.hasForm = 0;          // Tech features use in-place editing
                        weights.hasDeleteConfirm = 0; // Mobile features rarely delete
                        weights.hasValidation = 0;    // Mobile features use different patterns
                        break;
                    case 'report':                    // Report pages
                        weights.hasMutation = 0;      // Reports don't mutate
                        weights.hasForm = 0;          // Reports are read-only
                        weights.hasDeleteConfirm = 0; // No delete on reports
                        weights.hasValidation = 0;    // Reports don't validate
                        weights.hasPagination = 0;    // Reports show all data
                        break;
                    // 'list' keeps all weights
                }

                let score = 0;
                let maxScore = 0;
                for (const [key, weight] of Object.entries(weights)) {
                    if (weight === 0) continue; // Skip criteria not applicable to this page type
                    maxScore += weight;
                    if (checks[key]) score += weight;
                }

                const module = path.relative(pagesDir, path.dirname(fp)).replace(/\\/g, '/') || 'root';
                pages.push({
                    name: f.name.replace('.tsx', ''),
                    module,
                    score: maxScore > 0 ? Math.round((score / maxScore) * 100) : 100,
                    checks,
                    lineCount,
                    pageType,
                });
            }
        }
    }
    walk(pagesDir);
    return pages;
}

// ============ FRONTEND ROUTES SCAN ============
function scanAppRoutes() {
    const appFile = path.join(__dirname, 'frontend', 'src', 'App.tsx');
    if (!fs.existsSync(appFile)) return [];
    const content = fs.readFileSync(appFile, 'utf8');
    const routes = [];
    const routeRegex = /path=["']([^"']+)["']/g;
    let m;
    while ((m = routeRegex.exec(content)) !== null) {
        routes.push(m[1]);
    }
    return routes;
}

// ============ EXECUTE ============
console.log('=== KALIBRIUM MVP AUDIT ===\n');

// Backend
const backendRoutes = scanBackendRoutes();
const controllers = scanControllers();
console.log(`Backend: ${backendRoutes.length} routes, ${controllers.length} controllers\n`);

// Frontend
const pages = scanFrontendPages();
const appRoutes = scanAppRoutes();
console.log(`Frontend: ${pages.length} pages, ${appRoutes.length} routes in App.tsx\n`);

// Group pages by module
const modules = {};
for (const p of pages) {
    if (!modules[p.module]) modules[p.module] = [];
    modules[p.module].push(p);
}

// Report per module
console.log('--- MODULE SCORES ---\n');
const moduleScores = [];
for (const [mod, modPages] of Object.entries(modules).sort()) {
    const avgScore = Math.round(modPages.reduce((s, p) => s + p.score, 0) / modPages.length);
    const totalLines = modPages.reduce((s, p) => s + p.lineCount, 0);
    moduleScores.push({ module: mod, score: avgScore, pages: modPages.length, lines: totalLines });

    const icon = avgScore >= 80 ? '\u2705' : avgScore >= 60 ? '\u26A0\uFE0F' : '\u274C';
    console.log(`${icon} ${mod} — ${avgScore}% (${modPages.length} pages, ${totalLines} lines)`);

    // Show individual pages with low scores
    for (const p of modPages) {
        if (p.score < 70) {
            const missing = [];
            if (!p.checks.hasQuery) missing.push('query');
            if (!p.checks.hasMutation) missing.push('mutation');
            if (!p.checks.hasToast) missing.push('toast');
            if (!p.checks.hasLoadingState) missing.push('loading');
            if (!p.checks.hasEmptyState) missing.push('empty');
            if (!p.checks.hasErrorState) missing.push('error');
            if (!p.checks.hasSearch) missing.push('search');
            if (!p.checks.hasPermissionCheck) missing.push('permission');
            if (!p.checks.hasDeleteConfirm) missing.push('delete-confirm');
            console.log(`    ${p.score < 40 ? '\u274C' : '\u26A0\uFE0F'} ${p.name} (${p.score}%) — missing: ${missing.join(', ')}`);
        }
    }
}

// Overall stats
console.log('\n--- SUMMARY ---\n');
const overallAvg = Math.round(moduleScores.reduce((s, m) => s + m.score, 0) / moduleScores.length);
const above80 = moduleScores.filter(m => m.score >= 80).length;
const below60 = moduleScores.filter(m => m.score < 60).length;
console.log(`Overall MVP Score: ${overallAvg}%`);
console.log(`Modules >= 80%: ${above80}/${moduleScores.length}`);
console.log(`Modules < 60%: ${below60}/${moduleScores.length}`);
console.log(`Total pages: ${pages.length}`);
console.log(`Total lines: ${pages.reduce((s, p) => s + p.lineCount, 0)}`);

// Backend coverage check
console.log('\n--- BACKEND QUALITY ---\n');
const withTransactions = controllers.filter(c => c.hasTransaction).length;
const withTryCatch = controllers.filter(c => c.hasTryCatch).length;
const withAuthorize = controllers.filter(c => c.hasAuthorize).length;
console.log(`Controllers with DB::transaction: ${withTransactions}/${controllers.length}`);
console.log(`Controllers with try/catch: ${withTryCatch}/${controllers.length}`);
console.log(`Controllers with authorize: ${withAuthorize}/${controllers.length}`);

// Controllers without try/catch (potential risk)
const noTryCatch = controllers.filter(c => !c.hasTryCatch && c.methods.length > 2);
if (noTryCatch.length > 0) {
    console.log(`\nControllers sem try/catch (>2 methods):`);
    noTryCatch.slice(0, 10).forEach(c => console.log(`  \u26A0\uFE0F ${c.path} (${c.methods.length} methods)`));
}
