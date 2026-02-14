import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

const routeLabels: Record<string, string> = {
    '': 'Dashboard',
    'central': 'Central',
    'dashboard': 'Dashboard',
    'regras': 'Automação',
    'crm': 'CRM',
    'pipeline': 'Pipeline',
    'templates': 'Templates',
    'cadastros': 'Cadastros',
    'clientes': 'Clientes',
    'fusao': 'Fusão',
    'produtos': 'Produtos',
    'servicos': 'Serviços',
    'fornecedores': 'Fornecedores',
    'historico-precos': 'Histórico Preços',
    'exportacao-lote': 'Exportação Lote',
    'orcamentos': 'Orçamentos',
    'chamados': 'Chamados',
    'mapa': 'Mapa',
    'agenda': 'Agenda',
    'os': 'Ordens de Serviço',
    'kanban': 'Kanban',
    'sla': 'SLA Políticas',
    'sla-dashboard': 'SLA Dashboard',
    'checklists': 'Checklists',
    'contratos-recorrentes': 'Contratos Recorrentes',
    'tecnicos': 'Técnicos',
    'apontamentos': 'Apontamentos',
    'caixa': 'Caixa',
    'financeiro': 'Financeiro',
    'receber': 'Contas a Receber',
    'pagar': 'Contas a Pagar',
    'pagamentos': 'Pagamentos',
    'comissoes': 'Comissões',
    'despesas': 'Despesas',
    'formas-pagamento': 'Formas de Pagamento',
    'fluxo-caixa': 'Fluxo de Caixa',
    'faturamento': 'Faturamento',
    'conciliacao-bancaria': 'Conciliação Bancária',
    'regras-conciliacao': 'Regras de Conciliação',
    'dashboard-conciliacao': 'Dashboard Conciliação',
    'plano-contas': 'Plano de Contas',
    'categorias-pagar': 'Categorias',
    'relatorios': 'Relatórios',
    'notificacoes': 'Notificações',
    'importacao': 'Importação',
    'integracao': 'Integração',
    'auvo': 'Auvo',
    'equipamentos': 'Equipamentos',
    'pesos-padrao': 'Pesos Padrão',
    'agenda-calibracoes': 'Agenda Calibrações',
    'inmetro': 'Intel. INMETRO',
    'leads': 'Leads',
    'instrumentos': 'Instrumentos',
    'concorrentes': 'Concorrentes',
    'estoque': 'Estoque',
    'movimentacoes': 'Movimentações',
    'iam': 'IAM',
    'usuarios': 'Usuários',
    'roles': 'Roles',
    'permissoes': 'Permissões',
    'configuracoes': 'Configurações',
    'filiais': 'Filiais',
    'empresas': 'Empresas',
    'auditoria': 'Auditoria',
    'perfil': 'Perfil',
    'portal': 'Portal',
    'novo': 'Novo',
    'editar': 'Editar',
    'criar': 'Criar',
}

export function AppBreadcrumb() {
    const location = useLocation()

    if (location.pathname === '/') return null

    const segments = location.pathname.split('/').filter(Boolean)

    // Skip if it's a single-level page (the PageHeader already shows title)
    if (segments.length <= 1) return null

    const crumbs = segments.map((segment, index) => {
        const path = '/' + segments.slice(0, index + 1).join('/')
        const isLast = index === segments.length - 1

        // Check if segment looks like an ID (numeric or UUID)
        const isId = /^\d+$/.test(segment) || /^[0-9a-f-]{36}$/.test(segment)
        const label = isId ? `#${segment}` : (routeLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '))

        return { path, label, isLast }
    })

    return (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] mb-3">
            <Link
                to="/"
                className="flex items-center text-surface-400 hover:text-surface-600 transition-colors duration-100"
            >
                <Home className="h-3.5 w-3.5" />
            </Link>
            {crumbs.map((crumb) => (
                <div key={crumb.path} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-surface-300" />
                    {crumb.isLast ? (
                        <span className="font-medium text-surface-600">{crumb.label}</span>
                    ) : (
                        <Link
                            to={crumb.path}
                            className="text-surface-400 hover:text-surface-600 transition-colors duration-100"
                        >
                            {crumb.label}
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    )
}
