const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const out = execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

let totalFixed = 0;
const fixedFiles = [];
const allIssues = [];

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');
    const original = c;
    const bn = path.basename(file);

    const hadCRLF = c.includes('\r\n');
    c = c.replace(/\r\n/g, '\n');

    let lines = c.split('\n');
    let modified = false;

    // === FIX 1: Stray comma on its own line (inside mutation objects) ===
    // Pattern: line that is just whitespace + comma
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*,\s*$/.test(lines[i])) {
            const prev = i > 0 ? lines[i - 1].trim() : '';
            const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
            // If prev ends with }, or ) or } and next starts with onSuccess or onError
            if ((prev.endsWith('},') || prev.endsWith('),') || prev.endsWith('}') || prev.endsWith(')')) &&
                (next.startsWith('onSuccess') || next.startsWith('onError') || next.startsWith('}') || next.startsWith(')'))) {
                lines.splice(i, 1);
                modified = true;
                allIssues.push(`  STRAY_COMMA ${bn}:${i + 1}`);
                i--;
            }
        }
    }

    // === FIX 2: toast.success('...') followed by other calls on same line ===
    c = lines.join('\n');
    const toastPattern = /toast\.(success|error|info|warning)\(([^)]+)\)\s+((?:qc|queryClient)\.\w+|set\w+|navigate)\(/g;
    if (toastPattern.test(c)) {
        c = c.replace(/toast\.(success|error|info|warning)\(([^)]+)\)\s+((?:qc|queryClient)\.\w+|set\w+|navigate)\(/g,
            'toast.$1($2)\n                $3(');
        modified = true;
        allIssues.push(`  COLLAPSED_TOAST ${bn}`);
    }

    // === FIX 3: Multiple semicolon-separated statements on one onSuccess line ===
    // Pattern: }); followed by another call on same line  
    c = c.replace(/(\}\s*\)\s*;)\s*((?:qc|queryClient)\.invalidateQueries)/g, '$1\n                $2');

    // === FIX 4: import inside another import block ===
    lines = c.split('\n');
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('import ') && line.includes(' from ')) {
            const prev = lines[i - 1].trim();
            if (prev.startsWith('import {') && !prev.includes('} from')) {
                // This import is inside another import block
                const importLine = lines[i].trim();
                lines.splice(i, 1);
                // Check if already present elsewhere
                if (!lines.some(l => l.trim() === importLine || l.trim() === importLine.replace(/;$/, ''))) {
                    // Add after last import
                    let lastIdx = 0;
                    for (let j = 0; j < lines.length; j++) {
                        if (lines[j].trim().startsWith('import ') && lines[j].trim().includes(' from ')) lastIdx = j;
                    }
                    lines.splice(lastIdx + 1, 0, importLine);
                }
                modified = true;
                allIssues.push(`  IMPORT_INSIDE_IMPORT ${bn}:${i + 1}`);
                i--;
            }
        }
    }

    // === FIX 5: Stray comma in lucide-react imports ===
    c = lines.join('\n');
    if (/,\n\s*,\s*Loader2\s*\}\s*from\s*'lucide-react'/.test(c)) {
        c = c.replace(/,\n\s*,\s*Loader2\s*\}\s*from\s*'lucide-react'/g, ", Loader2 } from 'lucide-react'");
        modified = true;
        allIssues.push(`  STRAY_LUCIDE_COMMA ${bn}`);
    }

    // === FIX 6: searchTerm inside object literal or destructuring ===
    lines = c.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (/const \[searchTerm.*useState\(''\)/.test(lines[i])) {
            const prev = i > 0 ? lines[i - 1].trim() : '';
            const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
            if (/:\s*\{|Record</.test(prev) || /^\w+:/.test(next) ||
                (/useQuery|queryFn/.test(prev)) ||
                (prev.endsWith(',') && !prev.startsWith('const') && !prev.startsWith('let'))) {
                lines.splice(i, 1);
                modified = true;
                allIssues.push(`  SEARCHTERM_MISPLACED ${bn}:${i + 1}`);
                i--;
            }
        }
    }

    // === FIX 7: MVP blocks still remaining ===
    c = lines.join('\n');
    if (/\/\/ MVP: Data fetching/.test(c)) {
        lines = c.split('\n');
        let startIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/\/\/ MVP: Data fetching/.test(lines[i])) {
                startIdx = i;
                let endIdx = -1;
                for (let j = i; j < Math.min(i + 30, lines.length); j++) {
                    if (/const \{ hasPermission \} = useAuthStore/.test(lines[j]) ||
                        /Nenhum registro encontrado/.test(lines[j])) {
                        endIdx = j;
                    }
                }
                if (endIdx < 0) endIdx = Math.min(startIdx + 15, lines.length - 1);

                // Also check for orphan searchTerm after
                if (endIdx + 1 < lines.length && /const \[searchTerm/.test(lines[endIdx + 1])) endIdx++;

                lines.splice(startIdx, endIdx - startIdx + 1);
                c = lines.join('\n');
                modified = true;
                allIssues.push(`  MVP_BLOCK ${bn}:${startIdx + 1}`);
                i = startIdx - 1;
            }
        }
    }

    // === FIX 8: hasPermission used but useAuthStore not imported ===
    c = lines.join('\n');
    if (/hasPermission/.test(c) && !/useAuthStore/.test(c)) {
        // Add useAuthStore import
        const importIdx = c.lastIndexOf("import ");
        if (importIdx >= 0) {
            const insertPos = c.indexOf('\n', c.indexOf('\n', importIdx) + 1);
            c = c.substring(0, insertPos) + "\nimport { useAuthStore } from '@/stores/auth-store'" + c.substring(insertPos);
            modified = true;
            allIssues.push(`  MISSING_AUTH_IMPORT ${bn}`);
        }
    }

    if (modified) {
        c = c.replace(/\n{3,}/g, '\n\n');
        if (hadCRLF) c = c.replace(/\n/g, '\r\n');
        fs.writeFileSync(file, c, 'utf8');
        totalFixed++;
        fixedFiles.push(path.relative('frontend/src/pages', file).replace(/\\/g, '/'));
    }
}

console.log('=== COMPREHENSIVE FIX RESULTS ===');
allIssues.forEach(i => console.log(i));
console.log('\nTotal files fixed:', totalFixed);
console.log('Files:', fixedFiles.join(', '));
