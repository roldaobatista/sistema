/**
 * Script para substituir window.confirm() por estado de confirmação controlado.
 * 
 * Padrões detectados:
 * 1. handleDelete com confirm inline (mais comum, ~30 ocorrências)
 * 2. onClick inline com confirm + mutate
 * 3. confirm em lógica mais complexa
 * 
 * Este script NÃO altera lógica complexa — apenas o padrão simples:
 *   if (window.confirm('...')) mutation.mutate(id)
 * →  
 *   estado confirmDeleteId + confirmDelete()/cancelDelete()
 * 
 * Para os padrões inline em onClick, substitui por set do estado.
 */
const fs = require('fs');
const path = require('path');

// Files com o padrão simples handleDelete que usa window.confirm
const simpleHandleDeleteFiles = [
    // { file, mutationName, queryKey }
    { file: 'src/pages/tech/TechWidgetPage.tsx', mutName: 'deleteMutation', queryKey: 'tech-widgets' },
    { file: 'src/pages/rh/VacationBalancePage.tsx', mutName: 'deleteMutation', queryKey: 'vacation-balance' },
    { file: 'src/pages/rh/PerformancePage.tsx', mutName: 'deleteMutation', queryKey: 'performance' },
    { file: 'src/pages/portal/PortalFinancialsPage.tsx', mutName: 'deleteMutation', queryKey: 'portal-financials' },
    { file: 'src/pages/portal/PortalWorkOrdersPage.tsx', mutName: 'deleteMutation', queryKey: 'portal-work-orders' },
    { file: 'src/pages/operational/checklists/ChecklistPage.tsx', mutName: 'deleteMutation', queryKey: 'checklists' },
    { file: 'src/pages/fleet/FleetPage.tsx', mutName: 'deleteMutation', queryKey: 'fleet' },
    { file: 'src/pages/fleet/components/FleetFinesTab.tsx', mutName: 'deleteMutation', queryKey: 'fleet-fines' },
    { file: 'src/pages/fleet/components/FleetInspectionsTab.tsx', mutName: 'deleteMutation', queryKey: 'fleet-inspections' },
    { file: 'src/pages/fleet/components/VehiclesTab.tsx', mutName: 'deleteMutation', queryKey: 'vehicles' },
    { file: 'src/pages/fleet/components/FleetTiresTab.tsx', mutName: 'deleteMutation', queryKey: 'fleet-tires' },
    { file: 'src/pages/fleet/components/GpsLiveTab.tsx', mutName: 'deleteMutation', queryKey: 'gps-live' },
    { file: 'src/pages/fleet/components/DriverScoreTab.tsx', mutName: 'deleteMutation', queryKey: 'driver-score' },
    { file: 'src/pages/configuracoes/AuditLogsPage.tsx', mutName: 'deleteMutation', queryKey: 'audit-logs' },
    { file: 'src/pages/financeiro/CashFlowPage.tsx', mutName: 'deleteMutation', queryKey: 'cash-flow' },
    { file: 'src/pages/estoque/StockIntelligencePage.tsx', mutName: 'deleteMutation', queryKey: 'stock-intelligence' },
    { file: 'src/pages/estoque/KardexPage.tsx', mutName: 'deleteMutation', queryKey: 'kardex' },
    { file: 'src/pages/estoque/InventoryListPage.tsx', mutName: 'deleteMutation', queryKey: 'inventory' },
    { file: 'src/pages/equipamentos/EquipmentCalendarPage.tsx', mutName: 'deleteMutation', queryKey: 'equipment-calendar' },
    { file: 'src/pages/admin/AuditLogPage.tsx', mutName: 'deleteMutation', queryKey: 'audit-log' },
    { file: 'src/pages/chamados/TechnicianAgendaPage.tsx', mutName: 'deleteMutation', queryKey: 'technician-agenda' },
    { file: 'src/pages/chamados/ServiceCallMapPage.tsx', mutName: 'deleteMutation', queryKey: 'service-call-map' },
    { file: 'src/pages/cadastros/PriceHistoryPage.tsx', mutName: 'deleteMutation', queryKey: 'price-history' },
    { file: 'src/pages/financeiro/CommissionDashboardPage.tsx', mutName: 'deleteMutation', queryKey: 'commission-dashboard' },
];

const frontendDir = path.join(__dirname, 'frontend');
let totalFixed = 0;

for (const { file, mutName } of simpleHandleDeleteFiles) {
    const filePath = path.join(frontendDir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠ File not found: ${file}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Pattern 1: const handleDelete = (id: number) => { if (window.confirm('...')) deleteMutation.mutate(id) }
    const pattern1 = /const handleDelete = \(id: number\) => \{ if \(window\.confirm\('[^']*'\)\) (\w+)\.mutate\(id\) \}/;

    if (pattern1.test(content)) {
        const match = content.match(pattern1);
        const actualMutName = match[1];

        // Add confirmDeleteId state after the mutation definition
        // First check if it already exists
        if (content.includes('confirmDeleteId')) {
            console.log(`⏩ Already fixed: ${file}`);
            continue;
        }

        // Replace handleDelete
        content = content.replace(
            pattern1,
            `const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)\n  const handleDelete = (id: number) => { setConfirmDeleteId(id) }\n  const confirmDelete = () => { if (confirmDeleteId !== null) { ${actualMutName}.mutate(confirmDeleteId); setConfirmDeleteId(null) } }`
        );

        fs.writeFileSync(filePath, content, 'utf8');
        totalFixed++;
        console.log(`✅ Fixed: ${file}`);
    } else {
        // Pattern 2: multiline or slight variations
        const pattern2 = /if \(window\.confirm\('Tem certeza que deseja remover\?'\)\) (\w+)\.mutate\(id\)/;
        if (pattern2.test(content) && !content.includes('confirmDeleteId')) {
            const match = content.match(pattern2);
            const actualMutName = match[1];

            content = content.replace(
                pattern2,
                `setConfirmDeleteId(id)`
            );

            // Add state at first useState occurrence
            const firstUseState = content.indexOf('useState(');
            if (firstUseState !== -1) {
                const lineStart = content.lastIndexOf('\n', firstUseState);
                const indent = '  ';
                content = content.slice(0, lineStart + 1) +
                    `${indent}const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)\n` +
                    `${indent}const confirmDelete = () => { if (confirmDeleteId !== null) { ${actualMutName}.mutate(confirmDeleteId); setConfirmDeleteId(null) } }\n` +
                    content.slice(lineStart + 1);
            }

            fs.writeFileSync(filePath, content, 'utf8');
            totalFixed++;
            console.log(`✅ Fixed (v2): ${file}`);
        } else {
            console.log(`⏩ Pattern not matched: ${file}`);
        }
    }
}

console.log(`\n=== Total fixed: ${totalFixed} files ===`);
