// RBAC Audit Script — Verifica 5 camadas de permissão
const fs = require('fs');
const path = require('path');

// 1. SEEDER: Extract permissions
const seedDir = 'backend/database/seeders';
const seedFiles = fs.readdirSync(seedDir).filter(f => f.endsWith('.php'));
const permInSeeder = new Set();

for (const f of seedFiles) {
    const content = fs.readFileSync(path.join(seedDir, f), 'utf8');
    // Match permission names like 'module.action'
    const matches = [...content.matchAll(/['"]([a-z][a-z_]*\.[a-z_]+)['"]/g)];
    for (const m of matches) {
        const perm = m[1];
        // Filter out non-permission patterns
        if (!perm.includes('.com') && !perm.includes('.php') && !perm.includes('.js')
            && !perm.includes('.ts') && !perm.includes('.local') && !perm.includes('.env')
            && !perm.includes('.json') && !perm.includes('.csv') && !perm.includes('.pdf')
            && !perm.includes('.br') && !perm.includes('.log')) {
            permInSeeder.add(perm);
        }
    }
}

// 2. ROUTES: Permissions in middleware
const routeContent = fs.readFileSync('backend/routes/api.php', 'utf8');
const routePerms = new Set();
const routeMatches = [...routeContent.matchAll(/permission:([a-z][a-z_]*\.[a-z_]+)/g)];
for (const m of routeMatches) routePerms.add(m[1]);

// 3. CONTROLLERS: $this->authorize() checks
const controllerDir = 'backend/app/Http/Controllers/Api/V1';
const ctrlPerms = new Set();
function scanDir(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) { scanDir(full); continue; }
        if (!item.name.endsWith('.php')) continue;
        const c = fs.readFileSync(full, 'utf8');
        const matches = [...c.matchAll(/authorize\(['"]([a-z][a-z_]*\.[a-z_]+)['"]\)/g)];
        for (const m of matches) ctrlPerms.add(m[1]);
    }
}
scanDir(controllerDir);

// 4. Routes without permission middleware
const routeLines = routeContent.split('\n');
const unprotectedRoutes = [];
let inGroup = false;
let groupHasPerm = false;
for (let i = 0; i < routeLines.length; i++) {
    const line = routeLines[i].trim();
    if (line.includes('Route::group') || line.includes('Route::prefix')) {
        inGroup = true;
        groupHasPerm = line.includes('permission:');
    }
    if (line.match(/Route::(get|post|put|patch|delete)\(/) && !line.includes('login') && !line.includes('logout') && !line.includes('register')) {
        const hasInlinePerm = line.includes('permission:');
        if (!hasInlinePerm && !groupHasPerm) {
            const routeMatch = line.match(/Route::\w+\(['"]([^'"]+)['"]/);
            if (routeMatch) unprotectedRoutes.push({ line: i + 1, route: routeMatch[1] });
        }
    }
}

// OUTPUT
console.log('═══════════════════════════════════════════');
console.log('   AUDITORIA RBAC — 5 CAMADAS');
console.log('═══════════════════════════════════════════\n');

console.log(`📋 Permissões no SEEDER: ${permInSeeder.size}`);
console.log(`🛣️  Permissões nas ROTAS: ${routePerms.size}`);
console.log(`🎛️  Permissões nos CONTROLLERS: ${ctrlPerms.size}\n`);

// Compare Seeder vs Routes
const inSeederNotRoute = [...permInSeeder].filter(p => !routePerms.has(p)).sort();
const inRouteNotSeeder = [...routePerms].filter(p => !permInSeeder.has(p)).sort();
const inRouteNotCtrl = [...routePerms].filter(p => !ctrlPerms.has(p)).sort();

console.log(`🔴 NO SEEDER mas NÃO nas ROTAS: ${inSeederNotRoute.length}`);
if (inSeederNotRoute.length > 0) inSeederNotRoute.slice(0, 30).forEach(p => console.log(`   - ${p}`));

console.log(`\n🔴 NAS ROTAS mas NÃO no SEEDER: ${inRouteNotSeeder.length}`);
if (inRouteNotSeeder.length > 0) inRouteNotSeeder.slice(0, 30).forEach(p => console.log(`   - ${p}`));

console.log(`\n🟡 NAS ROTAS mas NÃO nos CONTROLLERS: ${inRouteNotCtrl.length}`);
if (inRouteNotCtrl.length > 0) inRouteNotCtrl.slice(0, 30).forEach(p => console.log(`   - ${p}`));

console.log(`\n⚠️  ROTAS SEM MIDDLEWARE DE PERMISSÃO: ${unprotectedRoutes.length}`);
if (unprotectedRoutes.length > 0) unprotectedRoutes.slice(0, 30).forEach(r => console.log(`   L${r.line}: ${r.route}`));

// Summary
const total = permInSeeder.size + routePerms.size + ctrlPerms.size;
const issues = inSeederNotRoute.length + inRouteNotSeeder.length + inRouteNotCtrl.length;
console.log(`\n═══════════════════════════════════════════`);
console.log(`   RESULTADO: ${issues} gaps encontrados`);
console.log(`   Seeder: ${permInSeeder.size} | Rotas: ${routePerms.size} | Controllers: ${ctrlPerms.size}`);
console.log(`═══════════════════════════════════════════`);
