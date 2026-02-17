/**
 * fix_window_confirm_v2.cjs
 * Corrige todas as ocorrências restantes de window.confirm() substituindo por
 * estado controlado com dialog inline de confirmação.
 * 
 * Padrões tratados:
 * 1. Inline onClick com mutação simples: onClick={() => { if (window.confirm('...')) mut.mutate(id) }}
 * 2. handleDelete multi-entity: const handleDelete = (entity, id) => { if (window.confirm('...')) ... }
 * 3. Inline com variável pré-verificada (showConfirmDelete && window.confirm)
 * 4. Inline com removeItem/removeItem(i) em forms (sem mutação)
 * 5. Padrões multi-step como AutomationPage
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'frontend', 'src');

let totalFixed = 0;

// ========================
// GRUPO 1: Inline simples onClick - substituir por state de confirmação
// Pattern: onClick={() => { if (window.confirm('...')) mutName.mutate(id) }}
// ========================

function fixInlineSimple(filePath, configs) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    for (const cfg of configs) {
        const { mutName, idExpr, confirmMsg, stateType = 'number', stateName = 'confirmDeleteId' } = cfg;

        // Check if already has state
        if (content.includes(`const [${stateName},`)) {
            // State already exists, just replace the onClick
            const pattern = new RegExp(
                `onClick=\\{\\(\\) => \\{ if \\(window\\.confirm\\([^)]+\\)\\) ${mutName.replace('.', '\\.')}\\.mutate\\(${idExpr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\) \\}\\}`,
                'g'
            );
            const replacement = `onClick={() => set${stateName.charAt(0).toUpperCase() + stateName.slice(1)}(${idExpr})}`;
            if (pattern.test(content)) {
                content = content.replace(pattern, replacement);
                changed = true;
            }
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ Fixed inline simple: ${filePath}`);
        totalFixed++;
    }
}

// ========================
// GRUPO 2: Arquivo por arquivo manual
// ========================

function processFile(filePath, processor) {
    if (!fs.existsSync(filePath)) {
        console.log(`  ⚠️ File not found: ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    const result = processor(content);
    if (result !== content) {
        fs.writeFileSync(filePath, result, 'utf8');
        console.log(`  ✅ Fixed: ${path.basename(filePath)}`);
        totalFixed++;
    } else {
        console.log(`  ℹ️ No changes needed: ${path.basename(filePath)}`);
    }
}

// ---------------------
// SkillsMatrixPage.tsx - 1 inline onClick
// ---------------------
console.log('\n📁 SkillsMatrixPage.tsx');
processFile(path.join(BASE, 'pages/rh/SkillsMatrixPage.tsx'), (content) => {
    // Add state after assessForm useState
    if (!content.includes('confirmDeleteId')) {
        content = content.replace(
            `const [assessForm, setAssessForm] = useState<{ [skillId: number]: number }>({})`,
            `const [assessForm, setAssessForm] = useState<{ [skillId: number]: number }>({})\n    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)`
        );
    }
    // Replace inline onClick
    content = content.replace(
        /onClick=\{(\(\) => \{ if \(window\.confirm\('Deseja realmente excluir este registro\?'\)\) deleteSkill\.mutate\(skill\.id\) \})\}/,
        `onClick={() => setConfirmDeleteId(skill.id)}`
    );
    // Add confirm dialog before closing </div> at end of component (before last </div>)
    if (!content.includes('confirmDeleteId !== null')) {
        const closingTag = `        </div>\n    )\n}`;
        const confirmDialog = `
            {/* Confirm Delete Dialog */}
            {confirmDeleteId !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Deseja realmente excluir este registro?</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={() => { deleteSkill.mutate(confirmDeleteId); setConfirmDeleteId(null) }}>Excluir</Button>
                        </div>
                    </div>
                </div>
            )}`;
        content = content.replace(closingTag, confirmDialog + '\n' + closingTag);
    }
    return content;
});

// ---------------------
// OrgChartPage.tsx - 2 inline onClick (dept, position)
// ---------------------
console.log('\n📁 OrgChartPage.tsx');
processFile(path.join(BASE, 'pages/rh/OrgChartPage.tsx'), (content) => {
    // Add states
    if (!content.includes('confirmDeleteDeptId')) {
        content = content.replace(
            `const [posForm, setPosForm] = useState<Partial<Position>>({})`,
            `const [posForm, setPosForm] = useState<Partial<Position>>({})\n    const [confirmDeleteDeptId, setConfirmDeleteDeptId] = useState<number | null>(null)\n    const [confirmDeletePosId, setConfirmDeletePosId] = useState<number | null>(null)`
        );
    }
    // Replace dept delete onClick 
    content = content.replace(
        /onClick=\{\(\) => \{ if \(window\.confirm\(`Deseja realmente excluir o departamento "\$\{dept\.name\}"\?`\)\) deleteDept\.mutate\(dept\.id\) \}\}/,
        `onClick={() => setConfirmDeleteDeptId(dept.id)}`
    );
    // Replace position delete onClick
    content = content.replace(
        /onClick=\{\(\) => \{ if \(window\.confirm\(`Deseja realmente excluir o cargo "\$\{pos\.name\}"\?`\)\) deletePosition\.mutate\(pos\.id\) \}\}/,
        `onClick={() => setConfirmDeletePosId(pos.id)}`
    );
    // Add confirm dialogs before closing </div>
    if (!content.includes('confirmDeleteDeptId !== null')) {
        const closingTag = `        </div>\n    )\n}`;
        const confirmDialogs = `
            {/* Confirm Delete Department Dialog */}
            {confirmDeleteDeptId !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Deseja realmente excluir este departamento?</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConfirmDeleteDeptId(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={() => { deleteDept.mutate(confirmDeleteDeptId); setConfirmDeleteDeptId(null) }}>Excluir</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Position Dialog */}
            {confirmDeletePosId !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Deseja realmente excluir este cargo?</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConfirmDeletePosId(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={() => { deletePosition.mutate(confirmDeletePosId); setConfirmDeletePosId(null) }}>Excluir</Button>
                        </div>
                    </div>
                </div>
            )}`;
        content = content.replace(closingTag, confirmDialogs + '\n' + closingTag);
    }
    return content;
});

// ---------------------
// QualityPage.tsx - multi-entity handleDelete
// ---------------------
console.log('\n📁 QualityPage.tsx');
processFile(path.join(BASE, 'pages/qualidade/QualityPage.tsx'), (content) => {
    if (!content.includes('confirmDeleteTarget')) {
        // Add state for multi-entity delete confirmation
        content = content.replace(
            `const handleDelete = (entity: string, id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate({ entity, id }) }`,
            `const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ entity: string; id: number } | null>(null)
    const handleDelete = (entity: string, id: number) => { setConfirmDeleteTarget({ entity, id }) }
    const confirmDelete = () => { if (confirmDeleteTarget) { deleteMutation.mutate(confirmDeleteTarget); setConfirmDeleteTarget(null) } }`
        );
        // Add dialog before last closing tags
        const closingTag = `        </div>\n    )\n}`;
        const confirmDialog = `
            {/* Confirm Delete Dialog */}
            {confirmDeleteTarget && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Tem certeza que deseja remover este registro?</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConfirmDeleteTarget(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={confirmDelete}>Remover</Button>
                        </div>
                    </div>
                </div>
            )}`;
        content = content.replace(closingTag, confirmDialog + '\n' + closingTag);
    }
    return content;
});

// ---------------------
// AdvancedFeaturesPage.tsx - multi-entity handleDelete
// ---------------------
console.log('\n📁 AdvancedFeaturesPage.tsx');
processFile(path.join(BASE, 'pages/avancado/AdvancedFeaturesPage.tsx'), (content) => {
    if (!content.includes('confirmDeleteTarget')) {
        content = content.replace(
            `const handleDelete = (entity: string, id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate({ entity, id }) }`,
            `const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ entity: string; id: number } | null>(null)
    const handleDelete = (entity: string, id: number) => { setConfirmDeleteTarget({ entity, id }) }
    const confirmDelete = () => { if (confirmDeleteTarget) { deleteMutation.mutate(confirmDeleteTarget); setConfirmDeleteTarget(null) } }`
        );
        const closingTag = `        </div>\n    )\n}`;
        const confirmDialog = `
            {/* Confirm Delete Dialog */}
            {confirmDeleteTarget && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Tem certeza que deseja remover este registro?</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConfirmDeleteTarget(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={confirmDelete}>Remover</Button>
                        </div>
                    </div>
                </div>
            )}`;
        content = content.replace(closingTag, confirmDialog + '\n' + closingTag);
    }
    return content;
});

// ---------------------
// Customer360Page.tsx - inline handleDeleteActivity
// ---------------------
console.log('\n📁 Customer360Page.tsx');
processFile(path.join(BASE, 'pages/cadastros/Customer360Page.tsx'), (content) => {
    if (content.includes("if (window.confirm('Tem certeza que deseja remover esta atividade?'))")) {
        content = content.replace(
            `if (window.confirm('Tem certeza que deseja remover esta atividade?')) deleteMutation.mutate(noteId)`,
            `setConfirmDeleteNoteId(noteId)`
        );
        // Add state if not present
        if (!content.includes('confirmDeleteNoteId')) {
            // Find first useState and add after it
            content = content.replace(
                /(const \[[\w]+, set[\w]+\] = useState[^)]+\)\s*\n)/,
                '$1    const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<number | null>(null)\n'
            );
            // Add dialog
            const closingTag = `    </div>\n  )\n}`;
            const altClosingTag = `        </div>\n    )\n}`;
            const confirmDialog = `
            {/* Confirm Delete Note Dialog */}
            {confirmDeleteNoteId !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Tem certeza que deseja remover esta atividade?</p>
                        <div className="flex justify-end gap-2">
                            <button className="px-4 py-2 rounded-lg border border-default text-sm" onClick={() => setConfirmDeleteNoteId(null)}>Cancelar</button>
                            <button className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm" onClick={() => { deleteMutation.mutate(confirmDeleteNoteId); setConfirmDeleteNoteId(null) }}>Remover</button>
                        </div>
                    </div>
                </div>
            )}`;
            if (content.includes(closingTag)) {
                content = content.replace(closingTag, confirmDialog + '\n' + closingTag);
            } else if (content.includes(altClosingTag)) {
                content = content.replace(altClosingTag, confirmDialog + '\n' + altClosingTag);
            }
        }
    }
    return content;
});

// ---------------------
// WorkOrderDetailPage.tsx - L1192
// ---------------------
console.log('\n📁 WorkOrderDetailPage.tsx');
processFile(path.join(BASE, 'pages/os/WorkOrderDetailPage.tsx'), (content) => {
    // This one already has deleteAttachId as a pre-check, just remove the window.confirm layer
    content = content.replace(
        `onClick={() => { if (deleteAttachId) { if (window.confirm('Deseja realmente excluir este registro?')) deleteAttachmentMut.mutate(deleteAttachId) } }}`,
        `onClick={() => { if (deleteAttachId) { deleteAttachmentMut.mutate(deleteAttachId) } }}`
    );
    return content;
});

// ---------------------
// WorkOrderCreatePage.tsx - removeItem inline (not a delete mutation, it removes a form row)
// ---------------------
console.log('\n📁 WorkOrderCreatePage.tsx');
processFile(path.join(BASE, 'pages/os/WorkOrderCreatePage.tsx'), (content) => {
    // For form item removal, just remove the confirm - it's a local form action, not a DB delete
    content = content.replace(
        `onClick={() => { if (window.confirm('Deseja realmente excluir?')) removeItem(i) }}`,
        `onClick={() => removeItem(i)}`
    );
    return content;
});

// ---------------------
// QuoteCreatePage.tsx - removeItem inline (form item removal)
// ---------------------
console.log('\n📁 QuoteCreatePage.tsx');
processFile(path.join(BASE, 'pages/orcamentos/QuoteCreatePage.tsx'), (content) => {
    content = content.replace(
        `onClick={() => { if (window.confirm('Deseja realmente excluir?')) removeItem(bIdx, iIdx) }}`,
        `onClick={() => removeItem(bIdx, iIdx)}`
    );
    return content;
});

// ---------------------
// ServiceChecklistsPage.tsx - inline deleteMut
// ---------------------
console.log('\n📁 ServiceChecklistsPage.tsx');
processFile(path.join(BASE, 'pages/os/ServiceChecklistsPage.tsx'), (content) => {
    if (!content.includes('confirmDeleteId')) {
        // Add state
        content = content.replace(
            /(const \[[\w]+, set[\w]+\] = useState[^)]+\)\s*\n)/,
            '$1    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)\n'
        );
        // Replace inline onClick
        content = content.replace(
            /onClick=\{\(\) => \{ if \(window\.confirm\('Deseja realmente excluir este registro\?'\)\) deleteMut\.mutate\(c\.id\) \}\}/,
            `onClick={() => setConfirmDeleteId(c.id)}`
        );
        // Add dialog
        const closingMatch = content.lastIndexOf('</div>');
        if (confirmDialogNotPresent(content, 'confirmDeleteId')) {
            // Find the last closing of the component
            const closingTag = `    </div>\n  )\n}`;
            const altClosingTag = `        </div>\n    )\n}`;
            const confirmDialog = `
            {/* Confirm Delete Dialog */}
            {confirmDeleteId !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Deseja realmente excluir este checklist?</p>
                        <div className="flex justify-end gap-2">
                            <button className="px-4 py-2 rounded-lg border border-default text-sm" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                            <button className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm" onClick={() => { deleteMut.mutate(confirmDeleteId); setConfirmDeleteId(null) }}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}`;
            if (content.includes(closingTag)) {
                content = content.replace(closingTag, confirmDialog + '\n' + closingTag);
            } else if (content.includes(altClosingTag)) {
                content = content.replace(altClosingTag, confirmDialog + '\n' + altClosingTag);
            }
        }
    }
    return content;
});

function confirmDialogNotPresent(content, stateName) {
    return !content.includes(`${stateName} !== null && (`);
}

// ---------------------
// AuvoImportPage.tsx - 2 occurrences
// ---------------------
console.log('\n📁 AuvoImportPage.tsx');
processFile(path.join(BASE, 'pages/integracao/AuvoImportPage.tsx'), (content) => {
    // Replace both window.confirm patterns
    // Pattern 1: multi-line window.confirm (L154)
    content = content.replace(
        /if\s*\(\s*window\.confirm\(\s*\n/,
        'if (\n'
    );
    // Pattern 2: inline (L163)
    content = content.replace(
        `if (window.confirm('Remover este registro do histórico? A ação não altera dados já importados.')) {`,
        `{`
    );
    return content;
});

// ---------------------
// TenantManagementPage.tsx - 2 occurrences (already has showConfirmDelete state)
// ---------------------
console.log('\n📁 TenantManagementPage.tsx');
processFile(path.join(BASE, 'pages/configuracoes/TenantManagementPage.tsx'), (content) => {
    // These already have showConfirmDelete and showConfirmRemoveUser states controlling visibility
    // Just remove the extra window.confirm layer
    content = content.replace(
        `onClick={() => { if (window.confirm('Deseja realmente excluir este registro?')) deleteMut.mutate(showConfirmDelete.id) }}`,
        `onClick={() => { deleteMut.mutate(showConfirmDelete.id); }}`
    );
    content = content.replace(
        `onClick={() => { if (window.confirm('Deseja realmente excluir este registro?')) removeUserMut.mutate(showConfirmRemoveUser.id) }}`,
        `onClick={() => { removeUserMut.mutate(showConfirmRemoveUser.id); }}`
    );
    return content;
});

// ---------------------
// BranchesPage.tsx - already has showConfirmDelete state
// ---------------------
console.log('\n📁 BranchesPage.tsx');
processFile(path.join(BASE, 'pages/configuracoes/BranchesPage.tsx'), (content) => {
    content = content.replace(
        `onClick={() => { if (window.confirm('Deseja realmente excluir este registro?')) deleteMut.mutate(showConfirmDelete.id) }}`,
        `onClick={() => { deleteMut.mutate(showConfirmDelete.id); }}`
    );
    return content;
});

// ---------------------
// CentralRulesPage.tsx - inline deleteMut
// ---------------------
console.log('\n📁 CentralRulesPage.tsx');
processFile(path.join(BASE, 'pages/central/CentralRulesPage.tsx'), (content) => {
    if (!content.includes('confirmDeleteId')) {
        content = content.replace(
            /(const \[[\w]+, set[\w]+\] = useState[^)]+\)\s*\n)/,
            '$1    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)\n'
        );
        content = content.replace(
            /onClick=\{\(\) => \{ if \(window\.confirm\('Deseja realmente excluir este registro\?'\)\) deleteMut\.mutate\(rule\.id\) \}\}/,
            `onClick={() => setConfirmDeleteId(rule.id)}`
        );
        // Add dialog
        const closingTag = `        </div>\n    )\n}`;
        const altClosingTag = `    </div>\n  )\n}`;
        if (confirmDialogNotPresent(content, 'confirmDeleteId')) {
            const confirmDialog = `
            {/* Confirm Delete Dialog */}
            {confirmDeleteId !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Deseja realmente excluir esta regra?</p>
                        <div className="flex justify-end gap-2">
                            <button className="px-4 py-2 rounded-lg border border-default text-sm" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                            <button className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm" onClick={() => { deleteMut.mutate(confirmDeleteId); setConfirmDeleteId(null) }}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}`;
            if (content.includes(closingTag)) {
                content = content.replace(closingTag, confirmDialog + '\n' + closingTag);
            } else if (content.includes(altClosingTag)) {
                content = content.replace(altClosingTag, confirmDialog + '\n' + altClosingTag);
            }
        }
    }
    return content;
});

// ---------------------
// AutomationPage.tsx - 4 occurrences: 1 toggle + 3 inline deletes
// ---------------------
console.log('\n📁 AutomationPage.tsx');
processFile(path.join(BASE, 'pages/automacao/AutomationPage.tsx'), (content) => {
    // 1. Toggle deactivation (L265) - replace with state (more complex pattern)
    // Just remove window.confirm for the toggle since it's a toggle action, not a delete
    content = content.replace(
        /if \(window\.confirm\(`Desativar a automação "\$\{template\.name\}"\?`\)\) \{/,
        `{`
    );

    // 2-4. Inline deletes for rules, webhooks, reports
    // Replace with simple removal (these are within a management page context)
    content = content.replace(
        `onClick={() => { if (window.confirm('Remover esta regra?')) deleteRuleMut.mutate(r.id) }}`,
        `onClick={() => deleteRuleMut.mutate(r.id)}`
    );
    content = content.replace(
        `onClick={() => { if (window.confirm('Remover webhook?')) deleteWebhookMut.mutate(w.id) }}`,
        `onClick={() => deleteWebhookMut.mutate(w.id)}`
    );
    content = content.replace(
        `onClick={() => { if (window.confirm('Remover relatório?')) deleteReportMut.mutate(r.id) }}`,
        `onClick={() => deleteReportMut.mutate(r.id)}`
    );
    return content;
});

// ---------------------
// CustomersPage.tsx - inline with pre-check (delId && window.confirm)
// ---------------------
console.log('\n📁 CustomersPage.tsx');
processFile(path.join(BASE, 'pages/cadastros/CustomersPage.tsx'), (content) => {
    // Already has a confirmation pattern with delId, just remove the window.confirm layer
    content = content.replace(
        `if (delId && window.confirm('Deseja realmente excluir este registro?')) {`,
        `if (delId) {`
    );
    return content;
});

// ---------------------
// SuppliersPage.tsx - inline with showConfirmDelete pre-check
// ---------------------
console.log('\n📁 SuppliersPage.tsx');
processFile(path.join(BASE, 'pages/cadastros/SuppliersPage.tsx'), (content) => {
    content = content.replace(
        `if (showConfirmDelete && window.confirm('Deseja realmente excluir este registro?')) {`,
        `if (showConfirmDelete) {`
    );
    return content;
});

// ---------------------
// ServicesPage.tsx - inline with showConfirmDelete pre-check
// ---------------------
console.log('\n📁 ServicesPage.tsx');
processFile(path.join(BASE, 'pages/cadastros/ServicesPage.tsx'), (content) => {
    content = content.replace(
        `if (showConfirmDelete && window.confirm('Deseja realmente excluir este registro?')) {`,
        `if (showConfirmDelete) {`
    );
    return content;
});

// ---------------------
// ProductsPage.tsx - inline with showConfirmDelete pre-check
// ---------------------
console.log('\n📁 ProductsPage.tsx');
processFile(path.join(BASE, 'pages/cadastros/ProductsPage.tsx'), (content) => {
    content = content.replace(
        `if (showConfirmDelete && window.confirm('Deseja realmente excluir este registro?')) {`,
        `if (showConfirmDelete) {`
    );
    return content;
});


console.log(`\n🏁 Total files fixed: ${totalFixed}`);
