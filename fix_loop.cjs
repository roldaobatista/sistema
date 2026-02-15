const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Strategy: Run vite build, parse the first error, auto-fix it, repeat
// Until either build succeeds or we run out of known fix patterns

const MAX_ITERATIONS = 30;
let iteration = 0;
let lastError = '';

while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n=== ITERATION ${iteration} ===`);

    let buildOutput;
    try {
        buildOutput = execSync('npx vite build 2>&1', {
            cwd: path.join(__dirname, 'frontend'),
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            timeout: 60000
        });
        console.log('✅ BUILD SUCCEEDED!');
        break;
    } catch (e) {
        buildOutput = e.stdout + '\n' + e.stderr;
    }

    // Parse the error
    // Pattern 1: [plugin:vite:react-babel] filepath: ErrorMessage. (line:col)
    let match = buildOutput.match(/\[plugin:vite:react-babel\]\s*([^:]+\.tsx?):\s*(.+?)\.\s*\((\d+):(\d+)\)/);
    if (!match) {
        // Pattern 2: just look for .tsx: errors
        match = buildOutput.match(/([A-Z]:\\[^\n]+\.tsx?):\s*(.+?)\.\s*\((\d+):(\d+)\)/);
    }
    if (!match) {
        // Pattern 3: look for the error message directly
        match = buildOutput.match(/\[plugin:vite:react-babel\]\s*(.+?\.tsx).*\n.*\n.*\((\d+):(\d+)\)/s);
    }

    if (!match) {
        console.log('❌ Could not parse error from build output');
        console.log(buildOutput.substring(0, 500));
        break;
    }

    let filePath = match[1].trim();
    const errorMsg = match[2]?.trim() || '';
    const line = parseInt(match[3]) || 0;
    const col = parseInt(match[4]) || 0;

    // Resolve path
    if (!path.isAbsolute(filePath)) {
        filePath = path.join(__dirname, 'frontend', filePath);
    }

    const errorKey = `${filePath}:${line}:${col}`;
    if (errorKey === lastError) {
        console.log(`❌ Same error as last iteration, stopping to avoid infinite loop`);
        console.log(`   File: ${filePath}`);
        console.log(`   Line: ${line}, Col: ${col}`);
        console.log(`   Error: ${errorMsg}`);
        break;
    }
    lastError = errorKey;

    console.log(`  File: ${path.basename(filePath)}`);
    console.log(`  Line: ${line}, Col: ${col}`);
    console.log(`  Error: ${errorMsg}`);

    if (!fs.existsSync(filePath)) {
        console.log(`  ❌ File not found: ${filePath}`);
        break;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const hadCRLF = content.includes('\r\n');
    content = content.replace(/\r\n/g, '\n');
    let lines = content.split('\n');

    let fixed = false;

    // ERROR: "Unexpected keyword 'const'" — usually searchTerm or MVP code inside wrong scope
    if (errorMsg.includes("Unexpected keyword 'const'") || errorMsg.includes('Unexpected keyword')) {
        const errorLine = lines[line - 1]?.trim() || '';

        if (/const \[searchTerm/.test(errorLine)) {
            // Remove the searchTerm line
            lines.splice(line - 1, 1);
            fixed = true;
            console.log('  🔧 Removed misplaced searchTerm declaration');
        } else if (/const \{.*hasPermission.*\} = useAuthStore/.test(errorLine)) {
            lines.splice(line - 1, 1);
            fixed = true;
            console.log('  🔧 Removed misplaced useAuthStore destructuring');
        } else if (/const \{.*user.*\} = useAuthStore/.test(errorLine)) {
            lines.splice(line - 1, 1);
            fixed = true;
            console.log('  🔧 Removed misplaced useAuthStore user destructuring');
        } else if (/const hasPermission/.test(errorLine)) {
            lines.splice(line - 1, 1);
            fixed = true;
            console.log('  🔧 Removed misplaced hasPermission declaration');
        } else {
            // Generic: remove the offending line if it starts with const
            if (errorLine.startsWith('const ')) {
                lines.splice(line - 1, 1);
                fixed = true;
                console.log(`  🔧 Removed misplaced const declaration: ${errorLine.substring(0, 60)}`);
            }
        }
    }

    // ERROR: "Missing semicolon" — collapsed statements
    if (errorMsg.includes('Missing semicolon')) {
        const errorLine = lines[line - 1] || '';
        // Try to add semicolons between collapsed calls
        const fixedLine = errorLine
            .replace(/toast\.(success|error)\(([^)]+)\)\s*(set|qc\.|queryClient\.|navigate)/g, 'toast.$1($2);\n                $3')
            .replace(/\}\);\s*(set|qc\.|queryClient\.)/g, '});\n                $1')
            .replace(/\}\)\s*(set|qc\.|queryClient\.)/g, '});\n                $1');

        if (fixedLine !== errorLine) {
            lines[line - 1] = fixedLine;
            fixed = true;
            console.log('  🔧 Fixed collapsed statements (missing semicolon)');
        }
    }

    // ERROR: "Unexpected token" — stray comma, import inside import, etc
    if (errorMsg.includes('Unexpected token')) {
        const errorLine = lines[line - 1]?.trim() || '';

        if (/^\s*,\s*$/.test(lines[line - 1])) {
            lines.splice(line - 1, 1);
            fixed = true;
            console.log('  🔧 Removed stray comma');
        } else if (errorLine.startsWith('import ') && line > 1) {
            const prevLine = lines[line - 2]?.trim() || '';
            if (prevLine.startsWith('import {') && !prevLine.includes('} from')) {
                // Import inside another import
                const importLine = lines[line - 1].trim();
                lines.splice(line - 1, 1);
                // Add at end of imports if not duplicate
                if (!lines.some(l => l.trim() === importLine)) {
                    let lastImport = 0;
                    for (let j = 0; j < lines.length; j++) {
                        if (lines[j].trim().startsWith('import ') && lines[j].includes(' from ')) lastImport = j;
                    }
                    lines.splice(lastImport + 1, 0, importLine);
                }
                fixed = true;
                console.log('  🔧 Moved import out of multi-line import block');
            }
        } else if (/\/\/ MVP:/.test(errorLine) || /\/\/ MVP:/.test(lines[line - 2]?.trim() || '')) {
            // MVP comment followed by invalid code — remove the line
            lines.splice(line - 1, 1);
            fixed = true;
            console.log('  🔧 Removed MVP inject line');
        }
    }

    // ERROR: "'import' and 'export' may only appear at the top level"
    if (errorMsg.includes("'import' and 'export' may only appear at the top level") ||
        errorMsg.includes("'export' may only appear at the top level")) {
        // This usually means braces are mismatched. Hard to auto-fix.
        console.log('  ⚠️ Export/import scope issue — needs manual fix');
        console.log(`  Context around line ${line}:`);
        for (let j = Math.max(0, line - 3); j < Math.min(lines.length, line + 2); j++) {
            console.log(`    ${j + 1}: ${lines[j]}`);
        }
        break;
    }

    if (!fixed) {
        console.log('  ❌ No auto-fix available for this error');
        console.log(`  Error line content: ${(lines[line - 1] || '').trim().substring(0, 100)}`);
        break;
    }

    // Write fixed file
    content = lines.join('\n');
    content = content.replace(/\n{3,}/g, '\n\n');
    if (hadCRLF) content = content.replace(/\n/g, '\r\n');
    fs.writeFileSync(filePath, content, 'utf8');
}

console.log(`\n=== TOTAL ITERATIONS: ${iteration} ===`);
