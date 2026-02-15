const fs = require('fs');
const path = require('path');

// Find ALL .tsx files in pages/
const out = require('child_process').execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

const issues = [];

for (const file of files) {
    const c = fs.readFileSync(file, 'utf8');
    const lines = c.split(/\r?\n/);
    const bn = path.relative('frontend/src/pages', file).replace(/\\/g, '/');

    // Check 1: Stray comma: line starts with , before Loader2
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*,\s*Loader2\s*\}\s*from\s*'lucide-react'/.test(lines[i])) {
            issues.push({ file: bn, line: i + 1, type: 'STRAY_COMMA' });
        }
    }

    // Check 2: searchTerm inside useQuery or other hook call (misplaced)
    for (let i = 1; i < lines.length; i++) {
        if (/const \[searchTerm/.test(lines[i])) {
            const prev = lines[i - 1].trim();
            if (/useQuery\(\{/.test(prev) || /files\?\.\[0\]/.test(prev) ||
                /useState\(\(\) =>/.test(prev) || /Download,/.test(prev)) {
                issues.push({ file: bn, line: i + 1, type: 'SEARCHTERM_MISPLACED' });
            }
        }
    }

    // Check 3: MVP block injected
    for (let i = 0; i < lines.length; i++) {
        if (/\/\/ MVP: Data fetching/.test(lines[i])) {
            issues.push({ file: bn, line: i + 1, type: 'MVP_BLOCK' });
        }
    }

    // Check 4: Duplicate useAuthStore destructuring  
    const authLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (/const \{.*hasPermission.*\} = useAuthStore/.test(lines[i])) authLines.push(i + 1);
    }
    if (authLines.length > 1) {
        issues.push({ file: bn, lines: authLines, type: 'DUPLICATE_AUTH' });
    }
}

// Summarize
const byType = {};
issues.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1; });
const uniqueFiles = [...new Set(issues.map(i => i.file))];

console.log('=== ISSUES FOUND ===');
console.log('By type:', JSON.stringify(byType));
console.log('Unique files with issues:', uniqueFiles.length);
console.log('');
issues.forEach(i => console.log(`  ${i.type} @ ${i.file}:${i.line || i.lines}`));
