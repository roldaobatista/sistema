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
    const toRemove = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Find ALL misplaced searchTerm declarations
        if (line === "const [searchTerm, setSearchTerm] = useState('')") {
            // Check context: is this inside a destructuring, hook body, or object literal?
            // Valid placement: at the top level of a component function, after other useState calls
            // Invalid: inside useQuery, inside another destructuring, inside a callback

            const prev = i > 0 ? lines[i - 1].trim() : '';
            const indent = lines[i].match(/^(\s*)/)[1].length;

            // If the previous line ends with { or , or => and this line is at unusual indent
            // OR if this line is sandwiched between destructured properties
            const next = i + 1 < lines.length ? lines[i + 1].trim() : '';

            const isInDestructuring = prev.endsWith('{') && !prev.startsWith('const') && !prev.startsWith('let');
            const isAfterComma = prev.endsWith(',') && !prev.startsWith('const') && !prev.startsWith('let');
            const isBeforeDestructuredProp = /^[a-z]/.test(next) && (next.endsWith(',') || next.endsWith('}'));
            const isInsideUseQuery = prev.includes('useQuery') || prev.includes('queryFn');
            const isInsideUseState = prev.includes('useState(');
            const isInsideCallback = prev.includes('=>');
            const isAfterDownload = prev.includes('Download,');
            const isInsideObjectOrDestructure = /^const \{$/.test(prev);

            if (isInDestructuring || isInsideUseQuery || isInsideUseState ||
                isInsideCallback || isAfterDownload || isInsideObjectOrDestructure ||
                (isAfterComma && isBeforeDestructuredProp)) {
                toRemove.push(i);
            }
        }
    }

    if (toRemove.length > 0) {
        for (let i = toRemove.length - 1; i >= 0; i--) {
            lines.splice(toRemove[i], 1);
        }
        c = lines.join('\n');

        // Clean up blank lines
        c = c.replace(/\n{3,}/g, '\n\n');

        if (hadCRLF) c = c.replace(/\n/g, '\r\n');

        if (c !== original) {
            fs.writeFileSync(file, c, 'utf8');
            totalFixed++;
            fixedFiles.push(path.relative('frontend/src/pages', file).replace(/\\/g, '/'));
        }
    }
}

console.log('=== SEARCHTERM CLEANUP ===');
fixedFiles.forEach(f => console.log('  ' + f));
console.log('Total fixed:', totalFixed);

// Also check for any remaining syntax errors
console.log('\n=== CHECKING FOR OTHER SYNTAX PATTERNS ===');
for (const file of files) {
    const c = fs.readFileSync(file, 'utf8');
    const lines = c.split(/\r?\n/);
    const bn = path.basename(file);

    // Check for orphan 'const {' line (no destructured names on same line)
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*const \{\s*$/.test(lines[i]) && i + 1 < lines.length) {
            const next = lines[i + 1].trim();
            if (/^const /.test(next) || /^import /.test(next)) {
                console.log(`  ORPHAN 'const {' in ${bn}:${i + 1}`);
            }
        }
    }

    // Check for 'Identifier has already been declared' patterns
    // (two const declarations with same name)
    const declaredVars = {};
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^\s*const (\w+|\{ [^}]+ \}|\[[^\]]+\]) = /);
        if (m) {
            const varName = m[1];
            if (declaredVars[varName]) {
                // Check it's not inside different scopes (simple heuristic)
                console.log(`  POSSIBLE REDECLARATION of '${varName}' in ${bn}:${i + 1} (first at ${declaredVars[varName]})`);
            }
            declaredVars[varName] = i + 1;
        }
    }
}
