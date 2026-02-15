const fs = require('fs');
const path = require('path');

const out = require('child_process').execSync('dir /s /b frontend\\src\\pages\\*.tsx', { encoding: 'utf8' });
const files = out.trim().split('\r\n').filter(Boolean);

let totalFixed = 0;
const fixedFiles = [];

// Strategy: Remove ALL searchTerm lines that are CLEARLY misplaced
// A valid searchTerm declaration should be:
// 1. At component top-level (similar indent to other useState calls)
// 2. Not inside an object literal, export, useQuery, callback, etc.
// Approach: look at context around searchTerm declaration

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');
    const original = c;

    const hadCRLF = c.includes('\r\n');
    c = c.replace(/\r\n/g, '\n');

    // Check if there's a misplaced searchTerm
    if (!/const \[searchTerm, setSearchTerm\] = useState\(''\)/.test(c)) continue;

    const lines = c.split('\n');
    const toRemove = [];

    for (let i = 0; i < lines.length; i++) {
        if (/const \[searchTerm, setSearchTerm\] = useState\(''\)/.test(lines[i])) {
            // Check context
            const prev = i > 0 ? lines[i - 1].trim() : '';
            const next = i + 1 < lines.length ? lines[i + 1].trim() : '';

            // VALID: If previous line is another useState or a "const [" declaration
            const isAfterUseState = /useState/.test(prev) || /const \[/.test(prev);
            // VALID: If previous line is empty and before it is a useState  
            const isAfterEmpty = prev === '' && i > 1 && /useState/.test(lines[i - 2]?.trim() || '');
            // VALID: If it's the first state declaration after component function
            const isAfterFunctionStart = /function|=>|{$/.test(prev) && !/Record|object|endpoint/i.test(prev);

            // INVALID: If inside object literal
            const isInObject = /:\s*\{/.test(prev) || /Record</.test(prev) || prev.endsWith('{') && !prev.includes('function') && !prev.includes('=>');
            // INVALID: If next line is a property assignment (key: value)
            const isBeforeProperty = /^\w+:/.test(next);
            // INVALID: If inside destructuring
            const isInDestructuring = prev.startsWith('const {') || (prev.endsWith(',') && !prev.startsWith('const'));
            // INVALID: If inside useQuery
            const isInQuery = /useQuery|queryFn|queryKey/.test(prev);
            // INVALID: If inside callback
            const isInCallback = prev.includes('=>');
            // INVALID: If after a property assignment
            const isAfterProperty = /^\w+:\s/.test(prev);

            if (isInObject || isBeforeProperty || isInDestructuring || isInQuery || isAfterProperty) {
                toRemove.push(i);
                console.log(`  REMOVING: ${path.basename(file)}:${i + 1} (prev: "${prev.substring(0, 50)}")`);
            }
        }
    }

    if (toRemove.length > 0) {
        for (let i = toRemove.length - 1; i >= 0; i--) {
            lines.splice(toRemove[i], 1);
        }
        c = lines.join('\n');
        c = c.replace(/\n{3,}/g, '\n\n');
        if (hadCRLF) c = c.replace(/\n/g, '\r\n');
        fs.writeFileSync(file, c, 'utf8');
        totalFixed++;
        fixedFiles.push(path.relative('frontend/src/pages', file).replace(/\\/g, '/'));
    }
}

console.log('\n=== SEARCHTERM FINAL FIX ===');
fixedFiles.forEach(f => console.log('  ' + f));
console.log('Total fixed:', totalFixed);

// Now: Check for ALL remaining syntax issues — comprehensive scan
console.log('\n=== FINAL COMPREHENSIVE CHECK ===');
let issues = 0;
for (const file of files) {
    const c = fs.readFileSync(file, 'utf8');
    const lines = c.split(/\r?\n/);
    const bn = path.basename(file);

    // Check for MVP blocks
    if (/\/\/ MVP: Data fetching/.test(c)) {
        console.log(`  MVP_BLOCK in ${bn}`);
        issues++;
    }

    // Check for stray comma in lucide imports
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*,\s*Loader2\s*\}\s*from\s*'lucide-react'/.test(lines[i])) {
            console.log(`  STRAY_COMMA in ${bn}:${i + 1}`);
            issues++;
        }
    }

    // Check for import inside import
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
            const prev = lines[i - 1].trim();
            if (prev.startsWith('import {') && !prev.includes('} from')) {
                console.log(`  IMPORT_INSIDE_IMPORT in ${bn}:${i + 1}`);
                issues++;
            }
        }
    }

    // Check for misplaced searchTerm
    for (let i = 0; i < lines.length; i++) {
        if (/const \[searchTerm.*useState\(''\)/.test(lines[i])) {
            const prev = i > 0 ? lines[i - 1].trim() : '';
            const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
            if (/:\s*\{|Record</.test(prev) || /^\w+:/.test(next)) {
                console.log(`  SEARCHTERM_MISPLACED in ${bn}:${i + 1}`);
                issues++;
            }
        }
    }
}
console.log(`Total remaining issues: ${issues}`);
