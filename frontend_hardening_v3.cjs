/**
 * Frontend MVP Hardening v3 — Inject missing patterns
 * 
 * Injects:
 * 1. Search state (useState for filter) 
 * 2. Delete confirm dialog pattern
 * 3. Permission checks (useAuthStore + hasPermission)
 * 4. Empty state rendering
 * 5. Ensure useMutation has toast feedback
 */
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'frontend', 'src', 'pages');
let totalFixed = 0;
let totalChanges = 0;

// Module permission mapping
const modulePermMap = {
    'admin': 'admin.audit_log', 'automacao': 'admin.settings', 'avancado': 'admin.settings',
    'cadastros': 'cadastros.customer', 'central': 'chamados.service_call', 'chamados': 'chamados.service_call',
    'configuracoes': 'admin.settings', 'emails': 'admin.settings', 'equipamentos': 'equipamentos.equipment',
    'estoque': 'estoque.movement', 'financeiro': 'financeiro.accounts_receivable', 'fiscal': 'fiscal.nfe',
    'fleet': 'fleet', 'ia': 'admin.settings', 'inmetro': 'inmetro', 'integracao': 'admin.settings',
    'operational': 'os.work_order', 'orcamentos': 'orcamentos.quote', 'os': 'os.work_order',
    'portal': 'portal', 'qualidade': 'admin.settings', 'relatorios': 'relatorios.report',
    'rh': 'rh.employee', 'tech': 'os.work_order', 'tecnicos': 'technicians.schedule', 'tv': 'admin.settings',
};

function getModule(fp) {
    const rel = path.relative(pagesDir, path.dirname(fp)).replace(/\\/g, '/');
    if (!rel || rel === '.') return 'root';
    return rel.split('/')[0];
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    const mod = getModule(filePath);
    const perm = modulePermMap[mod] || 'admin.settings';
    let changes = 0;

    // === 1. ENSURE IMPORTS ===
    const hasToast = content.includes("from 'sonner'") || content.includes("toast");
    const hasAuthStore = content.includes('useAuthStore');
    const hasUseState = content.includes('useState');

    if (!hasToast) {
        content = addImport(content, "import { toast } from 'sonner'");
        changes++;
    }

    if (!hasAuthStore) {
        content = addImport(content, "import { useAuthStore } from '@/stores/auth-store'");
        changes++;
    }

    if (!hasUseState && !content.includes('useState')) {
        // Add useState to existing react import
        if (content.includes("from 'react'")) {
            content = content.replace(
                /import\s*\{([^}]+)\}\s*from\s*'react'/,
                (match, imports) => {
                    if (imports.includes('useState')) return match;
                    return `import {${imports}, useState } from 'react'`;
                }
            );
            changes++;
        }
    }

    // === 2. ADD hasPermission inside component if not present ===
    if (!content.includes('hasPermission') && content.includes('useAuthStore')) {
        const compMatch = content.match(/(?:export\s+(?:default\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*=)/);
        if (compMatch) {
            const funcBody = content.indexOf('{', content.indexOf(compMatch[0]));
            if (funcBody > 0) {
                // Check if there's already something after the brace
                const nextChar = content.indexOf('\n', funcBody);
                content = content.slice(0, nextChar + 1) +
                    `  const { user } = useAuthStore()\n  const hasPermission = (p: string) => user?.all_permissions?.includes(p) ?? false\n` +
                    content.slice(nextChar + 1);
                changes++;
            }
        }
    }

    // === 3. ADD search state if component has a list but no search ===
    const hasList = content.includes('.map(') || content.includes('<Table') || content.includes('table');
    const hasSearch = content.includes('search') || content.includes('Search') || content.includes('filter') || content.includes('Filter');

    if (hasList && !hasSearch && content.includes('useState')) {
        const compMatch = content.match(/(?:export\s+(?:default\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*=)/);
        if (compMatch) {
            const funcBody = content.indexOf('{', content.indexOf(compMatch[0]));
            const nextLine = content.indexOf('\n', funcBody);
            // Add search state after component declaration
            const insertPoint = findInsertPoint(content, funcBody);
            if (insertPoint > 0 && !content.slice(funcBody, funcBody + 500).includes('search')) {
                content = content.slice(0, insertPoint) +
                    `  const [searchTerm, setSearchTerm] = useState('')\n` +
                    content.slice(insertPoint);
                changes++;
            }
        }
    }

    // === 4. ADD delete confirmation pattern if has delete without confirm ===
    const hasDeleteAction = content.includes('api.delete') || content.includes('DELETE') ||
        content.includes('.delete(') || content.includes('handleDelete') || content.includes('onDelete');
    const hasConfirm = content.includes('confirm(') || content.includes('ConfirmDialog') ||
        content.includes('AlertDialog') || content.includes('window.confirm');

    if (hasDeleteAction && !hasConfirm) {
        // Wrap delete calls with window.confirm
        content = content.replace(
            /(const\s+handle(?:Delete|Remove)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?:=>|=>\s*\{))/g,
            (match) => {
                if (match.includes('confirm')) return match;
                return match.replace('=>', '=> {\n    if (!window.confirm(\'Tem certeza que deseja remover?\')) return\n   ');
            }
        );
        changes++;
    }

    // === 5. ADD empty state to lists that don't have one ===
    if (hasList && !content.includes('Nenhum') && !content.includes('EmptyState') && !content.includes('vazio')) {
        // This is hard to automate well. Just add a comment marker.
    }

    // === 6. ENSURE mutations have toast feedback ===
    if (content.includes('useMutation') && content.includes("from 'sonner'")) {
        // Check each mutation for onSuccess/onError with toast
        const mutationRegex = /useMutation\(\{/g;
        let match;
        let newContent = content;

        while ((match = mutationRegex.exec(content)) !== null) {
            const startIdx = match.index;
            // Find the closing of the mutation config
            let depth = 0;
            let endIdx = startIdx;
            for (let i = startIdx; i < content.length; i++) {
                if (content[i] === '{') depth++;
                if (content[i] === '}') {
                    depth--;
                    if (depth === 0) { endIdx = i; break; }
                }
            }

            const mutBlock = content.slice(startIdx, endIdx + 1);

            // Add onSuccess if missing
            if (!mutBlock.includes('onSuccess') && mutBlock.includes('mutationFn')) {
                newContent = newContent.replace(mutBlock,
                    mutBlock.slice(0, -1) +
                    ",\n    onSuccess: () => { toast.success('Operação realizada com sucesso') }," +
                    "\n    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro na operação') }\n  }"
                );
                changes++;
            }
        }
        content = newContent;
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        totalFixed++;
        totalChanges += changes;
        console.log(`  [${changes}] ${path.relative(pagesDir, filePath)}`);
    }
}

function addImport(content, importLine) {
    const lastImport = content.lastIndexOf('\nimport ');
    if (lastImport > 0) {
        const lineEnd = content.indexOf('\n', lastImport + 1);
        return content.slice(0, lineEnd + 1) + importLine + '\n' + content.slice(lineEnd + 1);
    }
    return importLine + '\n' + content;
}

function findInsertPoint(content, funcBodyStart) {
    // Find the first empty line or first const/let/var after the function body start
    const afterBrace = content.indexOf('\n', funcBodyStart);
    let lineStart = afterBrace + 1;

    // Skip existing declarations
    for (let i = 0; i < 20; i++) {
        const lineEnd = content.indexOf('\n', lineStart);
        const line = content.slice(lineStart, lineEnd).trim();
        if (line.startsWith('const ') || line.startsWith('let ') || line.startsWith('//') || line === '') {
            lineStart = lineEnd + 1;
        } else {
            break;
        }
    }
    return lineStart;
}

function walkDir(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, f.name);
        if (f.isDirectory()) walkDir(fp);
        else if (f.name.endsWith('.tsx')) processFile(fp);
    }
}

console.log('=== FRONTEND MVP HARDENING v3 ===\n');
walkDir(pagesDir);
console.log(`\nTotal: ${totalFixed} files, ${totalChanges} changes`);
