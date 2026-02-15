const fs = require('fs');
const path = require('path');

const basePath = 'frontend/src/pages';

const targets = [
    'financeiro/AccountPayableCategoriesPage.tsx',
    'financeiro/BankAccountsPage.tsx',
    'financeiro/ChartOfAccountsPage.tsx',
    'financeiro/CommissionsPage.tsx',
    'financeiro/PaymentMethodsPage.tsx',
    'financeiro/ReconciliationRulesPage.tsx',
    'financeiro/CashFlowPage.tsx',
    'configuracoes/BranchesPage.tsx',
    'configuracoes/TenantManagementPage.tsx',
    'emails/EmailSettingsPage.tsx',
    'iam/RolesPage.tsx',
    'importacao/ImportPage.tsx',
];

for (const t of targets) {
    const fp = path.join(basePath, t);
    if (!fs.existsSync(fp)) { console.log('MISSING: ' + t); continue; }
    const content = fs.readFileSync(fp, 'utf8');
    const hasPagination = content.includes('per_page') || content.includes('Pagination');
    const hasPageState = content.includes('page, setPage') || content.includes('page,setPage');
    console.log(t.padEnd(55) + ' per_page=' + String(hasPagination).padEnd(6) + ' page_state=' + String(hasPageState).padEnd(6));
}
