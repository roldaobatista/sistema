const fs = require('fs');
const path = require('path');

const out = require('child_process').execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

let totalFixed = 0;
const fixedFiles = [];

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');
    const original = c;

    // Pattern: toast.success('...') someFunction() on same line (missing semicolon)
    // This was caused by MVP inject collapsing multiple lines into one
    // Fix: split into separate lines

    // Pattern 1: toast.success('...') setXxx(...)
    c = c.replace(/toast\.success\(([^)]+)\)\s+(set\w+\()/g, 'toast.success($1)\n                $2');

    // Pattern 2: toast.success('...') queryClient.invalidateQueries
    c = c.replace(/toast\.success\(([^)]+)\)\s+(queryClient\.)/g, 'toast.success($1)\n                $2');

    // Pattern 3: toast.success('...') navigate(
    c = c.replace(/toast\.success\(([^)]+)\)\s+(navigate\()/g, 'toast.success($1)\n                $2');

    // Pattern 4: Multiple semicolon-separated statements with missing line breaks in onSuccess
    // e.g.: qc.invalidateQueries(...); qc.inva... on same line  
    // Fix approach: if a line has '); ' followed by another statement, split it
    c = c.replace(/toast\.error\(([^)]+)\)\s+(set\w+\()/g, 'toast.error($1)\n                $2');

    if (c !== original) {
        fs.writeFileSync(file, c, 'utf8');
        totalFixed++;
        fixedFiles.push(path.basename(file));
    }
}

console.log('=== COLLAPSED STATEMENTS FIX ===');
fixedFiles.forEach(f => console.log('  ' + f));
console.log('Total fixed:', totalFixed);

// Now find remaining similar patterns
console.log('\n=== REMAINING COLLAPSED STATEMENTS ===');
for (const file of files) {
    const c = fs.readFileSync(file, 'utf8');
    const lines = c.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for toast followed by another call on same line
        if (/toast\.\w+\([^)]+\)\s+\w/.test(line) && !/\/\//.test(line.split('toast')[0])) {
            console.log(`  ${path.basename(file)}:${i + 1}: ${line.trim().substring(0, 80)}`);
        }
    }
}
