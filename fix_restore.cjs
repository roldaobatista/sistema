const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find files where the destructuring fix script removed too much
// Pattern: a line starting with "queryKey:" or "queryFn:" or "mutationFn:" at wrong indent 
// without being preceded by const { ... } = useQuery/useMutation

const out = execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

const fixes = [];

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');
    const hadCRLF = c.includes('\r\n');
    c = c.replace(/\r\n/g, '\n');
    let lines = c.split('\n');
    let modified = false;
    const bn = path.basename(file);

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // Pattern: orphaned queryKey/queryFn/mutationFn lines
        // These belong inside a useQuery/useMutation call but the const { ... } = useQuery({ was removed
        if ((trimmed.startsWith('queryKey:') || trimmed.startsWith('queryFn:')) && i > 0) {
            const prev = lines[i - 1].trim();
            // If prev is a function declaration or just contains { or is blank or ends with })
            // AND doesn't end with useQuery({ or useMutation({, the const line was removed
            if (!prev.includes('useQuery') && !prev.includes('useMutation') && !prev.endsWith('({')) {
                // Was the const { ... } = useQuery({ removed?
                // Check if 2-3 lines down has "enabled:" or "})" 
                let isOrphaned = false;
                for (let j = i; j < Math.min(i + 5, lines.length); j++) {
                    const jt = lines[j].trim();
                    if (jt === '})' || jt.startsWith('enabled:') || jt.startsWith('select:')) {
                        isOrphaned = true;
                        break;
                    }
                }

                if (isOrphaned) {
                    // Need to figure out what the full line was
                    // Look at the closing: what variables were destructured?
                    // Check the rest of the file for data, isLoading, isError usage
                    const rest = lines.slice(i).join('\n');
                    const hasData = /\bdata\b/.test(lines.slice(i, i + 10).join('\n'));
                    const hasIsLoading = /\bisLoading\b/.test(rest);
                    const hasIsError = /\bisError\b/.test(rest);
                    const hasRefetch = /\brefetch\b/.test(rest);

                    const vars = [];
                    if (hasData) vars.push('data');
                    if (hasIsLoading) vars.push('isLoading');
                    if (hasIsError) vars.push('isError');
                    if (hasRefetch) vars.push('refetch');

                    const destructuring = vars.length > 0 ? `const { ${vars.join(', ')} } = useQuery({` : 'const { data } = useQuery({';
                    const indent = lines[i].match(/^(\s*)/)[1];
                    lines.splice(i, 0, indent + destructuring);
                    modified = true;
                    fixes.push(`  RESTORED_USEQUERY ${bn}:${i + 1} → ${destructuring}`);
                }
            }
        }

        // Pattern: orphaned mutationFn:
        if (trimmed.startsWith('mutationFn:') && i > 0) {
            const prev = lines[i - 1].trim();
            if (!prev.includes('useMutation') && !prev.endsWith('({') && !prev.endsWith('= {')) {
                const indent = lines[i].match(/^(\s*)/)[1];
                // Look back to find what variable name to use
                let varName = 'mutation';
                // Look forward for onSuccess/onError
                const rest = lines.slice(i, i + 20).join('\n');
                if (/delete/i.test(rest)) varName = 'deleteMutation';
                else if (/update/i.test(rest)) varName = 'updateMutation';
                else if (/create|store/i.test(rest)) varName = 'createMutation';

                lines.splice(i, 0, indent + `const ${varName} = useMutation({`);
                modified = true;
                fixes.push(`  RESTORED_USEMUTATION ${bn}:${i + 1}`);
            }
        }
    }

    // Pattern: line starting with "return (" inside destructuring
    // This happens when component props were mixed with const lines

    if (modified) {
        c = lines.join('\n');
        c = c.replace(/\n{3,}/g, '\n\n');
        if (hadCRLF) c = c.replace(/\n/g, '\r\n');
        fs.writeFileSync(file, c, 'utf8');
    }
}

console.log('=== RESTORATION RESULTS ===');
fixes.forEach(f => console.log(f));
console.log(`\nTotal fixes: ${fixes.length}`);

// Run build to verify
console.log('\n=== RUNNING VITE BUILD ===');
try {
    execSync('npx vite build 2>&1', {
        cwd: path.join(__dirname, 'frontend'),
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000
    });
    console.log('✅ BUILD SUCCEEDED!');
} catch (e) {
    const output = (e.stdout || '') + '\n' + (e.stderr || '');
    const errMatch = output.match(/ERROR:\s*(.+)/);
    const fileMatch = output.match(/file:\s*(.+)/);
    if (errMatch) console.log(`❌ Error: ${errMatch[1]}`);
    if (fileMatch) console.log(`  File: ${fileMatch[1]}`);
}
