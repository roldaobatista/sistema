const fs = require('fs');
const path = require('path');

// Check what the MVP blocks look like in the remaining files
const remaining = [
    'LoginPage.tsx', 'emails/EmailComposePage.tsx', 'emails/EmailInboxPage.tsx',
    'emails/EmailSettingsPage.tsx', 'financeiro/FuelingLogsPage.tsx',
    'fleet/components/FuelComparisonTab.tsx', 'ia/AIAnalyticsPage.tsx',
    'inmetro/InmetroCompetitorPage.tsx', 'inmetro/InmetroCompetitorsPage.tsx',
    'inmetro/InmetroCompliancePage.tsx', 'inmetro/InmetroExecutivePage.tsx',
    'inmetro/InmetroImportPage.tsx', 'inmetro/InmetroInstrumentsPage.tsx',
    'inmetro/InmetroMapPage.tsx', 'inmetro/InmetroMarketPage.tsx',
    'inmetro/InmetroOwnerEditModal.tsx', 'inmetro/InmetroProspectionPage.tsx',
    'inmetro/InmetroStatusUpdateModal.tsx', 'inmetro/InmetroWebhooksPage.tsx',
    'rh/AccountingReportsPage.tsx', 'rh/OrgChartPage.tsx',
    'rh/PerformanceReviewDetailPage.tsx', 'rh/RecruitmentKanbanPage.tsx',
    'rh/RecruitmentPage.tsx', 'rh/SkillsMatrixPage.tsx',
    'tech/TechChatPage.tsx', 'tech/TechWorkOrdersPage.tsx'
];

const basePath = 'frontend/src/pages/';

for (const rel of remaining.slice(0, 5)) {
    const file = basePath + rel;
    const c = fs.readFileSync(file, 'utf8');
    const lines = c.split(/\r?\n/);

    // Find the MVP block start
    for (let i = 0; i < lines.length; i++) {
        if (/\/\/ MVP: Data fetching/.test(lines[i])) {
            console.log(`\n=== ${rel} (start at line ${i + 1}) ===`);
            // Show 20 lines after the marker
            for (let j = i; j < Math.min(i + 25, lines.length); j++) {
                console.log(`  ${j + 1}: ${lines[j]}`);
            }
            break;
        }
    }
}
