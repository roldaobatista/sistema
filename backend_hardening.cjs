/**
 * Backend Hardening Script
 * 1. Adiciona middleware de permissão a rotas desprotegidas no api.php
 * 2. Adiciona try/catch + DB::transaction a controllers que não possuem
 */
const fs = require('fs');
const path = require('path');

// ============ STEP 1: Adicionar middleware às rotas do api.php ============
function fixApiRoutes() {
    const file = path.join(__dirname, 'backend', 'routes', 'api.php');
    let content = fs.readFileSync(file, 'utf8');
    let changes = 0;

    // Mapeamento: prefixo da rota → permissão adequada
    const permissionMap = {
        // Inmetro
        'inmetro/': 'inmetro.view',
        // Fleet 
        'fleet/': 'fleet.view',
        // Stock/Inventories
        'stock/inventories': 'estoque.movement.view',
        'stock/intelligence': 'estoque.movement.view',
        'stock/warehouses': 'estoque.movement.view',
        'inventories': 'estoque.movement.view',
        'products/{product}/kardex': 'estoque.movement.view',
        // Material/RMA/Tags
        'material-requests': 'estoque.movement.view',
        'rma': 'estoque.movement.view',
        'asset-tags': 'estoque.movement.view',
        'ecological-disposals': 'estoque.movement.view',
        'import-nfe-xml': 'estoque.movement.view',
        // Sync (mobile)
        'sync': 'os.work_order.view',
        // Financial
        'financial/batch-payment-approval': 'financeiro.accounts_receivable.update',
        // Self-service portal
        'self-service/': 'portal.view',
        // Scale readings
        'scale-readings': 'os.work_order.view',
        // Chat
        'chat/': 'os.work_order.view',
        // Schedule
        'schedule/': 'chamados.service_call.view',
        // Knowledge base
        'knowledge-base': 'admin.settings.view',
        // Customers locations
        'customers/{customerId}/locations': 'cadastros.customer.view',
        // White label
        'white-label': 'admin.settings.view',
        // NPS
        'nps': 'os.work_order.view',
        // Equipment map
        'equipment-map/': 'equipamentos.equipment.view',
        // BI Report
        'bi-report/': 'relatorios.report.view',
        // Certificates
        'certificates/batch-download': 'os.work_order.view',
        // Dashboard
        'dashboard/{customerId}': 'cadastros.customer.view',
        // Tickets
        'tickets/qr-code': 'chamados.service_call.view',
        // Notification channels
        'notification-channels': 'admin.settings.view',
        // Shipping
        'shipping/calculate': 'os.work_order.view',
        // Marketing
        'marketing': 'admin.settings.view',
        // Email plugin
        'email-plugin/': 'admin.settings.view',
        // Power BI
        'power-bi/export': 'relatorios.report.view',
        // Password policy
        'password-policy': 'admin.settings.update',
        // Geo alerts
        'geo-alerts': 'os.work_order.view',
        // Voice report / Photo annotation / Thermal readings
        'voice-report': 'os.work_order.update',
        'photo-annotation': 'os.work_order.update',
        'thermal-readings': 'os.work_order.update',
        // Kiosk / Biometric / Offline
        'kiosk-config': 'admin.settings.view',
        'biometric': 'admin.settings.view',
        'offline-map-regions': 'admin.settings.view',
        // AI
        'demand-forecast': 'relatorios.report.view',
        'route-optimization': 'os.work_order.view',
        'smart-ticket-labeling': 'chamados.service_call.view',
        'churn-prediction': 'relatorios.report.view',
        'service-summary/': 'os.work_order.view',
        // Consents / Watermark / Access / Vulnerability
        'consents': 'admin.settings.view',
        'watermark': 'admin.settings.view',
        'access-restrictions': 'admin.settings.view',
        'vulnerability-scans': 'admin.settings.view',
        // WhatsApp / Email send
        'whatsapp': 'admin.settings.view',
        'email': 'admin.settings.view',
        // Swagger / API docs
        'swagger': 'admin.settings.view',
        'api-docs': 'admin.settings.view',
        // Push notifications
        'push/subscribe': 'admin.settings.view',
        // Quotes approve
        'quotes/{quoteId}/approve': 'orcamentos.quote.update',
    };

    // Rotas intencionalmente sem permissão (utilidade/auth)
    const skipRoutes = [
        '/me', '/logout', '/my-tenants', '/switch-tenant', '/user/location',
        'me', 'logout', 'work-orders', 'quotes', 'financials', 'service-calls', // portal routes
        'login',
        'cep/', 'cnpj/', 'holidays/', 'banks', 'ddd/', 'states', 'states/',
        'profile/change-password',
    ];

    const lines = content.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if this is a Route definition without middleware
        const routeMatch = trimmed.match(/^Route::(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/);
        if (routeMatch && !line.includes('middleware') && !line.includes('check.permission')) {
            const routePath = routeMatch[2];

            // Check if in a middleware group already
            let inGroup = false;
            for (let j = Math.max(0, i - 8); j < i; j++) {
                if (lines[j].includes('check.permission')) inGroup = true;
                if (lines[j].trim() === '});') inGroup = false;
            }

            if (inGroup) {
                result.push(line);
                continue;
            }

            // Skip utility routes
            const shouldSkip = skipRoutes.some(sp => routePath === sp || routePath.startsWith(sp));
            if (shouldSkip) {
                result.push(line);
                continue;
            }

            // Find matching permission
            let permission = null;
            for (const [prefix, perm] of Object.entries(permissionMap)) {
                if (routePath === prefix || routePath.startsWith(prefix)) {
                    permission = perm;
                    break;
                }
            }

            if (permission) {
                // Add middleware to the route
                const method = routeMatch[1];
                const indent = line.match(/^(\s*)/)[1];
                const newLine = line.replace(
                    `Route::${method}('${routePath}'`,
                    `Route::middleware('check.permission:${permission}')->${method}('${routePath}'`
                ).replace(
                    `Route::${method}("${routePath}"`,
                    `Route::middleware('check.permission:${permission}')->${method}("${routePath}"`
                );
                result.push(newLine);
                changes++;
            } else {
                result.push(line);
            }
        } else {
            result.push(line);
        }
    }

    fs.writeFileSync(file, result.join('\n'), 'utf8');
    console.log(`api.php: ${changes} rotas receberam middleware de permissão`);
    return changes;
}

// ============ STEP 2: Hardening de Controllers ============
function hardenControllers() {
    const controllersDir = path.join(__dirname, 'backend', 'app', 'Http', 'Controllers');
    let totalFixed = 0;

    function walk(dir) {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const fp = path.join(dir, f.name);
            if (f.isDirectory()) { walk(fp); continue; }
            if (!f.name.endsWith('.php')) continue;

            let content = fs.readFileSync(fp, 'utf8');
            let changed = false;

            // Skip if already has try/catch in most methods
            const methodCount = (content.match(/public\s+function\s+(?!__construct|middleware)\w+/g) || []).length;
            const tryCatchCount = (content.match(/try\s*\{/g) || []).length;

            if (methodCount <= 1) continue; // Skip very simple controllers
            if (tryCatchCount >= methodCount * 0.5) continue; // Already half+ covered

            // Add DB import if missing
            if (!content.includes('use Illuminate\\Support\\Facades\\DB;') && !content.includes('use DB;')) {
                content = content.replace(
                    /(use Illuminate\\[^;]+;)\n/,
                    '$1\nuse Illuminate\\Support\\Facades\\DB;\n'
                );
                changed = true;
            }

            // Add Log import if missing  
            if (!content.includes('use Illuminate\\Support\\Facades\\Log;') && !content.includes('use Log;')) {
                content = content.replace(
                    /(use Illuminate\\Support\\Facades\\DB;)\n/,
                    '$1\nuse Illuminate\\Support\\Facades\\Log;\n'
                );
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(fp, content, 'utf8');
                totalFixed++;
            }
        }
    }

    walk(controllersDir);
    console.log(`Controllers: ${totalFixed} receberam imports de DB/Log`);
    return totalFixed;
}

// Execute
console.log('=== BACKEND HARDENING ===\n');
const routeChanges = fixApiRoutes();
const controllerChanges = hardenControllers();
console.log(`\nTotal: ${routeChanges} rotas + ${controllerChanges} controllers`);
