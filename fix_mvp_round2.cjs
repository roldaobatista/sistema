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

    // Check if MVP block exists
    if (!/\/\/ MVP: Data fetching/.test(c)) continue;

    const lines = c.split('\n');
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        if (/\/\/ MVP: Data fetching/.test(lines[i])) {
            startIdx = i;
            break;
        }
    }

    if (startIdx < 0) continue;

    // Find the end of the MVP block: search for the hasPermission line 
    // or handleDelete line (whichever comes last in the block)
    for (let i = startIdx; i < Math.min(startIdx + 25, lines.length); i++) {
        if (/const \{ hasPermission \} = useAuthStore/.test(lines[i])) {
            endIdx = i;
        }
        if (/handleDelete/.test(lines[i]) && endIdx < 0) {
            endIdx = i; // fallback if hasPermission isn't there
        }
    }

    if (endIdx < 0) {
        // Fallback: look for the end of the deleteMutation block
        for (let i = startIdx; i < Math.min(startIdx + 20, lines.length); i++) {
            if (/const handleDelete/.test(lines[i])) {
                endIdx = i;
                break;
            }
        }
    }

    if (endIdx < 0) continue;

    // Also remove searchTerm line right after if misplaced
    if (endIdx + 1 < lines.length && /const \[searchTerm/.test(lines[endIdx + 1])) {
        endIdx++;
    }
    // Remove blank line after too
    if (endIdx + 1 < lines.length && lines[endIdx + 1].trim() === '') {
        endIdx++;
    }

    // Remove the block
    lines.splice(startIdx, endIdx - startIdx + 1);
    c = lines.join('\n');

    // Also remove ORPHAN searchTerm that may be further down
    const cleanLines = c.split('\n');
    const toRemove = [];
    for (let i = 1; i < cleanLines.length; i++) {
        if (/^\s*const \[searchTerm, setSearchTerm\] = useState\(''\)\s*$/.test(cleanLines[i])) {
            const prev = cleanLines[i - 1].trim();
            // If inside a block (not top-level state init)
            if (prev.endsWith(',') || prev.endsWith('{') || prev.endsWith('=>') || prev === '') {
                toRemove.push(i);
            }
        }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
        cleanLines.splice(toRemove[i], 1);
    }
    c = cleanLines.join('\n');

    // Clean up unused imports that were only needed by MVP block
    const codeBody = c.replace(/^import .*$/gm, '');

    // Remove useAuthStore import if not used
    if (!/useAuthStore/.test(codeBody)) {
        c = c.replace(/import \{ useAuthStore \} from ['"]@\/stores\/auth-store['"]\n/g, '');
    }

    // Remove api import if not used  
    if (!/\bapi[.\[(]/.test(codeBody)) {
        c = c.replace(/import api from ['"]@\/lib\/api['"]\n/g, '');
    }

    // Remove useQuery etc import if not used
    if (!/useQuery|useMutation|useQueryClient/.test(codeBody)) {
        c = c.replace(/import \{ useQuery, useMutation, useQueryClient \} from ['"]@tanstack\/react-query['"]\n/g, '');
    }

    // Remove toast import if not used
    if (!/\btoast\b/.test(codeBody)) {
        c = c.replace(/import \{ toast \} from ['"]sonner['"]\n/g, '');
    }

    // Clean up blank lines
    c = c.replace(/\n{3,}/g, '\n\n');

    if (hadCRLF) c = c.replace(/\n/g, '\r\n');

    if (c !== original) {
        fs.writeFileSync(file, c, 'utf8');
        totalFixed++;
        fixedFiles.push(path.relative('frontend/src/pages', file).replace(/\\/g, '/'));
    }
}

console.log('=== ROUND 2 FIXED ===');
fixedFiles.forEach(f => console.log('  ' + f));
console.log('\nTotal fixed:', totalFixed);

// Verify
console.log('\n=== REMAINING ===');
let remaining = 0;
for (const file of files) {
    const c = fs.readFileSync(file, 'utf8');
    if (/\/\/ MVP: Data fetching/.test(c)) {
        console.log('  MVP still in: ' + path.basename(file));
        remaining++;
    }
    const lines = c.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*,\s*Loader2\s*\}\s*from\s*'lucide-react'/.test(lines[i])) {
            console.log('  STRAY COMMA still in: ' + path.basename(file) + ':' + (i + 1));
            remaining++;
        }
    }
}
console.log('Remaining issues:', remaining);
