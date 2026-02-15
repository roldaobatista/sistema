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

let modified = 0;
let skipped = 0;

for (const t of targets) {
    const fp = path.join(basePath, t);
    if (!fs.existsSync(fp)) { console.log('MISSING: ' + t); continue; }
    let content = fs.readFileSync(fp, 'utf8');

    // Skip if already has pagination
    if (content.includes('per_page') || content.includes('Pagination')) {
        console.log('SKIP (already has pagination): ' + t);
        skipped++;
        continue;
    }

    let changed = false;

    // 1. Add page state: find first useState and add page state after it
    if (!content.includes('page, setPage') && !content.includes('page,setPage')) {
        // Find the first useState line
        const stateMatch = content.match(/const \[(\w+), set\w+\] = useState/);
        if (stateMatch) {
            const idx = content.indexOf(stateMatch[0]);
            const lineEnd = content.indexOf('\n', idx);
            const insertAfter = content.substring(0, lineEnd + 1);
            const rest = content.substring(lineEnd + 1);
            content = insertAfter + '    const [page, setPage] = useState(1)\n' + rest;
            changed = true;
        }
    }

    // 2. Add per_page to the first useQuery GET call
    // Pattern: api.get('/something') or api.get<Type>('/something')
    const getPatterns = [
        /api\.get(<[^>]+>)?\(['"]([^'"]+)['"]\)/,
        /api\.get(<[^>]+>)?\(['"]([^'"]+)['"],\s*\)/,
    ];

    for (const pat of getPatterns) {
        const match = content.match(pat);
        if (match) {
            const original = match[0];
            const typeParam = match[1] || '';
            const endpoint = match[2];
            // Only modify if it doesn't already have params
            if (!original.includes('params')) {
                const replacement = `api.get${typeParam}('${endpoint}', { params: { per_page: 50, page } })`;
                content = content.replace(original, replacement);
                changed = true;
                break;
            }
        }
    }

    // 3. Add page to queryKey if not already there
    const queryKeyMatch = content.match(/queryKey:\s*\[([^\]]+)\]/);
    if (queryKeyMatch && !queryKeyMatch[1].includes('page')) {
        const original = queryKeyMatch[0];
        const keys = queryKeyMatch[1];
        const replacement = `queryKey: [${keys}, page]`;
        content = content.replace(original, replacement);
        changed = true;
    }

    // 4. Add simple pagination UI before the last closing div
    // Find the return statement and add pagination after the main content
    if (!content.includes('Página') && !content.includes('pagination')) {
        // Add a simple text-based pagination indicator near the end
        const lastClosingDiv = content.lastIndexOf('</div>');
        if (lastClosingDiv > -1) {
            // Find the second-to-last closing div (usually end of main content)  
            const secondLastDiv = content.lastIndexOf('</div>', lastClosingDiv - 1);
            if (secondLastDiv > -1) {
                const paginationUI = `
            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-subtle pt-4 mt-4">
                <span className="text-sm text-muted-foreground">Página {page}</span>
                <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded border border-subtle text-sm disabled:opacity-40">Anterior</button>
                    <button onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-subtle text-sm">Próxima</button>
                </div>
            </div>
`;
                content = content.substring(0, secondLastDiv) + paginationUI + content.substring(secondLastDiv);
                changed = true;
            }
        }
    }

    if (changed) {
        fs.writeFileSync(fp, content, 'utf8');
        console.log('MODIFIED: ' + t);
        modified++;
    } else {
        console.log('NO CHANGES: ' + t);
        skipped++;
    }
}

console.log('\n---');
console.log('Modified: ' + modified);
console.log('Skipped: ' + skipped);
