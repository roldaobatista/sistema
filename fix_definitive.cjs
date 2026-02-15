const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const out = execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

let totalFixed = 0;
const allIssues = [];

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');
    const original = c;
    const bn = path.basename(file);

    const hadCRLF = c.includes('\r\n');
    c = c.replace(/\r\n/g, '\n');

    let lines = c.split('\n');
    let modified = false;

    // === AGGRESSIVE FIX: Remove ALL searchTerm declarations that are MISPLACED ===
    // Strategy: If searchTerm is declared but the NEXT line doesn't start with 
    // "const [" or an indented statement at the same level, it's likely misplaced
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === "const [searchTerm, setSearchTerm] = useState('')" ||
            trimmed === "const [searchTerm, setSearchTerm] = useState('');") {

            // Check: is this a valid top-level useState in a component?
            // VALID indicators:
            // - Previous line is also a useState or const [
            // - Previous line starts the function body
            // - Indent level matches other useState calls nearby

            const indent = lines[i].match(/^(\s*)/)[1].length;
            const prev = i > 0 ? lines[i - 1] : '';
            const prevTrimmed = prev.trim();
            const next = i + 1 < lines.length ? lines[i + 1] : '';
            const nextTrimmed = next.trim();

            // INVALID indicators (high confidence):
            const isInsideObjectOrArray = prevTrimmed.endsWith('{') && !prevTrimmed.includes('function') && !prevTrimmed.includes('=>') && !prevTrimmed.includes('if') && !prevTrimmed.includes('else');
            const isInsideImport = prevTrimmed.startsWith('import');
            const isBeforeProperty = /^\w+\s*:/.test(nextTrimmed) && !nextTrimmed.startsWith('const') && !nextTrimmed.startsWith('let');
            const isInsideDestructuring = prevTrimmed.includes('} =') || (prevTrimmed.endsWith(',') && /^\w+/.test(prevTrimmed) && indent > 4);
            const isInsideCallback = prevTrimmed.endsWith('=>') || prevTrimmed.endsWith('=> {');
            const isInsideMutation = prevTrimmed.includes('onSuccess') || prevTrimmed.includes('mutationFn') || prevTrimmed.includes('queryFn');
            const isAfterReturn = prevTrimmed.startsWith('return');

            // Check if searchTerm is actually USED in the file (ignoring the declaration itself)
            const restOfFile = lines.slice(i + 1).join('\n');
            const isSearchTermUsed = /searchTerm/.test(restOfFile);

            // If any invalid indicator or if searchTerm is NOT used, remove it
            if (isInsideObjectOrArray || isInsideImport || isBeforeProperty ||
                isInsideDestructuring || isInsideMutation || isAfterReturn ||
                !isSearchTermUsed) {
                lines.splice(i, 1);
                modified = true;
                allIssues.push(`  SEARCHTERM_REMOVED ${bn}:${i + 1} (prev: "${prevTrimmed.substring(0, 40)}")`);
                i--;
            }
        }
    }

    // === FIX: Stray commas on own line ===
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*,\s*$/.test(lines[i])) {
            const prev = i > 0 ? lines[i - 1].trim() : '';
            const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
            if (prev.endsWith('},') || prev.endsWith('),') || prev.endsWith('}') || prev.endsWith(')') || prev === '') {
                lines.splice(i, 1);
                modified = true;
                allIssues.push(`  STRAY_COMMA ${bn}:${i + 1}`);
                i--;
            }
        }
    }

    // === FIX: toast collapsed with another call ===
    c = lines.join('\n');
    const collapsed = /toast\.(success|error|info|warning)\(([^)]+)\)\s+((?:qc|queryClient)\.\w+|set\w+|navigate)\(/;
    while (collapsed.test(c)) {
        c = c.replace(collapsed, 'toast.$1($2)\n                $3(');
        modified = true;
    }

    // === FIX: Multiple qc.invalidateQueries on same line after semicolon ===
    c = c.replace(/;\s*(qc|queryClient)\.invalidateQueries/g, ';\n                $1.invalidateQueries');

    // === FIX: setXyz after semicolon on same onSuccess line ===
    c = c.replace(/;\s*set(\w+)\(/g, ';\n                set$1(');

    if (c !== original.replace(/\r\n/g, '\n')) {
        c = c.replace(/\n{3,}/g, '\n\n');
        if (hadCRLF) c = c.replace(/\n/g, '\r\n');
        fs.writeFileSync(file, c, 'utf8');
        totalFixed++;
    }
}

console.log('=== DEFINITIVE FIX RESULTS ===');
allIssues.forEach(i => console.log(i));
console.log('\nTotal files touched:', totalFixed);

// Final scan for any remaining issues
console.log('\n=== FINAL VERIFICATION SCAN ===');
let remaining = 0;
for (const file of files) {
    const c = fs.readFileSync(file, 'utf8');
    const lines = c.split(/\r?\n/);
    const bn = path.basename(file);

    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        // searchTerm misplaced
        if (t === "const [searchTerm, setSearchTerm] = useState('')" || t === "const [searchTerm, setSearchTerm] = useState('');") {
            const prev = i > 0 ? lines[i - 1].trim() : '';
            if (!prev.startsWith('const [') && !prev.startsWith('const ') && !/useState/.test(prev) &&
                prev !== '' && !prev.endsWith('{') && !prev.includes('function')) {
                console.log(`  POSSIBLE_SEARCHTERM ${bn}:${i + 1} prev: "${prev.substring(0, 50)}"`);
                remaining++;
            }
        }
        // toast collapsed
        if (/toast\.\w+\([^)]+\)\s+(qc|queryClient|set\w+|navigate)\(/.test(lines[i])) {
            console.log(`  STILL_COLLAPSED ${bn}:${i + 1}`);
            remaining++;
        }
        // stray comma alone
        if (/^\s*,\s*$/.test(lines[i])) {
            console.log(`  STRAY_COMMA ${bn}:${i + 1}`);
            remaining++;
        }
    }
}
console.log(`Remaining issues: ${remaining}`);
