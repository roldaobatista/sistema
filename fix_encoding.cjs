/**
 * Fix UTF-8 double-encoding v3.
 * Direct string replacement approach with all mojibake combos.
 * Processes longer patterns first to avoid partial matches.
 */
const fs = require('fs');
const path = require('path');

// All Known Mojibake -> Correct mappings
// Using Unicode escape sequences for the "bad" chars to avoid editor issues
const MAP = {
    // Composite sequences (process FIRST - longer strings)
    '\u00C3\u00A7\u00C3\u00A3o': '\u00E7\u00E3o',   // ção
    '\u00C3\u00A7\u00C3\u00B5es': '\u00E7\u00F5es',  // ções  
    '\u00C3\u00A3o': '\u00E3o',                        // ão
    '\u00C3\u00B5es': '\u00F5es',                      // ões

    // Single characters (process AFTER composites)
    '\u00C3\u00A7': '\u00E7',   // ç
    '\u00C3\u00A3': '\u00E3',   // ã
    '\u00C3\u00B5': '\u00F5',   // õ
    '\u00C3\u00A1': '\u00E1',   // á
    '\u00C3\u00A9': '\u00E9',   // é
    '\u00C3\u00AD': '\u00ED',   // í
    '\u00C3\u00B3': '\u00F3',   // ó
    '\u00C3\u00BA': '\u00FA',   // ú
    '\u00C3\u00A2': '\u00E2',   // â
    '\u00C3\u00AA': '\u00EA',   // ê
    '\u00C3\u00B4': '\u00F4',   // ô
    '\u00C3\u00A0': '\u00E0',   // à
    '\u00C3\u00BC': '\u00FC',   // ü
    '\u00C3\u00B1': '\u00F1',   // ñ
    // Uppercase
    '\u00C3\u0087': '\u00C7',   // Ç
    '\u00C3\u0083': '\u00C3',   // Ã (capital) — careful, this maps Ã+\u0083 
    '\u00C3\u0093': '\u00D3',   // Ó
    '\u00C3\u0089': '\u00C9',   // É
    '\u00C3\u008D': '\u00CD',   // Í
    '\u00C3\u009A': '\u00DA',   // Ú
    '\u00C3\u0080': '\u00C0',   // À
    '\u00C3\u0094': '\u00D4',   // Ô
    '\u00C3\u008A': '\u00CA',   // Ê
};

// Sort by key length descending to replace longer patterns first
const sortedPairs = Object.entries(MAP).sort((a, b) => b[0].length - a[0].length);

function walk(dir, exts) {
    const results = [];
    try {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const fp = path.join(dir, f.name);
            if (f.isDirectory() && !f.name.startsWith('.') && f.name !== 'node_modules') {
                results.push(...walk(fp, exts));
            } else if (exts.some(e => f.name.endsWith(e))) {
                results.push(fp);
            }
        }
    } catch { }
    return results;
}

const srcDir = path.join(__dirname, 'frontend', 'src');
const files = walk(srcDir, ['.tsx', '.ts', '.css']);

let totalFixed = 0;
let totalReplacements = 0;

for (const filepath of files) {
    const original = fs.readFileSync(filepath, 'utf8');
    let content = original;
    let fileReps = 0;

    for (const [bad, good] of sortedPairs) {
        while (content.includes(bad)) {
            content = content.replace(bad, good);
            fileReps++;
        }
    }

    if (fileReps > 0) {
        fs.writeFileSync(filepath, content, 'utf8');
        totalFixed++;
        totalReplacements += fileReps;
        console.log(`  ${path.relative(srcDir, filepath)} (${fileReps})`);
    }
}

console.log(`\nTotal: ${totalFixed} files, ${totalReplacements} replacements`);
