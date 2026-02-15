/**
 * MVP CHECK REAL — Verificação de código real do KALIBRIUM ERP
 * Analisa controllers PHP e páginas TSX para classificar cada módulo.
 * 
 * Uso: node mvp_check_real.cjs
 */

const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, 'backend');
const FRONTEND = path.join(__dirname, 'frontend', 'src');
const PAGES_DIR = path.join(FRONTEND, 'pages');

// ═══════════════════════════════════════════════════════════
// DEFINIÇÃO DOS MÓDULOS (extraído do App.tsx real)
// ═══════════════════════════════════════════════════════════
const MODULES = [
    // --- CORE ---
    { name: 'Dashboard', frontendPages: ['DashboardPage.tsx'], apiPrefix: 'dashboard-stats', category: 'Core' },

    // --- IAM ---
    { name: 'Usuários', frontendPages: ['iam/UsersPage.tsx'], apiPrefix: 'users', category: 'IAM' },
    { name: 'Perfis (Roles)', frontendPages: ['iam/RolesPage.tsx'], apiPrefix: 'roles', category: 'IAM' },
    { name: 'Permissões', frontendPages: ['iam/PermissionsMatrixPage.tsx'], apiPrefix: 'permissions', category: 'IAM' },
    { name: 'Audit Log', frontendPages: ['admin/AuditLogPage.tsx'], apiPrefix: 'audit-logs', category: 'IAM' },

    // --- CADASTROS ---
    { name: 'Clientes', frontendPages: ['cadastros/CustomersPage.tsx', 'cadastros/Customer360Page.tsx', 'cadastros/CustomerMergePage.tsx'], apiPrefix: 'customers', category: 'Cadastros' },
    { name: 'Produtos', frontendPages: ['cadastros/ProductsPage.tsx'], apiPrefix: 'products', category: 'Cadastros' },
    { name: 'Serviços', frontendPages: ['cadastros/ServicesPage.tsx'], apiPrefix: 'services', category: 'Cadastros' },
    { name: 'Fornecedores', frontendPages: ['cadastros/SuppliersPage.tsx'], apiPrefix: 'suppliers', category: 'Cadastros' },
    { name: 'Histórico Preços', frontendPages: ['cadastros/PriceHistoryPage.tsx'], apiPrefix: 'price-history', category: 'Cadastros' },
    { name: 'Exportação Lote', frontendPages: ['cadastros/BatchExportPage.tsx'], apiPrefix: 'batch-export', category: 'Cadastros' },

    // --- ORÇAMENTOS ---
    { name: 'Orçamentos', frontendPages: ['orcamentos/QuotesListPage.tsx', 'orcamentos/QuoteCreatePage.tsx', 'orcamentos/QuoteDetailPage.tsx', 'orcamentos/QuoteEditPage.tsx'], apiPrefix: 'quotes', category: 'Comercial' },

    // --- CHAMADOS ---
    { name: 'Chamados', frontendPages: ['chamados/ServiceCallsPage.tsx', 'chamados/ServiceCallCreatePage.tsx', 'chamados/ServiceCallDetailPage.tsx', 'chamados/ServiceCallEditPage.tsx', 'chamados/ServiceCallMapPage.tsx', 'chamados/TechnicianAgendaPage.tsx'], apiPrefix: 'service-calls', category: 'Operacional' },

    // --- OS ---
    { name: 'Ordens de Serviço', frontendPages: ['os/WorkOrdersListPage.tsx', 'os/WorkOrderCreatePage.tsx', 'os/WorkOrderDetailPage.tsx', 'os/WorkOrderKanbanPage.tsx'], apiPrefix: 'work-orders', category: 'Operacional' },
    { name: 'Contratos Recorrentes', frontendPages: ['os/RecurringContractsPage.tsx'], apiPrefix: 'recurring-contracts', category: 'Operacional' },
    { name: 'SLA', frontendPages: ['os/SlaPoliciesPage.tsx', 'os/SlaDashboardPage.tsx'], apiPrefix: 'sla', category: 'Operacional' },
    { name: 'Checklists', frontendPages: ['operational/checklists/ChecklistPage.tsx'], apiPrefix: 'checklists', category: 'Operacional' },

    // --- TÉCNICOS ---
    { name: 'Agenda Técnicos', frontendPages: ['tecnicos/SchedulesPage.tsx'], apiPrefix: 'schedules', category: 'Técnicos' },
    { name: 'Apontamentos', frontendPages: ['tecnicos/TimeEntriesPage.tsx'], apiPrefix: 'time-entries', category: 'Técnicos' },
    { name: 'Caixa Técnico', frontendPages: ['tecnicos/TechnicianCashPage.tsx'], apiPrefix: 'technician-cash', category: 'Técnicos' },

    // --- FINANCEIRO ---
    { name: 'Contas a Receber', frontendPages: ['financeiro/AccountsReceivablePage.tsx'], apiPrefix: 'accounts-receivable', category: 'Financeiro' },
    { name: 'Contas a Pagar', frontendPages: ['financeiro/AccountsPayablePage.tsx'], apiPrefix: 'accounts-payable', category: 'Financeiro' },
    { name: 'Comissões', frontendPages: ['financeiro/CommissionsPage.tsx', 'financeiro/CommissionDashboardPage.tsx'], apiPrefix: 'commission', category: 'Financeiro' },
    { name: 'Despesas', frontendPages: ['financeiro/ExpensesPage.tsx'], apiPrefix: 'expenses', category: 'Financeiro' },
    { name: 'Abastecimento', frontendPages: ['financeiro/FuelingLogsPage.tsx'], apiPrefix: 'fueling-logs', category: 'Financeiro' },
    { name: 'Pagamentos', frontendPages: ['financeiro/PaymentsPage.tsx'], apiPrefix: 'payments', category: 'Financeiro' },
    { name: 'Formas Pagamento', frontendPages: ['financeiro/PaymentMethodsPage.tsx'], apiPrefix: 'payment-methods', category: 'Financeiro' },
    { name: 'Fluxo de Caixa', frontendPages: ['financeiro/CashFlowPage.tsx'], apiPrefix: 'cash-flow', category: 'Financeiro' },
    { name: 'Faturamento', frontendPages: ['financeiro/InvoicesPage.tsx'], apiPrefix: 'invoices', category: 'Financeiro' },
    { name: 'Conciliação Bancária', frontendPages: ['financeiro/BankReconciliationPage.tsx', 'financeiro/ReconciliationRulesPage.tsx', 'financeiro/ReconciliationDashboardPage.tsx'], apiPrefix: 'bank-reconciliation', category: 'Financeiro' },
    { name: 'Plano de Contas', frontendPages: ['financeiro/ChartOfAccountsPage.tsx'], apiPrefix: 'chart-of-accounts', category: 'Financeiro' },
    { name: 'Cat. Contas Pagar', frontendPages: ['financeiro/AccountPayableCategoriesPage.tsx'], apiPrefix: 'account-payable-categories', category: 'Financeiro' },
    { name: 'Contas Bancárias', frontendPages: ['financeiro/BankAccountsPage.tsx'], apiPrefix: 'bank-accounts', category: 'Financeiro' },
    { name: 'Transf. Técnicos', frontendPages: ['financeiro/FundTransfersPage.tsx'], apiPrefix: 'fund-transfers', category: 'Financeiro' },

    // --- FISCAL ---
    { name: 'Notas Fiscais', frontendPages: ['fiscal/FiscalNotesPage.tsx'], apiPrefix: 'fiscal', category: 'Fiscal' },

    // --- ESTOQUE ---
    { name: 'Estoque Dashboard', frontendPages: ['estoque/StockDashboardPage.tsx'], apiPrefix: 'stock/summary', category: 'Estoque' },
    { name: 'Movimentações', frontendPages: ['estoque/StockMovementsPage.tsx'], apiPrefix: 'stock/movements', category: 'Estoque' },
    { name: 'Armazéns', frontendPages: ['estoque/WarehousesPage.tsx'], apiPrefix: 'warehouses', category: 'Estoque' },
    { name: 'Inventários', frontendPages: ['estoque/InventoryListPage.tsx', 'estoque/InventoryCreatePage.tsx', 'estoque/InventoryExecutionPage.tsx'], apiPrefix: 'inventories', category: 'Estoque' },
    { name: 'Lotes', frontendPages: ['estoque/BatchManagementPage.tsx'], apiPrefix: 'batches', category: 'Estoque' },
    { name: 'Kardex', frontendPages: ['estoque/KardexPage.tsx'], apiPrefix: 'kardex', category: 'Estoque' },
    { name: 'Intel. Estoque', frontendPages: ['estoque/StockIntelligencePage.tsx'], apiPrefix: 'stock/intelligence', category: 'Estoque' },
    { name: 'Integ. Estoque', frontendPages: ['estoque/StockIntegrationPage.tsx'], apiPrefix: 'purchase-quotes', category: 'Estoque' },

    // --- EQUIPAMENTOS ---
    { name: 'Equipamentos', frontendPages: ['equipamentos/EquipmentListPage.tsx', 'equipamentos/EquipmentDetailPage.tsx', 'equipamentos/EquipmentCreatePage.tsx'], apiPrefix: 'equipment', category: 'Equipamentos' },
    { name: 'Calendário Calibrações', frontendPages: ['equipamentos/EquipmentCalendarPage.tsx'], apiPrefix: 'equipment', category: 'Equipamentos' },
    { name: 'Pesos Padrão', frontendPages: ['equipamentos/StandardWeightsPage.tsx'], apiPrefix: 'standard-weights', category: 'Equipamentos' },

    // --- INMETRO ---
    { name: 'INMETRO Dashboard', frontendPages: ['inmetro/InmetroDashboardPage.tsx'], apiPrefix: 'inmetro/dashboard', category: 'INMETRO' },
    { name: 'INMETRO Leads', frontendPages: ['inmetro/InmetroLeadsPage.tsx'], apiPrefix: 'inmetro/leads', category: 'INMETRO' },
    { name: 'INMETRO Instrumentos', frontendPages: ['inmetro/InmetroInstrumentsPage.tsx'], apiPrefix: 'inmetro/instruments', category: 'INMETRO' },
    { name: 'INMETRO Importação', frontendPages: ['inmetro/InmetroImportPage.tsx'], apiPrefix: 'inmetro/import', category: 'INMETRO' },
    { name: 'INMETRO Concorrentes', frontendPages: ['inmetro/InmetroCompetitorPage.tsx'], apiPrefix: 'inmetro/competitors', category: 'INMETRO' },
    { name: 'INMETRO Mapa', frontendPages: ['inmetro/InmetroMapPage.tsx'], apiPrefix: 'inmetro/map', category: 'INMETRO' },
    { name: 'INMETRO Selos', frontendPages: ['inmetro/InmetroSealManagement.tsx', 'inmetro/InmetroSealReportPage.tsx'], apiPrefix: 'inmetro/seal', category: 'INMETRO' },

    // --- CRM ---
    { name: 'CRM Dashboard', frontendPages: ['CrmDashboardPage.tsx'], apiPrefix: 'crm/dashboard', category: 'CRM' },
    { name: 'CRM Pipeline', frontendPages: ['CrmPipelinePage.tsx'], apiPrefix: 'crm', category: 'CRM' },
    { name: 'Templates Mensagem', frontendPages: ['MessageTemplatesPage.tsx'], apiPrefix: 'message-templates', category: 'CRM' },

    // --- CENTRAL ---
    { name: 'Central (Inbox)', frontendPages: ['central/CentralPage.tsx', 'central/CentralDashboardPage.tsx', 'central/CentralRulesPage.tsx'], apiPrefix: 'central', category: 'Operacional' },

    // --- RELATÓRIOS ---
    { name: 'Relatórios', frontendPages: ['relatorios/ReportsPage.tsx'], apiPrefix: 'reports/', category: 'Relatórios' },

    // --- CONFIGURAÇÕES ---
    { name: 'Configurações', frontendPages: ['configuracoes/SettingsPage.tsx'], apiPrefix: 'settings', category: 'Config' },
    { name: 'Filiais', frontendPages: ['configuracoes/BranchesPage.tsx'], apiPrefix: 'branches', category: 'Config' },
    { name: 'Empresas (Tenants)', frontendPages: ['configuracoes/TenantManagementPage.tsx'], apiPrefix: 'tenants', category: 'Config' },

    // --- IMPORTAÇÃO ---
    { name: 'Importação', frontendPages: ['importacao/ImportPage.tsx'], apiPrefix: 'import/', category: 'Integração' },
    { name: 'Auvo Integração', frontendPages: ['integracao/AuvoImportPage.tsx'], apiPrefix: 'auvo/', category: 'Integração' },

    // --- EMAILS ---
    { name: 'Emails', frontendPages: ['emails/EmailInboxPage.tsx', 'emails/EmailComposePage.tsx', 'emails/EmailSettingsPage.tsx'], apiPrefix: 'email', category: 'Comunicação' },

    // --- NOTIFICAÇÕES ---
    { name: 'Notificações', frontendPages: ['notificacoes/NotificationsPage.tsx'], apiPrefix: 'notifications', category: 'Comunicação' },

    // --- FROTA ---
    { name: 'Frota', frontendPages: ['fleet/FleetPage.tsx'], apiPrefix: 'fleet/', category: 'Operacional' },

    // --- RH ---
    { name: 'RH Principal', frontendPages: ['rh/HRPage.tsx'], apiPrefix: 'hr/', category: 'RH' },
    { name: 'Ponto', frontendPages: ['rh/ClockInPage.tsx'], apiPrefix: 'clock', category: 'RH' },
    { name: 'Férias', frontendPages: ['rh/LeavesPage.tsx', 'rh/VacationBalancePage.tsx'], apiPrefix: 'leaves', category: 'RH' },
    { name: 'Desempenho', frontendPages: ['rh/PerformancePage.tsx'], apiPrefix: 'performance', category: 'RH' },
    { name: 'Recrutamento', frontendPages: ['rh/RecruitmentPage.tsx', 'rh/RecruitmentKanbanPage.tsx'], apiPrefix: 'job-postings', category: 'RH' },
    { name: 'Skills', frontendPages: ['rh/SkillsMatrixPage.tsx'], apiPrefix: 'skills', category: 'RH' },

    // --- QUALIDADE ---
    { name: 'Qualidade', frontendPages: ['qualidade/QualityPage.tsx'], apiPrefix: 'quality', category: 'Qualidade' },

    // --- AUTOMAÇÃO ---
    { name: 'Automação', frontendPages: ['automacao/AutomationPage.tsx'], apiPrefix: 'automation', category: 'IA/Automação' },

    // --- IA ---
    { name: 'IA & Analytics', frontendPages: ['ia/AIAnalyticsPage.tsx'], apiPrefix: 'ai/', category: 'IA/Automação' },

    // --- PORTAL CLIENTE ---
    { name: 'Portal Cliente', frontendPages: ['portal/PortalDashboardPage.tsx', 'portal/PortalWorkOrdersPage.tsx', 'portal/PortalQuotesPage.tsx', 'portal/PortalFinancialsPage.tsx'], apiPrefix: 'portal/', category: 'Portal' },

    // --- TECH (Mobile) ---
    { name: 'App Técnico (PWA)', frontendPages: ['tech/TechWorkOrdersPage.tsx', 'tech/TechWorkOrderDetailPage.tsx', 'tech/TechChecklistPage.tsx', 'tech/TechExpensePage.tsx'], apiPrefix: 'tech/', category: 'Mobile' },
];

// ═══════════════════════════════════════════════════════════
// FUNÇÕES DE ANÁLISE
// ═══════════════════════════════════════════════════════════

function readFileSafe(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
}

// Verifica se a página frontend existe e analisa seu conteúdo
function analyzeFrontendPage(relativePath) {
    const fullPath = path.join(PAGES_DIR, relativePath);
    const content = readFileSafe(fullPath);
    if (!content) return { exists: false };

    const lines = content.split('\n').length;

    return {
        exists: true,
        lines,
        hasApiCall: /api\.(get|post|put|delete|patch)\s*\(|useQuery|useMutation|axios\.|fetch\(/.test(content),
        hasForm: /<form|<Form|<Dialog|handleSubmit|onSubmit|useMutation/.test(content),
        hasToast: /toast\.|toast\(|sonner|addToast|showToast/.test(content),
        hasLoading: /isLoading|isPending|loading|Carregando|Skeleton|spinner|animate-spin/.test(content),
        hasEmptyState: /Nenhum|nenhum|empty|vazio|Sem registros|Sem dados|No data|no results|lista vazia/.test(content),
        hasErrorHandling: /onError|catch\s*\(|error\.|Error|403|500|try\s*{/.test(content),
        hasTable: /<Table|<table|DataTable|<thead|columns/.test(content),
        hasDeleteConfirm: /confirm|AlertDialog|Deseja realmente|Tem certeza|excluir|Excluir/.test(content),
        hasPagination: /pagination|setPage|currentPage|pageSize|per_page|hasNextPage/.test(content),
        hasSearch: /search|filtro|filter|buscar|pesquisar|setSearch|searchTerm/.test(content),
    };
}

// Verifica se o endpoint existe no api.php  
function checkApiRoutes(apiContent, prefix) {
    const prefixNorm = prefix.replace(/\//g, '[\\/\\-]?');
    const regex = new RegExp(`['"]${prefixNorm}`, 'gi');
    const matches = apiContent.match(regex) || [];

    const hasGet = new RegExp(`(get|apiResource).*['"].*${prefixNorm}`, 'gi').test(apiContent);
    const hasPost = new RegExp(`(post|apiResource).*['"].*${prefixNorm}`, 'gi').test(apiContent);
    const hasPut = new RegExp(`(put|apiResource).*['"].*${prefixNorm}`, 'gi').test(apiContent);
    const hasDelete = new RegExp(`(delete|apiResource).*['"].*${prefixNorm}`, 'gi').test(apiContent);

    return {
        routeCount: matches.length,
        hasGet,
        hasPost,
        hasPut,
        hasDelete,
        hasCRUD: hasGet && hasPost,
        hasFullCRUD: hasGet && hasPost && hasPut && hasDelete,
    };
}

// Pontuação e classificação
function scoreModule(frontendResults, apiResult) {
    let score = 0;
    let maxScore = 0;
    const details = [];

    // Frontend existe? (20 pontos)
    maxScore += 20;
    const mainPage = frontendResults[0];
    if (mainPage && mainPage.exists) {
        score += 20;
        details.push('✅ Página frontend existe');
    } else {
        details.push('❌ Página frontend NÃO ENCONTRADA');
    }

    // Frontend chama API? (15 pontos)
    maxScore += 15;
    if (mainPage && mainPage.hasApiCall) {
        score += 15;
        details.push('✅ Frontend chama API');
    } else if (mainPage && mainPage.exists) {
        details.push('❌ Frontend NÃO chama API (possível página estática)');
    }

    // Backend tem rotas? (15 pontos)
    maxScore += 15;
    if (apiResult.routeCount > 0) {
        score += 15;
        details.push(`✅ Backend tem ${apiResult.routeCount} rotas registradas`);
    } else {
        details.push('❌ Backend NÃO tem rotas registradas');
    }

    // Backend tem CRUD? (10 pontos)
    maxScore += 10;
    if (apiResult.hasFullCRUD) {
        score += 10;
        details.push('✅ CRUD completo (GET+POST+PUT+DELETE)');
    } else if (apiResult.hasCRUD) {
        score += 5;
        details.push('🟡 CRUD parcial (sem PUT ou DELETE)');
    } else if (apiResult.hasGet) {
        score += 2;
        details.push('🟡 Apenas leitura (GET)');
    }

    // Formulário? (10 pontos)
    maxScore += 10;
    if (mainPage && mainPage.hasForm) {
        score += 10;
        details.push('✅ Tem formulário');
    } else if (mainPage && mainPage.exists) {
        details.push('⚠️ Sem formulário detectado');
    }

    // Toast/feedback? (5 pontos)
    maxScore += 5;
    if (mainPage && mainPage.hasToast) {
        score += 5;
        details.push('✅ Tem feedback (toast)');
    } else if (mainPage && mainPage.exists) {
        details.push('⚠️ Sem toast/feedback');
    }

    // Loading state? (5 pontos)
    maxScore += 5;
    if (mainPage && mainPage.hasLoading) {
        score += 5;
        details.push('✅ Tem loading state');
    } else if (mainPage && mainPage.exists) {
        details.push('⚠️ Sem loading state');
    }

    // Empty state? (5 pontos)
    maxScore += 5;
    if (mainPage && mainPage.hasEmptyState) {
        score += 5;
        details.push('✅ Tem empty state');
    } else if (mainPage && mainPage.exists) {
        details.push('⚠️ Sem empty state');
    }

    // Error handling? (5 pontos)
    maxScore += 5;
    if (mainPage && mainPage.hasErrorHandling) {
        score += 5;
        details.push('✅ Tem error handling');
    } else if (mainPage && mainPage.exists) {
        details.push('⚠️ Sem error handling');
    }

    // Delete confirm? (5 pontos)
    maxScore += 5;
    if (mainPage && mainPage.hasDeleteConfirm) {
        score += 5;
        details.push('✅ Tem confirmação de exclusão');
    } else if (mainPage && mainPage.exists && apiResult.hasDelete) {
        details.push('⚠️ Tem DELETE mas sem confirmação no frontend');
    }

    // Tabela/lista? (5 pontos)
    maxScore += 5;
    if (mainPage && mainPage.hasTable) {
        score += 5;
        details.push('✅ Tem tabela/lista');
    } else if (mainPage && mainPage.exists) {
        details.push('⚠️ Sem tabela detectada');
    }

    const pct = Math.round((score / maxScore) * 100);
    let status;
    if (pct >= 80) status = '🟢 COMPLETO';
    else if (pct >= 50) status = '🟡 PARCIAL';
    else if (pct >= 20) status = '🟠 BÁSICO';
    else status = '🔴 VAZIO/QUEBRADO';

    return { score, maxScore, pct, status, details };
}

// ═══════════════════════════════════════════════════════════
// EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   KALIBRIUM ERP — Verificação MVP Real (Código Real)   ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

const apiContent = readFileSafe(path.join(BACKEND, 'routes', 'api.php')) || '';
if (!apiContent) {
    console.error('❌ ERRO: Não foi possível ler api.php');
    process.exit(1);
}

const results = [];
let totalScore = 0;
let totalMax = 0;

for (const mod of MODULES) {
    const frontendResults = mod.frontendPages.map(p => analyzeFrontendPage(p));
    const apiResult = checkApiRoutes(apiContent, mod.apiPrefix);
    const eval_ = scoreModule(frontendResults, apiResult);

    totalScore += eval_.score;
    totalMax += eval_.maxScore;

    const mainPage = frontendResults[0];
    results.push({
        ...mod,
        frontendExists: mainPage?.exists || false,
        frontendLines: mainPage?.lines || 0,
        apiRouteCount: apiResult.routeCount,
        ...eval_,
    });
}

// Ordenar por categoria e depois por score (menor primeiro)
results.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.pct - b.pct;
});

// ═══════════════════════════════════════════════════════════
// RELATÓRIO
// ═══════════════════════════════════════════════════════════

const reportLines = [];
reportLines.push('# KALIBRIUM ERP — Relatório MVP Real');
reportLines.push(`> Gerado em: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`);
reportLines.push(`> Analisados: ${MODULES.length} módulos`);
reportLines.push('');

// --- RESUMO GERAL ---
const completo = results.filter(r => r.pct >= 80).length;
const parcial = results.filter(r => r.pct >= 50 && r.pct < 80).length;
const basico = results.filter(r => r.pct >= 20 && r.pct < 50).length;
const vazio = results.filter(r => r.pct < 20).length;
const globalPct = Math.round((totalScore / totalMax) * 100);

reportLines.push('## RESUMO GERAL');
reportLines.push('');
reportLines.push(`| Status | Quantidade |`);
reportLines.push(`|--------|------------|`);
reportLines.push(`| 🟢 COMPLETO (≥80%) | ${completo} |`);
reportLines.push(`| 🟡 PARCIAL (50-79%) | ${parcial} |`);
reportLines.push(`| 🟠 BÁSICO (20-49%) | ${basico} |`);
reportLines.push(`| 🔴 VAZIO (<20%) | ${vazio} |`);
reportLines.push(`| **TOTAL** | **${MODULES.length}** |`);
reportLines.push('');
reportLines.push(`**Score Global: ${globalPct}%** (${totalScore}/${totalMax})`);
reportLines.push('');

// --- POR CATEGORIA ---
const categories = [...new Set(results.map(r => r.category))].sort();

for (const cat of categories) {
    const modsByCat = results.filter(r => r.category === cat);
    reportLines.push(`## ${cat}`);
    reportLines.push('');
    reportLines.push(`| Módulo | Status | Score | Frontend | Linhas | Rotas API | Obs |`);
    reportLines.push(`|--------|--------|-------|----------|--------|-----------|-----|`);

    for (const m of modsByCat) {
        const feExists = m.frontendExists ? '✅' : '❌';
        const obs = [];
        const mainPage = m.frontendPages.map(p => analyzeFrontendPage(p))[0];
        if (mainPage && mainPage.exists && !mainPage.hasApiCall) obs.push('sem API');
        if (mainPage && mainPage.exists && !mainPage.hasToast) obs.push('sem toast');
        if (mainPage && mainPage.exists && !mainPage.hasLoading) obs.push('sem loading');
        if (mainPage && mainPage.exists && !mainPage.hasEmptyState) obs.push('sem empty');
        if (mainPage && mainPage.exists && !mainPage.hasErrorHandling) obs.push('sem error');
        if (m.apiRouteCount === 0) obs.push('0 rotas');

        reportLines.push(`| ${m.name} | ${m.status} | ${m.pct}% | ${feExists} | ${m.frontendLines} | ${m.apiRouteCount} | ${obs.join(', ') || '—'} |`);
    }
    reportLines.push('');
}

// --- DETALHES DOS MÓDULOS PROBLEMÁTICOS ---
const problematic = results.filter(r => r.pct < 80);
if (problematic.length > 0) {
    reportLines.push('## DETALHES DOS MÓDULOS ABAIXO DE 80%');
    reportLines.push('');

    for (const m of problematic) {
        reportLines.push(`### ${m.status} ${m.name} (${m.pct}%)`);
        for (const d of m.details) {
            reportLines.push(`- ${d}`);
        }
        reportLines.push('');
    }
}

// --- CONSOLE OUTPUT ---
console.log(`\n📊 RESUMO: ${completo} completos | ${parcial} parciais | ${basico} básicos | ${vazio} vazios`);
console.log(`📈 Score Global: ${globalPct}% (${totalScore}/${totalMax})\n`);

// Tabela resumida no console
console.log('┌────────────────────────────────┬──────────────────┬───────┬──────────┬───────┐');
console.log('│ Módulo                         │ Status           │ Score │ Frontend │ Rotas │');
console.log('├────────────────────────────────┼──────────────────┼───────┼──────────┼───────┤');

for (const m of results) {
    const name = m.name.padEnd(30);
    const status = m.status.padEnd(16);
    const score = `${m.pct}%`.padStart(5);
    const fe = (m.frontendExists ? '✅' : '❌') + ` ${m.frontendLines}L`.padStart(6);
    const routes = String(m.apiRouteCount).padStart(5);
    console.log(`│ ${name} │ ${status} │ ${score} │ ${fe} │ ${routes} │`);
}

console.log('└────────────────────────────────┴──────────────────┴───────┴──────────┴───────┘');

// Salvar relatório
const reportFile = path.join(__dirname, 'mvp_real_status.md');
fs.writeFileSync(reportFile, reportLines.join('\n'), 'utf-8');
console.log(`\n✅ Relatório salvo em: ${reportFile}`);
