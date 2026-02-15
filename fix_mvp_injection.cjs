const fs = require('fs');
const path = require('path');

const out = require('child_process').execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

let totalFixed = 0;
const fixedFiles = [];

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');
    const original = c;

    // Normalize to LF for consistent processing
    const hadCRLF = c.includes('\r\n');
    c = c.replace(/\r\n/g, '\n');

    // === FIX 1: Stray comma in lucide-react import ===
    // Pattern: previous line ends with "Download," and this line starts with ", Loader2"
    // Fix: merge into "Download, Loader2"
    c = c.replace(/,\n\s*,\s*Loader2\s*\}\s*from\s*'lucide-react'/g, ', Loader2 } from \'lucide-react\'');

    // === FIX 2: Remove MVP_BLOCK (lines between "// MVP: Data fetching" and the loading/empty check) ===
    // This is a multi-line block that needs careful removal
    const mvpStartPattern = /\n\s*\/\/ MVP: Data fetching\n/;
    if (mvpStartPattern.test(c)) {
        const lines = c.split('\n');
        let startIdx = -1;
        let endIdx = -1;

        for (let i = 0; i < lines.length; i++) {
            if (/\/\/ MVP: Data fetching/.test(lines[i])) {
                startIdx = i;
            }
            // The MVP block ends after the empty state check (line with "Nenhum registro encontrado")
            if (startIdx >= 0 && endIdx < 0 && /Nenhum registro encontrado/.test(lines[i])) {
                endIdx = i;
            }
        }

        if (startIdx >= 0 && endIdx >= 0) {
            // Also remove the orphan "const { hasPermission } = useAuthStore()" that comes right after
            if (endIdx + 1 < lines.length && /const \{.*hasPermission.*\} = useAuthStore/.test(lines[endIdx + 1])) {
                endIdx++;
            }
            // Remove the block
            lines.splice(startIdx, endIdx - startIdx + 1);
            c = lines.join('\n');
        }
    }

    // === FIX 3: Remove SEARCHTERM_MISPLACED ===
    // These are "const [searchTerm, setSearchTerm] = useState('')" lines that appear inside
    // useQuery objects, useState callbacks, or after file references
    const searchTermLines = c.split('\n');
    const linesToRemove = [];
    for (let i = 1; i < searchTermLines.length; i++) {
        if (/^\s*const \[searchTerm, setSearchTerm\] = useState\(''\)\s*$/.test(searchTermLines[i])) {
            const prev = searchTermLines[i - 1].trim();
            // If previous line is inside a hook/object, this is misplaced
            if (/useQuery\(\{/.test(prev) || /files\?\.\[0\]/.test(prev) ||
                /useState\(\(\) =>/.test(prev) || /Download,/.test(prev) ||
                /queryFn:/.test(prev) || /\.then\(/.test(prev)) {
                linesToRemove.push(i);
            }
        }
    }
    if (linesToRemove.length > 0) {
        for (let i = linesToRemove.length - 1; i >= 0; i--) {
            searchTermLines.splice(linesToRemove[i], 1);
        }
        c = searchTermLines.join('\n');
    }

    // === FIX 4: Remove unused imports added by MVP injection ===
    // Only remove if the MVP block was removed and these imports are no longer needed
    // Check if useQuery/useMutation/useQueryClient are used anywhere else in the file
    // (not just in the imports)
    const codeWithoutImports = c.replace(/^import .*$/gm, '');

    // Remove "import { useAuthStore } from '@/stores/auth-store'" if not used in code
    if (!/useAuthStore/.test(codeWithoutImports)) {
        c = c.replace(/import \{ useAuthStore \} from '@\/stores\/auth-store'\n/g, '');
    }

    // Remove "import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'"
    // only if NONE of these are used in the code body
    if (!/useQuery|useMutation|useQueryClient/.test(codeWithoutImports)) {
        c = c.replace(/import \{ useQuery, useMutation, useQueryClient \} from '@tanstack\/react-query'\n/g, '');
    }

    // Remove "import api from '@/lib/api'" if not used in code
    if (!/\bapi\b/.test(codeWithoutImports)) {
        c = c.replace(/import api from '@\/lib\/api'\n/g, '');
    }

    // Clean up extra blank lines (max 2 consecutive)
    c = c.replace(/\n{3,}/g, '\n\n');

    // Restore line endings
    if (hadCRLF) {
        c = c.replace(/\n/g, '\r\n');
    }

    if (c !== original) {
        fs.writeFileSync(file, c, 'utf8');
        totalFixed++;
        fixedFiles.push(path.relative('frontend/src/pages', file).replace(/\\/g, '/'));
    }
}

console.log('=== FIXED FILES ===');
fixedFiles.forEach(f => console.log('  ' + f));
console.log('\nTotal fixed:', totalFixed);

// Verify: run scanner again
console.log('\n=== VERIFICATION (remaining issues) ===');
let remaining = 0;
for (const file of files) {
    const c = fs.readFileSync(file, 'utf8');
    const lines = c.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        if (/^\s*,\s*Loader2\s*\}\s*from\s*'lucide-react'/.test(lines[i])) {
            console.log('  STRAY_COMMA still in ' + path.basename(file) + ':' + (i + 1));
            remaining++;
        }
        if (/\/\/ MVP: Data fetching/.test(lines[i])) {
            console.log('  MVP_BLOCK still in ' + path.basename(file) + ':' + (i + 1));
            remaining++;
        }
    }
}
console.log('Remaining issues:', remaining);
