const fs = require('fs');
const path = require('path');

const out = require('child_process').execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

let totalFixed = 0;
const fixedFiles = [];

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');
    const original = c;

    const hadCRLF = c.includes('\r\n');
    c = c.replace(/\r\n/g, '\n');

    const lines = c.split('\n');
    let modified = false;

    // Find misplaced "import { useAuthStore }" inside other import blocks
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === "import { useAuthStore } from '@/stores/auth-store'" ||
            line === "import { useAuthStore } from '@/stores/auth-store';") {
            // Check if we are inside a multi-line import (previous line doesn't start with import and we haven't seen } from)
            // Look backwards to see if there is an open import { without closing }
            let insideImport = false;
            for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                const prevLine = lines[j].trim();
                if (prevLine.startsWith('import {') && !prevLine.includes('} from')) {
                    insideImport = true;
                    break;
                }
                if (prevLine.includes('} from') || prevLine === '') break;
            }

            if (insideImport) {
                // Remove this line
                lines.splice(i, 1);

                // Add proper import at top of file (before other imports)
                const importLine = "import { useAuthStore } from '@/stores/auth-store'";

                // Check if already imported elsewhere
                const alreadyImported = lines.some(l =>
                    l.trim().includes("useAuthStore") &&
                    l.trim().startsWith("import") &&
                    l.trim() !== importLine
                );

                if (!alreadyImported && !lines.some(l => l.trim() === importLine || l.trim() === importLine + ';')) {
                    // Insert after last import
                    let lastImportIdx = 0;
                    for (let j = 0; j < lines.length; j++) {
                        if (lines[j].trim().startsWith('import ') || lines[j].trim().startsWith("} from '")) {
                            lastImportIdx = j;
                        }
                    }
                    lines.splice(lastImportIdx + 1, 0, importLine);
                }

                modified = true;
                i--; // recheck current index
            }
        }
    }

    // Also fix: misplaced "import api from '@/lib/api'" inside other imports
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "import api from '@/lib/api'" || line === "import api from '@/lib/api';") {
            let insideImport = false;
            for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                const prevLine = lines[j].trim();
                if (prevLine.startsWith('import {') && !prevLine.includes('} from')) {
                    insideImport = true;
                    break;
                }
                if (prevLine.includes('} from') || prevLine === '') break;
            }

            if (insideImport) {
                lines.splice(i, 1);
                const importLine = "import api from '@/lib/api'";
                if (!lines.some(l => l.trim() === importLine || l.trim() === importLine + ';')) {
                    let lastImportIdx = 0;
                    for (let j = 0; j < lines.length; j++) {
                        if (lines[j].trim().startsWith('import ') || lines[j].trim().startsWith("} from '")) {
                            lastImportIdx = j;
                        }
                    }
                    lines.splice(lastImportIdx + 1, 0, importLine);
                }
                modified = true;
                i--;
            }
        }
    }

    if (modified) {
        c = lines.join('\n');
        c = c.replace(/\n{3,}/g, '\n\n');
        if (hadCRLF) c = c.replace(/\n/g, '\r\n');
        fs.writeFileSync(file, c, 'utf8');
        totalFixed++;
        fixedFiles.push(path.relative('frontend/src/pages', file).replace(/\\/g, '/'));
    }
}

console.log('=== MISPLACED IMPORT FIX ===');
fixedFiles.forEach(f => console.log('  ' + f));
console.log('Total fixed:', totalFixed);
