import { describe, it, expect } from 'vitest'

// Inline copies of the pure functions from App.tsx to test in isolation
// without importing the entire component tree and its 80+ page imports.

const routePermissionRules: Array<{ match: string; permission: string | null }> = [
    { match: '/central/regras', permission: 'central.manage.rules' },
    { match: '/central/dashboard', permission: 'central.manage.kpis' },
    { match: '/central', permission: 'central.item.view' },
    { match: '/iam/usuarios', permission: 'iam.user.view' },
    { match: '/iam/roles', permission: 'iam.role.view' },
    { match: '/iam/permissoes', permission: 'iam.role.view' },
    { match: '/admin/audit-log', permission: 'iam.audit_log.view' },
    { match: '/cadastros/clientes/fusao', permission: 'cadastros.customer.update' },
    { match: '/cadastros/clientes', permission: 'cadastros.customer.view' },
    { match: '/cadastros/produtos', permission: 'cadastros.product.view' },
    { match: '/cadastros/serviços', permission: 'cadastros.service.view' },
    { match: '/cadastros/histórico-precos', permission: 'cadastros.product.view' },
    { match: '/cadastros/exportação-lote', permission: 'cadastros.customer.view' },
    { match: '/cadastros/fornecedores', permission: 'cadastros.supplier.view' },
    { match: '/orçamentos/novo', permission: 'quotes.quote.create' },
    { match: '/chamados/novo', permission: 'service_calls.service_call.create' },
    { match: '/equipamentos/novo', permission: 'equipments.equipment.create' },
    { match: '/inmetro/instrumentos', permission: 'inmetro.intelligence.view' },
    { match: '/inmetro/importação', permission: 'inmetro.intelligence.import' },
    { match: '/orçamentos/', permission: 'quotes.quote.view' },
    { match: '/orçamentos', permission: 'quotes.quote.view' },
    { match: '/chamados', permission: 'service_calls.service_call.view' },
    { match: '/os/nova', permission: 'os.work_order.create' },
    { match: '/os', permission: 'os.work_order.view' },
    { match: '/técnicos/agenda', permission: 'technicians.schedule.view' },
    { match: '/técnicos/apontamentos', permission: 'technicians.time_entry.view' },
    { match: '/técnicos/caixa', permission: 'technicians.cashbox.view' },
    { match: '/financeiro/receber', permission: 'finance.receivable.view' },
    { match: '/financeiro/pagar', permission: 'finance.payable.view' },
    { match: '/financeiro/comissões/dashboard', permission: 'commissions.rule.view' },
    { match: '/financeiro/comissões', permission: 'commissions.rule.view' },
    { match: '/financeiro/despesas', permission: 'expenses.expense.view' },
    { match: '/financeiro/pagamentos', permission: 'finance.receivable.view|finance.payable.view' },
    { match: '/financeiro/formas-pagamento', permission: 'finance.payable.view' },
    { match: '/financeiro/fluxo-caixa', permission: 'finance.cashflow.view' },
    { match: '/financeiro/faturamento', permission: 'finance.receivable.view' },
    { match: '/financeiro/conciliacao-bancaria', permission: 'finance.receivable.view' },
    { match: '/financeiro/plano-contas', permission: 'finance.chart.view' },
    { match: '/financeiro/categorias-pagar', permission: 'finance.payable.view' },
    { match: '/estoque', permission: 'estoque.movement.view' },
    { match: '/relatórios', permission: 'reports.os_report.view' },
    { match: '/notificações', permission: 'notifications.notification.view' },
    { match: '/importação', permission: 'import.data.view' },
    { match: '/inmetro', permission: 'inmetro.intelligence.view' },
    { match: '/equipamentos', permission: 'equipments.equipment.view' },
    { match: '/agenda-calibracoes', permission: 'equipments.equipment.view' },
    { match: '/configurações/filiais', permission: 'platform.branch.view' },
    { match: '/configurações/empresas', permission: 'platform.tenant.view' },
    { match: '/configurações/auditoria', permission: 'iam.audit_log.view' },
    { match: '/configurações', permission: 'platform.settings.view' },
    { match: '/crm/pipeline', permission: 'crm.pipeline.view' },
    { match: '/crm/clientes', permission: 'crm.deal.view' },
    { match: '/crm/templates', permission: 'crm.message.view' },
    { match: '/crm', permission: 'crm.deal.view' },
    { match: '/perfil', permission: null },
    { match: '/', permission: 'platform.dashboard.view' },
]

function resolveRequiredPermission(pathname: string): string | null {
    if (/^\/orcamentos\/[^/]+\/editar$/.test(pathname)) {
        return 'quotes.quote.update'
    }
    for (const rule of routePermissionRules) {
        if (rule.match === pathname) return rule.permission
        if (rule.match !== '/' && rule.match.endsWith('/') && pathname.startsWith(rule.match)) {
            return rule.permission
        }
        if (rule.match !== '/' && !rule.match.endsWith('/') && pathname.startsWith(`${rule.match}/`)) {
            return rule.permission
        }
    }
    return null
}

function hasPermissionExpression(
    expression: string,
    hasPermission: (permission: string) => boolean
): boolean {
    return expression
        .split('|')
        .map(item => item.trim())
        .filter(Boolean)
        .some(permission => hasPermission(permission))
}

// =============================================================================
// resolveRequiredPermission
// =============================================================================

describe('resolveRequiredPermission', () => {
    it('returns exact match permission for known routes', () => {
        expect(resolveRequiredPermission('/cadastros/clientes')).toBe('cadastros.customer.view')
        expect(resolveRequiredPermission('/os')).toBe('os.work_order.view')
        expect(resolveRequiredPermission('/financeiro/receber')).toBe('finance.receivable.view')
        expect(resolveRequiredPermission('/relatórios')).toBe('reports.os_report.view')
    })

    it('returns null for /perfil (public authenticated route)', () => {
        expect(resolveRequiredPermission('/perfil')).toBeNull()
    })

    it('returns dashboard permission for root /', () => {
        expect(resolveRequiredPermission('/')).toBe('platform.dashboard.view')
    })

    it('returns null for unknown routes', () => {
        expect(resolveRequiredPermission('/rota-que-nao-existe')).toBeNull()
    })

    it('resolves /orcamentos/:id/editar via regex to quotes.quote.update', () => {
        expect(resolveRequiredPermission('/orcamentos/123/editar')).toBe('quotes.quote.update')
        expect(resolveRequiredPermission('/orcamentos/abc/editar')).toBe('quotes.quote.update')
    })

    it('resolves sub-paths correctly using startsWith', () => {
        // /cadastros/clientes matches, so /cadastros/clientes/123 should also match
        expect(resolveRequiredPermission('/cadastros/clientes/123')).toBe('cadastros.customer.view')
        expect(resolveRequiredPermission('/os/123')).toBe('os.work_order.view')
        expect(resolveRequiredPermission('/crm/pipeline/5')).toBe('crm.pipeline.view')
    })

    it('respects rule ordering — more specific rules first', () => {
        // /central/regras is listed BEFORE /central, so it should match the more specific rule
        expect(resolveRequiredPermission('/central/regras')).toBe('central.manage.rules')
        expect(resolveRequiredPermission('/central/dashboard')).toBe('central.manage.kpis')
        expect(resolveRequiredPermission('/central')).toBe('central.item.view')
    })

    it('resolves /financeiro/comissões/dashboard before /financeiro/comissões', () => {
        expect(resolveRequiredPermission('/financeiro/comissões/dashboard')).toBe('commissions.rule.view')
        expect(resolveRequiredPermission('/financeiro/comissões')).toBe('commissions.rule.view')
    })

    it('resolves /cadastros/clientes/fusao before /cadastros/clientes', () => {
        expect(resolveRequiredPermission('/cadastros/clientes/fusao')).toBe('cadastros.customer.update')
    })

    it('resolves /orçamentos/novo (create) vs /orçamentos (view)', () => {
        expect(resolveRequiredPermission('/orçamentos/novo')).toBe('quotes.quote.create')
        expect(resolveRequiredPermission('/orçamentos')).toBe('quotes.quote.view')
    })

    it('resolves all INMETRO routes correctly', () => {
        expect(resolveRequiredPermission('/inmetro')).toBe('inmetro.intelligence.view')
        expect(resolveRequiredPermission('/inmetro/instrumentos')).toBe('inmetro.intelligence.view')
        expect(resolveRequiredPermission('/inmetro/importação')).toBe('inmetro.intelligence.import')
    })

    it('resolves all equipment routes', () => {
        expect(resolveRequiredPermission('/equipamentos')).toBe('equipments.equipment.view')
        expect(resolveRequiredPermission('/equipamentos/novo')).toBe('equipments.equipment.create')
        expect(resolveRequiredPermission('/agenda-calibracoes')).toBe('equipments.equipment.view')
    })

    it('resolves all settings routes', () => {
        expect(resolveRequiredPermission('/configurações')).toBe('platform.settings.view')
        expect(resolveRequiredPermission('/configurações/filiais')).toBe('platform.branch.view')
        expect(resolveRequiredPermission('/configurações/empresas')).toBe('platform.tenant.view')
    })
})

// =============================================================================
// hasPermissionExpression
// =============================================================================

describe('hasPermissionExpression', () => {
    it('returns true for single matching permission', () => {
        const has = (p: string) => p === 'finance.receivable.view'
        expect(hasPermissionExpression('finance.receivable.view', has)).toBe(true)
    })

    it('returns false for single non-matching permission', () => {
        const has = () => false
        expect(hasPermissionExpression('finance.receivable.view', has)).toBe(false)
    })

    it('returns true if ANY of the OR permissions match (pipe-separated)', () => {
        const has = (p: string) => p === 'finance.payable.view'
        expect(hasPermissionExpression('finance.receivable.view|finance.payable.view', has)).toBe(true)
    })

    it('returns false if NONE of the OR permissions match', () => {
        const has = () => false
        expect(hasPermissionExpression('finance.receivable.view|finance.payable.view', has)).toBe(false)
    })

    it('trims whitespace in expressions', () => {
        const has = (p: string) => p === 'a'
        expect(hasPermissionExpression(' a | b ', has)).toBe(true)
    })

    it('filters out empty strings from split', () => {
        const has = (p: string) => p === 'a'
        expect(hasPermissionExpression('|a||', has)).toBe(true)
    })
})
