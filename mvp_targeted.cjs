const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'frontend', 'src', 'pages');

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
    if (dir.includes('components') && name.includes('tab')) return 'tab-component';
    if (dir.includes('tech') && !name.includes('page') && !name.includes('list')) return 'tech-feature';
    if (content.includes('TabsContent') || content.includes('TabsTrigger') || content.includes('setActiveTab') || content.includes('activeTab')) return 'tabbed';
    return 'list';
}

// Only scan specific modules
const targetModules = ['fleet', 'integracao', 'fiscal'];
const results = [];

for (const mod of targetModules) {
    const modDir = path.join(pagesDir, mod);
    if (!fs.existsSync(modDir)) { console.log(`Module ${mod} not found`); continue; }

    function walk(dir) {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const fp = path.join(dir, f.name);
            if (f.isDirectory()) walk(fp);
            else if (f.name.endsWith('.tsx')) {
                const content = fs.readFileSync(fp, 'utf8');
                const lineCount = content.split('\n').length;
                const rel = path.relative(pagesDir, fp).replace(/\\/g, '/');
                const pageType = detectPageType(f.name, path.dirname(fp), content);

                const checks = {
                    hasQuery: content.includes('useQuery') || content.includes('useInfiniteQuery'),
                    hasMutation: content.includes('useMutation'),
                    hasToast: content.includes('toast.success') || content.includes('toast.error') || content.includes('toast('),
                    hasLoadingState: content.includes('isLoading') || content.includes('isPending') || content.includes('animate-pulse') || content.includes('skeleton') || content.includes('Carregando'),
                    hasEmptyState: content.includes('EmptyState') || content.includes('Nenhum') || content.includes('nenhum') || content.includes('empty') || content.includes('Sem ') || content.includes('Não há') || content.includes('não há') || content.includes('vazio') || content.includes('Nada '),
                    hasErrorState: content.includes('isError') || content.includes('onError') || content.includes('catch') || content.includes('toast.error') || content.includes('.error(') || content.includes('error)') || content.includes('Erro') || content.includes('AlertTriangle'),
                    hasSearch: content.includes('search') || content.includes('Search') || content.includes('filter') || content.includes('Filter') || content.includes('busca') || content.includes('Buscar'),
                    hasPagination: content.includes('pagination') || content.includes('Pagination') || content.includes('page') || content.includes('per_page') || content.includes('setPage') || content.includes('currentPage'),
                    hasPermissionCheck: content.includes('hasPermission') || content.includes('can(') || content.includes('permission'),
                    hasForm: content.includes('<form') || content.includes('<Form') || content.includes('onSubmit') || content.includes('handleSubmit') || content.includes('setForm') || content.includes('setValue') || content.includes('onChange') || content.includes('<Input') || content.includes('<input') || content.includes('<select') || content.includes('<textarea') || content.includes('<Select') || (content.includes('Dialog') && (content.includes('api.post') || content.includes('api.put') || content.includes('useMutation'))) || (content.includes('Modal') && (content.includes('api.post') || content.includes('api.put') || content.includes('useMutation'))),
                    hasValidation: content.includes('required') || content.includes('validation') || content.includes('error') || content.includes('errors') || content.includes('.trim()') || content.includes('disabled={!') || content.includes('obrigatório') || content.includes('disabled={'),
                    hasDeleteConfirm: content.includes('delete') && (content.includes('confirm') || content.includes('Modal') || content.includes('Dialog') || content.includes('Deseja')),
                };

                const baseWeights = {
                    hasQuery: 15, hasMutation: 15, hasToast: 10, hasLoadingState: 10,
                    hasEmptyState: 8, hasErrorState: 10, hasSearch: 5, hasPagination: 3,
                    hasPermissionCheck: 7, hasForm: 3, hasValidation: 4, hasDeleteConfirm: 5,
                };
                const weights = { ...baseWeights };
                switch (pageType) {
                    case 'dashboard': weights.hasMutation = 0; weights.hasForm = 0; weights.hasDeleteConfirm = 0; weights.hasPagination = 0; weights.hasValidation = 0; weights.hasSearch = 0; break;
                    case 'detail': weights.hasForm = 0; weights.hasPagination = 0; break;
                    case 'form': weights.hasPagination = 0; weights.hasSearch = 0; weights.hasDeleteConfirm = 0; break;
                    case 'config': weights.hasPagination = 0; weights.hasDeleteConfirm = 0; break;
                    case 'component': weights.hasPagination = 0; weights.hasSearch = 0; weights.hasPermissionCheck = 0; weights.hasForm = 0; weights.hasDeleteConfirm = 0; break;
                    case 'utility': weights.hasPagination = 0; weights.hasDeleteConfirm = 0; break;
                    case 'readonly-list': weights.hasMutation = 0; weights.hasForm = 0; weights.hasDeleteConfirm = 0; weights.hasValidation = 0; break;
                    case 'report': weights.hasMutation = 0; weights.hasForm = 0; weights.hasDeleteConfirm = 0; weights.hasValidation = 0; break;
                    case 'messaging': weights.hasPagination = 0; weights.hasDeleteConfirm = 0; break;
                    case 'analysis': weights.hasForm = 0; weights.hasPagination = 0; weights.hasDeleteConfirm = 0; weights.hasValidation = 0; break;
                    case 'tabbed': weights.hasPagination = 0; weights.hasForm = 0; break;
                    case 'tab-component': weights.hasForm = 0; weights.hasPagination = 0; weights.hasPermissionCheck = 0; break;
                    case 'tech-feature': weights.hasPagination = 0; weights.hasForm = 0; weights.hasDeleteConfirm = 0; weights.hasValidation = 0; break;
                    case 'visualization': weights.hasForm = 0; weights.hasPagination = 0; weights.hasDeleteConfirm = 0; break;
                    case 'auth': weights.hasMutation = 0; weights.hasEmptyState = 0; weights.hasPagination = 0; weights.hasDeleteConfirm = 0; weights.hasSearch = 0; weights.hasPermissionCheck = 0; break;
                }

                let score = 0, maxScore = 0;
                const missing = [];
                const present = [];
                for (const [key, weight] of Object.entries(weights)) {
                    if (weight === 0) continue;
                    maxScore += weight;
                    if (checks[key]) { score += weight; present.push(key.replace('has', '')); }
                    else missing.push(`${key.replace('has', '')}(${weight}pt)`);
                }
                const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;
                results.push({ rel, pct, pageType, missing, present, lostPts: maxScore - score, lineCount });
            }
        }
    }
    walk(modDir);
}

results.sort((a, b) => a.pct - b.pct);
for (const r of results) {
    console.log(`\n${r.pct}% [${r.pageType}] ${r.rel} (${r.lineCount} lines)`);
    console.log(`  ✅ Has: ${r.present.join(', ')}`);
    if (r.missing.length) console.log(`  ❌ Missing: ${r.missing.join(', ')}`);
}
