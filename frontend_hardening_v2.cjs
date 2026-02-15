/**
 * Frontend MVP Hardening v2 — Advanced patterns
 * 
 * Foca nos padrões mais difíceis de automatizar:
 * 1. Empty states (quando lista vazia)
 * 2. Delete confirm pattern
 * 3. Search/filter
 * 4. Mutation toast feedback
 * 5. Permission check nos botões
 */
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'frontend', 'src', 'pages');
let totalFixed = 0;
let totalChanges = 0;
const report = [];

function processPage(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.tsx');
    const rel = path.relative(pagesDir, filePath).replace(/\\/g, '/');
    let changes = 0;
    const fixes = [];

    // === 1. TOAST IMPORT — Garantir que toast está disponível ===
    const needsToast = !content.includes("from 'sonner'") && !content.includes('from "sonner"') &&
        !content.includes("from '@/hooks/useToast'");
    if (needsToast && (content.includes('useMutation') || content.includes('onSubmit') || content.includes('handleDelete'))) {
        const lastImport = content.lastIndexOf('\nimport ');
        if (lastImport > 0) {
            const lineEnd = content.indexOf('\n', lastImport + 1);
            content = content.slice(0, lineEnd + 1) + "import { toast } from 'sonner'\n" + content.slice(lineEnd + 1);
            changes++;
            fixes.push('toast-import');
        }
    }

    // === 2. TOAST FEEDBACK em onSuccess/onError que não têm ===
    if (content.includes('onSuccess') && !content.includes('toast.success') && content.includes("from 'sonner'")) {
        // Add toast.success inside onSuccess callbacks
        content = content.replace(
            /onSuccess:\s*\(\)\s*=>\s*\{/g,
            "onSuccess: () => {\n        toast.success('Operação realizada com sucesso')"
        );
        if (content !== fs.readFileSync(filePath, 'utf8')) {
            changes++;
            fixes.push('toast-success');
        }
    }

    if (content.includes('onError') && !content.includes('toast.error') && content.includes("from 'sonner'")) {
        content = content.replace(
            /onError:\s*\((?:err|error|e)\)\s*=>\s*\{/g,
            "onError: (error: any) => {\n        toast.error(error?.response?.data?.message || 'Erro na operação')"
        );
        if (content !== fs.readFileSync(filePath, 'utf8')) {
            changes++;
            fixes.push('toast-error');
        }
    }

    // === 3. EMPTY STATE — Adicionar verificação de lista vazia ===
    // Look for patterns like: data?.map or data.map without empty check
    if (content.includes('.map(') && !content.includes('length === 0') && !content.includes('Nenhum') && !content.includes('EmptyState') && !content.includes('empty')) {
        // Find the component's return statement and add empty check comment
        // This is too complex to automate reliably - just add the helper util
        if (!content.includes('Nenhum registro') && content.includes('table') || content.includes('Table')) {
            // Has a table but no empty message - add a comment marker for manual fix
            fixes.push('NEEDS: empty-state');
        }
    }

    // === 4. DELETE CONFIRM — Check for delete without confirmation ===
    const hasDelete = content.includes('delete') || content.includes('Delete') || content.includes('destroy') || content.includes('remove');
    const hasConfirm = content.includes('confirm(') || content.includes('Confirm') || content.includes('AlertDialog') || content.includes('ConfirmDialog');
    if (hasDelete && !hasConfirm && (content.includes('useMutation') || content.includes('api.delete'))) {
        fixes.push('NEEDS: delete-confirm');
    }

    // === 5. SEARCH — Check for list pages without search ===
    const hasList = content.includes('.map(') || content.includes('Table') || content.includes('table');
    const hasSearch = content.includes('search') || content.includes('Search') || content.includes('filter') || content.includes('Filter') || content.includes('useState');
    if (hasList && !hasSearch) {
        fixes.push('NEEDS: search');
    }

    // === 6. PERMISSION — Add hasPermission check ===
    if (!content.includes('hasPermission') && !content.includes('useAuthStore') &&
        (content.includes('Button') || content.includes('onClick'))) {
        // Already handled by v1 script, but let's ensure
        fixes.push('NEEDS: permission-check');
    }

    // === 7. LOADING SKELETON — Add isLoading check ===
    if (content.includes('useQuery') && !content.includes('isLoading') && !content.includes('isPending') &&
        !content.includes('Skeleton') && !content.includes('skeleton') && !content.includes('animate-pulse') &&
        !content.includes('Carregando') && !content.includes('spinner')) {
        fixes.push('NEEDS: loading-state');
    }

    if (changes > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        totalFixed++;
        totalChanges += changes;
    }

    if (fixes.length > 0) {
        report.push({ file: rel, fixes, changes });
    }

    return changes;
}

function walkDir(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, f.name);
        if (f.isDirectory()) walkDir(fp);
        else if (f.name.endsWith('.tsx')) {
            processPage(fp);
        }
    }
}

console.log('=== FRONTEND MVP HARDENING v2 ===\n');
walkDir(pagesDir);

console.log(`\nAuto-fixed: ${totalFixed} files, ${totalChanges} changes`);
console.log('\n--- REMAINING MANUAL GAPS ---\n');

const needsWork = report.filter(r => r.fixes.some(f => f.startsWith('NEEDS:')));
const grouped = {};
needsWork.forEach(r => {
    r.fixes.filter(f => f.startsWith('NEEDS:')).forEach(f => {
        const pattern = f.replace('NEEDS: ', '');
        if (!grouped[pattern]) grouped[pattern] = [];
        grouped[pattern].push(r.file);
    });
});

Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).forEach(([pattern, files]) => {
    console.log(`${pattern} (${files.length} pages):`);
    files.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    if (files.length > 10) console.log(`  ... +${files.length - 10} more`);
    console.log();
});
