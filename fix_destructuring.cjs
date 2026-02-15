const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const out = execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

let totalFixed = 0;
const issues = [];

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');
    const original = c;
    const bn = path.basename(file);

    const hadCRLF = c.includes('\r\n');
    c = c.replace(/\r\n/g, '\n');
    let lines = c.split('\n');
    let modified = false;

    // === PATTERN: MVP inject inside function destructuring props ===
    // export function Component({
    //   const { user } = useAuthStore()        <-- REMOVE
    //   const hasPermission = ...              <-- REMOVE  
    //   // MVP: Search                         <-- REMOVE
    //   const [searchTerm, ...                 <-- REMOVE
    //     prop1,

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // Look for the pattern: we are inside a function destructuring ({)
        // Indicators: prev lines have "function Name({" without closing })
        if (trimmed.startsWith('const ') || trimmed.startsWith('// MVP:')) {
            // Check if we're inside destructuring
            let insideDestructuring = false;
            for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                const prev = lines[j].trim();
                if (/^export\s+(default\s+)?function\s+\w+\(\{/.test(prev) ||
                    /^function\s+\w+\(\{/.test(prev) ||
                    prev === '({') {
                    insideDestructuring = true;
                    break;
                }
                // If we hit a line that looks like a prop (identifier followed by comma or closing}), 
                // keep looking back
                if (/^\w+,?$/.test(prev) || /^\w+\s*=/.test(prev) || prev === '' ||
                    prev.startsWith('const ') || prev.startsWith('// MVP')) {
                    continue;
                }
                break;
            }

            if (insideDestructuring) {
                // Check if this line is a const declaration or MVP comment (not a prop)
                if (trimmed.startsWith('const [') || trimmed.startsWith('const {') ||
                    trimmed.startsWith('const hasPermission') || trimmed.startsWith('// MVP:')) {
                    lines.splice(i, 1);
                    modified = true;
                    issues.push(`  DESTRUCTURING_MVP ${bn}:${i + 1}: ${trimmed.substring(0, 60)}`);
                    i--;
                    continue;
                }
            }
        }
    }

    // === PATTERN: Collapsed onSuccess callbacks ===
    c = lines.join('\n');
    // toast.success('...') followed by qc., queryClient., set, navigate without semicolon
    let prevC = '';
    while (prevC !== c) {
        prevC = c;
        c = c.replace(
            /toast\.(success|error|info|warning)\(([^)]+)\)\s+(qc\.|queryClient\.|set\w+\(|navigate\()/,
            'toast.$1($2)\n                $3'
        );
    }

    // Split "); qc." on same line
    prevC = '';
    while (prevC !== c) {
        prevC = c;
        c = c.replace(/;\s*(qc|queryClient)\.invalidateQueries/g, ';\n                $1.invalidateQueries');
    }

    if (c !== original.replace(/\r\n/g, '\n')) {
        modified = true;
    }

    if (modified) {
        c = c.replace(/\n{3,}/g, '\n\n');
        if (hadCRLF) c = c.replace(/\n/g, '\r\n');
        fs.writeFileSync(file, c, 'utf8');
        totalFixed++;
    }
}

console.log('=== DESTRUCTURING + COLLAPSED FIX ===');
issues.forEach(i => console.log(i));
console.log(`\nTotal files fixed: ${totalFixed}`);

// Now run vite build to check
console.log('\n=== RUNNING VITE BUILD ===');
try {
    const result = execSync('npx vite build 2>&1', {
        cwd: path.join(__dirname, 'frontend'),
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000
    });
    console.log('✅ BUILD SUCCEEDED!');
    // Show just the last few lines
    const resultLines = result.split('\n');
    resultLines.slice(-5).forEach(l => console.log(l));
} catch (e) {
    const output = (e.stdout || '') + '\n' + (e.stderr || '');
    console.log('❌ BUILD FAILED');
    // Extract error info
    const errMatch = output.match(/ERROR:\s*(.+)/);
    const fileMatch = output.match(/file:\s*(.+)/);
    if (errMatch) console.log(`  Error: ${errMatch[1]}`);
    if (fileMatch) console.log(`  File: ${fileMatch[1]}`);

    // Show relevant lines
    const lines = output.split('\n');
    for (const line of lines) {
        if (line.includes('ERROR') || line.includes('error') || line.includes('file:')) {
            console.log(`  ${line.trim()}`);
        }
    }
}
