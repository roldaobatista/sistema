import { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDarkMode } from '@/hooks/useDarkMode'
import { AppBreadcrumb } from './AppBreadcrumb'
import {
    LayoutDashboard, Users, FileText, Wrench, DollarSign, BarChart3, Settings, List,
    Shield, ChevronLeft, ChevronRight, LogOut, Menu, X, Building2, Package,
    Briefcase, KeyRound, Grid3x3, Calendar, Clock, ArrowDownToLine, ArrowUpFromLine,
    Award, Receipt, WifiOff, Download, Phone, Upload, Truck, CreditCard, Scale,
    Weight, RotateCcw, TrendingUp, History, Warehouse, ArrowLeftRight, Bell,
    CheckSquare, Tag, Inbox, Heart, Zap, Search, Moon, Sun, Star, ClipboardCheck,
    MapPinned, BookOpen, Fuel, ScrollText, Brain, QrCode, Network, User, BarChart,
    Monitor, Target, Crosshair, AlertTriangle, Share2, Link2, Gauge, Repeat, Trophy, Wallet, Calculator, Wand2,
    GitBranch, PieChart, Swords, Globe, Eye, Video,
    MapPin, StickyNote, Handshake, Lightbulb, ShieldCheck, CalendarHeart, Route,
    UserX, Medal, Printer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { usePWA } from '@/hooks/usePWA'
import { useAppMode } from '@/hooks/useAppMode'
import { useCurrentTenant as useTenantHook } from '@/hooks/useCurrentTenant'
import NotificationPanel from '@/components/notifications/NotificationPanel'
import { QuickReminderButton } from '@/components/central/QuickReminderButton'
import OfflineIndicator from '@/components/pwa/OfflineIndicator'
import { ModeSwitcher } from '@/components/pwa/ModeSwitcher'
import { InstallBanner } from '@/components/pwa/InstallBanner'
import { UpdateBanner } from '@/components/pwa/UpdateBanner'
import { SyncStatusPanel } from '@/components/pwa/SyncStatusPanel'
import { NetworkBadge } from '@/components/pwa/NetworkBadge'
import { usePrefetchCriticalData } from '@/hooks/usePrefetchCriticalData'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

interface NavItem {
    label: string
    icon: React.ElementType
    path: string
    permission?: string
    children?: Omit<NavItem, 'children'>[]
}

function hasPermissionExpression(expression: string, userPerms: string[]): boolean {
    return expression
        .split('|')
        .map(item => item.trim())
        .filter(Boolean)
        .some(permission => userPerms.includes(permission))
}

interface NavSection {
    label: string
    items: NavItem[]
}

const navigationSections: NavSection[] = [
    {
        label: 'Principal',
        items: [
            { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
            {
                label: 'Central', icon: Inbox, path: '/central', permission: 'central.item.view',
                children: [
                    { label: 'Inbox', icon: Inbox, path: '/central' },
                    { label: 'Dashboard', icon: BarChart3, path: '/central/dashboard', permission: 'central.manage.kpis' },
                    { label: 'Automação', icon: Zap, path: '/central/regras', permission: 'central.manage.rules' },
                ],
            },
            { label: 'Notificações', icon: Bell, path: '/notificacoes', permission: 'notifications.notification.view' },
        ],
    },
    {
        label: 'Comercial',
        items: [
            {
                label: 'CRM', icon: Briefcase, path: '/crm', permission: 'crm.deal.view',
                children: [
                    { label: 'Dashboard', icon: BarChart3, path: '/crm' },
                    { label: 'Pipeline', icon: Grid3x3, path: '/crm/pipeline' },
                    { label: 'Calendário', icon: Calendar, path: '/crm/calendar' },
                    { label: 'Alertas', icon: AlertTriangle, path: '/crm/alerts' },
                    { label: 'Previsão', icon: TrendingUp, path: '/crm/forecast', permission: 'crm.forecast.view' },
                    { label: 'Metas', icon: Trophy, path: '/crm/goals', permission: 'crm.goal.view' },
                    { label: 'Lead Scoring', icon: Crosshair, path: '/crm/scoring', permission: 'crm.scoring.view' },
                    { label: 'Cadências', icon: GitBranch, path: '/crm/sequences', permission: 'crm.sequence.view' },
                    { label: 'Territórios', icon: MapPinned, path: '/crm/territories', permission: 'crm.territory.view' },
                    { label: 'Renovações', icon: Repeat, path: '/crm/renewals', permission: 'crm.renewal.view' },
                    { label: 'Indicações', icon: Share2, path: '/crm/referrals', permission: 'crm.referral.view' },
                    { label: 'Formulários', icon: Globe, path: '/crm/web-forms', permission: 'crm.form.view' },
                    { label: 'Propostas', icon: Eye, path: '/crm/proposals', permission: 'crm.proposal.view' },
                    { label: 'Análise Perdas', icon: PieChart, path: '/crm/loss-analytics' },
                    { label: 'Concorrentes', icon: Swords, path: '/crm/competitors' },
                    { label: 'Velocidade', icon: Gauge, path: '/crm/velocity' },
                    { label: 'Coorte', icon: BarChart, path: '/crm/cohort', permission: 'crm.forecast.view' },
                    { label: 'Receita', icon: DollarSign, path: '/crm/revenue', permission: 'crm.forecast.view' },
                    { label: 'Templates', icon: FileText, path: '/crm/templates' },
                    // ── Gestão em Campo ──
                    { label: 'Check-in Visitas', icon: MapPin, path: '/crm/visit-checkins' },
                    { label: 'Roteiro Visitas', icon: Route, path: '/crm/visit-routes' },
                    { label: 'Atas de Visita', icon: FileText, path: '/crm/visit-reports' },
                    { label: 'Mapa Carteira', icon: MapPinned, path: '/crm/portfolio-map' },
                    // ── Nenhum Cliente Esquecido ──
                    { label: 'Clientes Esquecidos', icon: UserX, path: '/crm/forgotten-clients' },
                    { label: 'Políticas Contato', icon: ShieldCheck, path: '/crm/contact-policies' },
                    { label: 'Agenda Inteligente', icon: Lightbulb, path: '/crm/smart-agenda' },
                    { label: 'Workflow Pós-Visita', icon: CheckSquare, path: '/crm/post-visit-workflow' },
                    // ── Conversas e Histórico ──
                    { label: 'Notas Rápidas', icon: StickyNote, path: '/crm/quick-notes' },
                    { label: 'Compromissos', icon: Handshake, path: '/crm/commitments' },
                    { label: 'Histórico Negociação', icon: History, path: '/crm/negotiation-history' },
                    { label: 'Ficha Cliente', icon: User, path: '/crm/client-summary' },
                    // ── Inteligência Comercial ──
                    { label: 'RFM', icon: BarChart, path: '/crm/rfm' },
                    { label: 'Cobertura Carteira', icon: Target, path: '/crm/coverage' },
                    { label: 'Produtividade', icon: TrendingUp, path: '/crm/productivity' },
                    { label: 'Oportunidades', icon: Lightbulb, path: '/crm/opportunities' },
                    // ── Engajamento ──
                    { label: 'Datas Importantes', icon: CalendarHeart, path: '/crm/important-dates' },
                    { label: 'Pesq. Pós-Visita', icon: Star, path: '/crm/visit-surveys' },
                    { label: 'Planos de Ação', icon: Target, path: '/crm/account-plans' },
                    { label: 'Gamificação', icon: Medal, path: '/crm/gamification' },
                ],
            },
            { label: 'Orçamentos', icon: FileText, path: '/orcamentos', permission: 'quotes.quote.view' },
            {
                label: 'Chamados', icon: Phone, path: '/chamados', permission: 'service_calls.service_call.view',
                children: [
                    { label: 'Lista', icon: FileText, path: '/chamados' },
                    { label: 'Mapa', icon: Scale, path: '/chamados/mapa' },
                    { label: 'Agenda', icon: Calendar, path: '/chamados/agenda' },
                ],
            },
        ],
    },
    {
        label: 'Operacional',
        items: [
            {
                label: 'Ordens de Serviço', icon: FileText, path: '/os', permission: 'os.work_order.view',
                children: [
                    { label: 'Lista', icon: FileText, path: '/os' },
                    { label: 'Kanban', icon: Grid3x3, path: '/os/kanban' },
                    { label: 'SLA', icon: Shield, path: '/os/sla' },
                    { label: 'Checklists', icon: CheckSquare, path: '/os/checklists' },
                    { label: 'Contratos', icon: RotateCcw, path: '/os/contratos-recorrentes' },
                ]
            },
            {
                label: 'Técnicos', icon: Wrench, path: '/tecnicos', permission: 'technicians.schedule.view',
                children: [
                    { label: 'Agenda', icon: Calendar, path: '/tecnicos/agenda' },
                    { label: 'Apontamentos', icon: Clock, path: '/tecnicos/apontamentos', permission: 'technicians.time_entry.view' },
                    { label: 'Caixa', icon: DollarSign, path: '/tecnicos/caixa', permission: 'technicians.cashbox.view' },
                ],
            },
            {
                label: 'TV Dashboard', icon: Monitor, path: '/tv/dashboard', permission: 'tv.dashboard.view',
                children: [
                    { label: 'War Room', icon: Monitor, path: '/tv/dashboard' },
                    { label: 'Câmeras', icon: Video, path: '/tv/cameras', permission: 'tv.camera.manage' },
                ],
            },
            {
                label: 'Equipamentos', icon: Scale, path: '/equipamentos', permission: 'equipments.equipment.view',
                children: [
                    { label: 'Lista', icon: Scale, path: '/equipamentos' },
                    { label: 'Modelos de balança', icon: Package, path: '/equipamentos/modelos', permission: 'equipments.equipment_model.view' },
                    { label: 'Pesos Padrão', icon: Weight, path: '/equipamentos/pesos-padrao', permission: 'equipments.standard_weight.view' },
                    { label: 'Atr. Pesos', icon: ArrowLeftRight, path: '/equipamentos/atribuicao-pesos', permission: 'calibration.weight_assignment.view' },
                    { label: 'Calibrações', icon: BookOpen, path: '/calibracoes', permission: 'calibration.reading.view' },
                    { label: 'Templates Cert.', icon: FileText, path: '/calibracao/templates', permission: 'calibration.reading.view' },
                    { label: 'Agenda', icon: Calendar, path: '/agenda-calibracoes' },
                ],
            },
        ],
    },
    {
        label: 'Cadastros',
        items: [
            {
                label: 'Cadastros', icon: Package, path: '/cadastros', permission: 'cadastros.customer.view',
                children: [
                    { label: 'Clientes', icon: Users, path: '/cadastros/clientes' },
                    { label: 'Produtos', icon: Package, path: '/cadastros/produtos' },
                    { label: 'Serviços', icon: Briefcase, path: '/cadastros/servicos' },
                    { label: 'Catálogo', icon: BookOpen, path: '/catalogo', permission: 'catalog.view' },
                    { label: 'Fornecedores', icon: Truck, path: '/cadastros/fornecedores', permission: 'cadastros.supplier.view' },
                ],
            },
            {
                label: 'Estoque', icon: Warehouse, path: '/estoque', permission: 'estoque.movement.view',
                children: [
                    { label: 'Dashboard', icon: BarChart3, path: '/estoque' },
                    { label: 'Produtos', icon: Package, path: '/cadastros/produtos', permission: 'cadastros.product.view' },
                    { label: 'Movimentações', icon: ArrowLeftRight, path: '/estoque/movimentacoes' },
                    { label: 'Armazéns', icon: Warehouse, path: '/estoque/armazens' },
                    { label: 'Transferências', icon: ArrowLeftRight, path: '/estoque/transferencias' },
                    { label: 'Inventário', icon: ClipboardCheck, path: '/estoque/inventarios' },
                    { label: 'Meu inventário', icon: ClipboardCheck, path: '/estoque/inventario-pwa', permission: 'estoque.view' },
                    { label: 'Etiquetas', icon: Printer, path: '/estoque/etiquetas', permission: 'estoque.label.print' },
                    { label: 'Kardex', icon: ScrollText, path: '/estoque/kardex' },
                    { label: 'Calib. Ferramentas', icon: Wrench, path: '/estoque/calibracoes-ferramentas', permission: 'calibration.tool.view' },
                    { label: 'Peças Usadas', icon: Package, path: '/estoque/pecas-usadas' },
                    { label: 'Nº de Série', icon: ScrollText, path: '/estoque/numeros-serie' },
                ],
            },
        ],
    },
    {
        label: 'Financeiro',
        items: [
            {
                label: 'Financeiro', icon: DollarSign, path: '/financeiro',
                permission: 'finance.receivable.view|finance.payable.view|finance.cashflow.view|finance.chart.view|commissions.rule.view|expenses.expense.view',
                children: [
                    { label: 'Contas a Receber', icon: ArrowDownToLine, path: '/financeiro/receber', permission: 'finance.receivable.view' },
                    { label: 'Contas a Pagar', icon: ArrowUpFromLine, path: '/financeiro/pagar', permission: 'finance.payable.view' },
                    { label: 'Contas Bancárias', icon: Building2, path: '/financeiro/contas-bancarias', permission: 'financial.bank_account.view' },
                    { label: 'Pagamentos', icon: DollarSign, path: '/financeiro/pagamentos', permission: 'finance.receivable.view|finance.payable.view' },
                    { label: 'Comissões', icon: Award, path: '/financeiro/comissoes', permission: 'commissions.rule.view' },
                    { label: 'Despesas', icon: Receipt, path: '/financeiro/despesas', permission: 'expenses.expense.view' },
                    { label: 'Fluxo de Caixa', icon: BarChart3, path: '/financeiro/fluxo-caixa', permission: 'finance.cashflow.view' },
                    { label: 'Fluxo Caixa Semanal', icon: Wallet, path: '/financeiro/fluxo-caixa-semanal', permission: 'finance.cashflow.view' },
                    { label: 'Faturamento', icon: FileText, path: '/financeiro/faturamento', permission: 'finance.receivable.view' },
                    { label: 'Conciliação', icon: ArrowLeftRight, path: '/financeiro/conciliacao-bancaria', permission: 'finance.receivable.view' },
                    { label: 'Renegociação', icon: RotateCcw, path: '/financeiro/renegociacao', permission: 'finance.renegotiation.view' },
                    { label: 'Régua de Cobrança', icon: ArrowDownToLine, path: '/financeiro/regua-cobranca', permission: 'finance.receivable.view' },
                    { label: 'Cobrança Auto', icon: Zap, path: '/financeiro/cobranca-automatica', permission: 'finance.receivable.view' },
                    { label: 'Plano de Contas', icon: FileText, path: '/financeiro/plano-contas', permission: 'finance.chart.view' },
                    { label: 'Consolidado', icon: Building2, path: '/financeiro/consolidado', permission: 'finance.cashflow.view' },
                    { label: 'Formas de Pagamento', icon: CreditCard, path: '/financeiro/formas-pagamento', permission: 'finance.payable.view|finance.receivable.view' },
                    { label: 'Reembolsos', icon: ArrowUpFromLine, path: '/financeiro/reembolsos', permission: 'expenses.expense.view' },
                    { label: 'Cheques', icon: CheckSquare, path: '/financeiro/cheques', permission: 'finance.payable.view' },
                    { label: 'Contratos Fornecedores', icon: ScrollText, path: '/financeiro/contratos-fornecedores', permission: 'finance.payable.view' },
                    { label: 'Adiantamentos', icon: ArrowDownToLine, path: '/financeiro/adiantamentos-fornecedores', permission: 'finance.payable.view' },
                    { label: 'Simulador Recebíveis', icon: TrendingUp, path: '/financeiro/simulador-recebiveis', permission: 'finance.receivable.view' },
                    { label: 'Aprovação em Lote', icon: CheckSquare, path: '/financeiro/aprovacao-lote', permission: 'finance.payable.view' },
                    { label: 'Alocação Despesas', icon: PieChart, path: '/financeiro/alocacao-despesas', permission: 'expenses.expense.view' },
                    { label: 'Calculadora Tributos', icon: Calculator, path: '/financeiro/calculadora-tributos', permission: 'finance.dre.view' },
                    { label: 'DRE', icon: BarChart3, path: '/financeiro/dre', permission: 'finance.dre.view' },
                ],
            },
            { label: 'Relatórios', icon: BarChart3, path: '/relatorios', permission: 'reports.os_report.view' },
        ],
    },
    {
        label: 'Administração',
        items: [
            {
                label: 'INMETRO', icon: Search, path: '/inmetro', permission: 'inmetro.intelligence.view',
                children: [
                    { label: 'Dashboard', icon: BarChart3, path: '/inmetro' },
                    { label: 'Instrumentos', icon: Scale, path: '/inmetro/instrumentos' },
                    { label: 'Mapa', icon: Search, path: '/inmetro/mapa' },
                    { label: 'Mercado', icon: BarChart3, path: '/inmetro/mercado' },
                    { label: 'Importação', icon: Upload, path: '/inmetro/importacao' },
                ],
            },
            { label: 'Importação', icon: Upload, path: '/importacao', permission: 'import.data.view' },
            { label: 'Auvo', icon: Download, path: '/integracao/auvo', permission: 'auvo.import.view' },
            {
                label: 'Email', icon: Inbox, path: '/emails', permission: 'email.inbox.view',
                children: [
                    { label: 'Caixa de Entrada', icon: Inbox, path: '/emails' },
                    { label: 'Configurações', icon: Settings, path: '/emails/configuracoes', permission: 'email.account.view' },
                ],
            },
            {
                label: 'IAM', icon: Shield, path: '/iam', permission: 'iam.user.view',
                children: [
                    { label: 'Usuários', icon: Users, path: '/iam/usuarios' },
                    { label: 'Roles', icon: KeyRound, path: '/iam/roles', permission: 'iam.role.view' },
                    { label: 'Permissões', icon: Grid3x3, path: '/iam/permissoes', permission: 'iam.role.view' },
                ],
            },
            {
                label: 'Configurações', icon: Settings, path: '/configuracoes', permission: 'platform.settings.view',
                children: [
                    { label: 'Cadastros Auxiliares', icon: List, path: '/configuracoes/cadastros-auxiliares', permission: 'lookups.view' },
                    { label: 'Filiais', icon: Building2, path: '/configuracoes/filiais', permission: 'platform.branch.view' },
                    { label: 'Empresas', icon: Building2, path: '/configuracoes/empresas', permission: 'platform.tenant.view' },
                    { label: 'WhatsApp', icon: Phone, path: '/configuracoes/whatsapp', permission: 'whatsapp.config.view' },
                    { label: 'WhatsApp Logs', icon: Phone, path: '/configuracoes/whatsapp/logs', permission: 'whatsapp.log.view' },
                    { label: 'Auditoria', icon: History, path: '/configuracoes/auditoria', permission: 'iam.audit_log.view' },
                ],
            },
        ],
    },
    {
        label: 'Avançado',
        items: [
            { label: 'Analytics Hub', icon: BarChart3, path: '/analytics', permission: 'reports.analytics.view' },
            { label: 'Frota', icon: Truck, path: '/frota', permission: 'fleet.vehicle.view' },
            {
                label: 'RH', icon: Users, path: '/rh', permission: 'hr.schedule.view',
                children: [
                    { label: 'Visão Geral', icon: Users, path: '/rh' },
                    { label: 'Organograma', icon: Network, path: '/rh/organograma', permission: 'hr.organization.view' },
                    { label: 'Ponto', icon: Clock, path: '/rh/ponto', permission: 'hr.clock.view' },
                    { label: 'Benefícios', icon: Heart, path: '/rh/beneficios', permission: 'hr.benefits.view' },
                    { label: 'Férias', icon: Sun, path: '/rh/ferias', permission: 'hr.leave.view' },
                ],
            },
            {
                label: 'Qualidade', icon: ClipboardCheck, path: '/qualidade', permission: 'quality.procedure.view',
                children: [
                    { label: 'Visão Geral', icon: ClipboardCheck, path: '/qualidade' },
                    { label: 'Auditorias Internas', icon: Search, path: '/qualidade/auditorias', permission: 'quality.audit.view' },
                    { label: 'Documentos da Qualidade', icon: FileText, path: '/qualidade/documentos', permission: 'quality.document.view' },
                    { label: 'Revisão pela direção', icon: Users, path: '/qualidade/revisao-direcao', permission: 'quality.management_review.view' },
                ],
            },
            { label: 'Alertas', icon: Bell, path: '/alertas', permission: 'alerts.alert.view' },
            { label: 'Automação', icon: Zap, path: '/automacao', permission: 'automation.rule.view' },
        ],
    },
]

/** Sidebar do Modo Vendedor — CRM com children (como Gestão) para submenus não sumirem */
const crmNavItem = navigationSections.find(s => s.label === 'Comercial')?.items.find(i => i.path === '/crm')
const salesOnlySections: NavSection[] = [
    {
        label: 'Comercial',
        items: [
            ...(crmNavItem ? [crmNavItem] : []),
            { label: 'Orçamentos', icon: FileText, path: '/orcamentos', permission: 'quotes.quote.view' },
            { label: 'Clientes', icon: Users, path: '/cadastros/clientes', permission: 'cadastros.customer.view' },
            { label: 'Leads INMETRO', icon: Target, path: '/inmetro/leads', permission: 'inmetro.intelligence.view' },
            {
                label: 'Chamados', icon: Phone, path: '/chamados', permission: 'service_calls.service_call.view',
                children: [
                    { label: 'Lista', icon: FileText, path: '/chamados' },
                    { label: 'Mapa', icon: Scale, path: '/chamados/mapa' },
                    { label: 'Agenda', icon: Calendar, path: '/chamados/agenda' },
                ],
            },
        ],
    },
]

/** Sidebar restrita para tecnico_vendedor no Modo Vendedor (apenas seus dados) */
const tecnicoVendedorSections: NavSection[] = [
    {
        label: 'Comercial',
        items: [
            { label: 'Dashboard CRM', icon: BarChart3, path: '/crm', permission: 'crm.deal.view' },
            { label: 'Meus Orçamentos', icon: FileText, path: '/orcamentos', permission: 'quotes.quote.view' },
            { label: 'Clientes', icon: Users, path: '/cadastros/clientes', permission: 'cadastros.customer.view' },
            { label: 'Templates', icon: FileText, path: '/crm/templates', permission: 'crm.message.view' },
        ],
    },
]

const navigation: NavItem[] = navigationSections.flatMap(s => s.items)

function filterNavByPermission(items: NavItem[], userPerms: string[], isSuperAdmin: boolean): NavItem[] {
    if (isSuperAdmin) return items

    const filtered: NavItem[] = []

    for (const item of items) {
        const canAccessItem = !item.permission || hasPermissionExpression(item.permission, userPerms)

        if (!item.children) {
            if (canAccessItem) filtered.push(item)
            continue
        }

        const allowedChildren = item.children.filter(
            child => !child.permission || hasPermissionExpression(child.permission, userPerms)
        )

        if (!canAccessItem && allowedChildren.length === 0) continue

        filtered.push({
            ...item,
            path: canAccessItem ? item.path : allowedChildren[0].path,
            children: allowedChildren,
        })
    }

    return filtered
}

function filterNavSectionsByPermission(sections: NavSection[], userPerms: string[], isSuperAdmin: boolean): NavSection[] {
    return sections
        .map(section => ({
            ...section,
            items: filterNavByPermission(section.items, userPerms, isSuperAdmin),
        }))
        .filter(section => section.items.length > 0)
}

export function AppLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation()
    const { user, logout, hasRole, hasPermission } = useAuthStore()
    const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, toggleMobileSidebar } = useUIStore()
    const { isInstallable, isOnline, install } = usePWA()
    const { currentMode } = useAppMode()
    const { currentTenant, tenants, switchTenant, isSwitching } = useTenantHook()

    // PWA: Pre-cache data based on current mode
    usePrefetchCriticalData()

    // PWA: Swipe gesture for mobile sidebar
    const mainContentRef = useRef<HTMLDivElement>(null)
    useSwipeGesture(mainContentRef, {
        onSwipeRight: () => { if (!sidebarCollapsed && window.innerWidth < 1024) toggleMobileSidebar() },
        onSwipeLeft: () => { if (sidebarMobileOpen && window.innerWidth < 1024) toggleMobileSidebar() },
        enabled: window.innerWidth < 1024,
    })

    const baseSections =
        currentMode === 'vendedor'
            ? hasRole('tecnico_vendedor') && !hasRole('comercial') && !hasRole('vendedor')
                ? tecnicoVendedorSections
                : salesOnlySections
            : navigationSections

    const filteredSections = filterNavSectionsByPermission(
        baseSections,
        user?.permissions ?? [],
        hasRole('super_admin')
    )
    const filteredNav = filteredSections.flatMap(s => s.items)
    const canViewNotifications = hasRole('super_admin') || hasPermission('notifications.notification.view')

    const { isDark: darkMode, toggle: toggleDarkMode } = useDarkMode()

    const [favorites, setFavorites] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('sidebar-favorites') ?? '[]')
        } catch { return [] }
    })

    const toggleFavorite = (path: string) => {
        setFavorites(prev => {
            const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
            localStorage.setItem('sidebar-favorites', JSON.stringify(next))
            return next
        })
    }

    const favoriteItems = filteredNav.filter(item => favorites.includes(item.path))

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => {
            const initial = new Set<string>()
            filteredNav.forEach(item => {
                if (item.children?.some(child => location.pathname === child.path)) {
                    initial.add(item.path)
                }
            })
            return initial
        }
    )

    const toggleGroup = (path: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })
    }

    const isActive = (path: string) => location.pathname === path

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {sidebarMobileOpen && (
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={toggleMobileSidebar} />
            )}

            <aside
                data-sidebar
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-surface-200 bg-white text-surface-500 transition-[width,transform] duration-200 ease-out',
                    'dark:bg-[#09090B] dark:text-zinc-400 dark:border-white/[0.06]',
                    'lg:relative lg:z-auto',
                    sidebarCollapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]',
                    sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                <div className="flex h-[var(--topbar-height)] items-center gap-3 border-b border-surface-200 dark:border-white/[0.06] px-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/20">
                        K
                    </div>
                    {!sidebarCollapsed && (
                        <span className="truncate font-bold text-surface-900 dark:text-white text-sm tracking-tight">
                            KALIBRIUM
                        </span>
                    )}
                </div>

                <nav className="flex-1 overflow-y-auto px-2 py-2">
                    {favoriteItems.length > 0 && (
                        <div>
                            {!sidebarCollapsed && (
                                <div className="px-2.5 pt-1 pb-1.5 text-label text-blue-500/70 dark:text-blue-400/70 flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-blue-500 text-blue-500/70 dark:fill-blue-400 dark:text-blue-400/70" />
                                    Favoritos
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {favoriteItems.map(item => (
                                    <Link
                                        key={`fav-${item.path}`}
                                        to={item.path}
                                        className={cn(
                                            'group relative flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-[7px] text-sm font-medium transition-colors duration-100',
                                            isActive(item.path)
                                                ? 'bg-blue-50 text-surface-900 dark:bg-white/8 dark:text-white'
                                                : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-white/5 dark:hover:text-surface-200',
                                            sidebarCollapsed && 'justify-center px-2'
                                        )}
                                    >
                                        {isActive(item.path) && (
                                            <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-blue-500" />
                                        )}
                                        <item.icon className={cn(
                                            'h-4 w-4 shrink-0 transition-colors duration-100',
                                            isActive(item.path) ? 'text-blue-600 dark:text-blue-400' : 'text-surface-400 group-hover:text-surface-600 dark:text-surface-500 dark:group-hover:text-surface-300'
                                        )} />
                                        {!sidebarCollapsed && (
                                            <span className="flex-1 text-left truncate">{item.label}</span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                            <div className={cn('border-t border-surface-100 dark:border-white/6', sidebarCollapsed ? 'my-1.5 mx-2' : 'mt-1.5 mx-2')} />
                        </div>
                    )}

                    {filteredSections.map((section, sectionIdx) => (
                        <div key={section.label}>
                            {!sidebarCollapsed && (
                                <div className={cn(
                                    'px-2.5 pt-3 pb-1.5 text-label text-surface-400 dark:text-surface-500',
                                    sectionIdx > 0 && 'mt-1.5 border-t border-surface-100 dark:border-white/6 pt-3.5'
                                )}>
                                    {section.label}
                                </div>
                            )}
                            {sidebarCollapsed && sectionIdx > 0 && (
                                <div className="my-1.5 mx-2 border-t border-surface-100 dark:border-white/6" />
                            )}
                            <div className="space-y-0.5">
                                {section.items.map((item) => (
                                    <div key={item.path}>
                                        {item.children ? (
                                            <button
                                                onClick={() => toggleGroup(item.path)}
                                                className={cn(
                                                    'group flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-[7px] text-sm font-medium transition-colors duration-100',
                                                    item.children.some(c => isActive(c.path))
                                                        ? 'bg-blue-50 text-surface-900 dark:bg-white/8 dark:text-white'
                                                        : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-white/5 dark:hover:text-surface-200',
                                                    sidebarCollapsed && 'justify-center px-2'
                                                )}
                                            >
                                                <item.icon className={cn(
                                                    'h-4 w-4 shrink-0 transition-colors duration-100',
                                                    item.children.some(c => isActive(c.path)) ? 'text-blue-600 dark:text-blue-400' : 'text-surface-400 group-hover:text-surface-600 dark:text-surface-500 dark:group-hover:text-surface-300'
                                                )} />
                                                {!sidebarCollapsed && (
                                                    <>
                                                        <span className="flex-1 text-left truncate">{item.label}</span>
                                                        <ChevronRight
                                                            className={cn(
                                                                'h-3.5 w-3.5 text-surface-400 dark:text-surface-500 transition-transform duration-150',
                                                                expandedGroups.has(item.path) && 'rotate-90'
                                                            )}
                                                        />
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <Link
                                                to={item.path}
                                                className={cn(
                                                    'group relative flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-[7px] text-sm font-medium transition-colors duration-100',
                                                    isActive(item.path)
                                                        ? 'bg-blue-50 text-surface-900 dark:bg-white/8 dark:text-white'
                                                        : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-white/5 dark:hover:text-surface-200',
                                                    sidebarCollapsed && 'justify-center px-2'
                                                )}
                                            >
                                                {isActive(item.path) && (
                                                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-blue-500" />
                                                )}
                                                <item.icon className={cn(
                                                    'h-4 w-4 shrink-0 transition-colors duration-100',
                                                    isActive(item.path) ? 'text-blue-600 dark:text-blue-400' : 'text-surface-400 group-hover:text-surface-600 dark:text-surface-500 dark:group-hover:text-surface-300'
                                                )} />
                                                {!sidebarCollapsed && (
                                                    <>
                                                        <span className="flex-1 text-left truncate">{item.label}</span>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.path) }}
                                                            className={cn(
                                                                'h-3.5 w-3.5 shrink-0 transition-all duration-150',
                                                                favorites.includes(item.path)
                                                                    ? 'text-blue-500 dark:text-blue-400 opacity-100'
                                                                    : 'text-surface-300 opacity-0 group-hover:opacity-100 hover:text-blue-500 dark:text-surface-600 dark:hover:text-blue-400'
                                                            )}
                                                            title={favorites.includes(item.path) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                                        >
                                                            <Star className={cn('h-3.5 w-3.5', favorites.includes(item.path) && 'fill-blue-500 dark:fill-blue-400')} />
                                                        </button>
                                                    </>
                                                )}
                                            </Link>
                                        )}

                                        {item.children && !sidebarCollapsed && expandedGroups.has(item.path) && (
                                            <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-surface-200 dark:border-white/6 pl-2.5">
                                                {item.children.map((child) => (
                                                    <Link
                                                        key={child.path}
                                                        to={child.path}
                                                        className={cn(
                                                            'relative flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-[5px] text-xs font-medium transition-colors duration-100',
                                                            isActive(child.path)
                                                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                                                                : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-500 dark:hover:bg-white/4 dark:hover:text-surface-300'
                                                        )}
                                                    >
                                                        <child.icon className="h-3.5 w-3.5" />
                                                        <span>{child.label}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="hidden border-t border-surface-200 dark:border-white/[0.06] p-2.5 lg:block">
                    <button
                        onClick={toggleSidebar}
                        className="flex w-full items-center justify-center rounded-[var(--radius-md)] p-2 text-surface-400 hover:bg-surface-100 hover:text-blue-500 dark:text-zinc-500 dark:hover:bg-white/[0.04] dark:hover:text-blue-400 transition-colors duration-150"
                    >
                        {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </aside>

            <div className="flex flex-1 flex-col overflow-hidden">
                {!isOnline && (
                    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1 text-xs font-medium text-white">
                        <WifiOff className="h-3 w-3" />
                        Você está offline — dados em cache serão exibidos
                    </div>
                )}

                <header data-header className={cn(
                    "flex h-[var(--topbar-height)] items-center justify-between px-4 lg:px-6",
                    "border-b border-black/[0.06] bg-white/80 backdrop-blur-xl",
                    "dark:border-white/[0.06] dark:bg-[#09090B]/80 dark:backdrop-blur-xl"
                )}>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleMobileSidebar}
                            className="rounded-[var(--radius-md)] p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-white/[0.04] lg:hidden"
                        >
                            {sidebarMobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <ModeSwitcher />
                        {isInstallable && (
                            <button onClick={install}
                                className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-surface-700 dark:text-surface-300 transition-colors hover:bg-surface-200 dark:hover:bg-white/[0.08]">
                                <Download className="h-3 w-3" />
                                Instalar
                            </button>
                        )}

                        {tenants.length > 1 ? (
                            <select
                                value={currentTenant?.id ?? ''}
                                onChange={e => switchTenant(Number(e.target.value))}
                                disabled={isSwitching}
                                aria-label="Selecionar empresa"
                                className="hidden appearance-none rounded-[var(--radius-md)] border border-surface-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-surface-700 dark:text-surface-300 sm:block focus:outline-none focus:ring-2 focus:ring-prix-500/15 cursor-pointer"
                            >
                                {tenants.map(t => <option key={t.id} value={t.id} disabled={t.status === 'inactive'}>{t.name}{t.status === 'inactive' ? ' (Inativa)' : t.status === 'trial' ? ' (Teste)' : ''}</option>)}
                            </select>
                        ) : (
                            <span className="hidden items-center gap-1.5 rounded-[var(--radius-md)] border border-surface-200 dark:border-white/[0.06] bg-surface-50 dark:bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 sm:flex">
                                <Building2 className="h-3 w-3" />
                                {currentTenant?.name ?? '—'}
                            </span>
                        )}

                        <NetworkBadge />
                        <SyncStatusPanel />
                        {canViewNotifications ? <NotificationPanel /> : null}

                        {hasPermission('central.create.task') ? (
                            <QuickReminderButton className="rounded-[var(--radius-md)] p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-white/[0.04] hover:text-surface-700 dark:hover:text-white transition-colors" />
                        ) : null}

                        <button
                            onClick={toggleDarkMode}
                            className="rounded-[var(--radius-md)] p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-white/[0.04] hover:text-surface-600 dark:hover:text-white transition-all duration-200"
                            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
                        >
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>

                        <Link to="/perfil" className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-white/[0.04] transition-colors duration-150">
                            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] prix-gradient text-white text-xs font-bold shadow-sm">
                                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                            </div>
                            <div className="hidden sm:flex flex-col">
                                <span className="text-sm font-semibold text-surface-800 dark:text-white leading-tight">
                                    {user?.name ?? 'Usuário'}
                                </span>
                                {user?.role_details?.[0] && (
                                    <span className="text-xs text-surface-400 leading-tight">
                                        {user.role_details[0].display_name}
                                    </span>
                                )}
                            </div>
                        </Link>

                        <button
                            onClick={logout}
                            className="rounded-[var(--radius-md)] p-1.5 text-surface-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150"
                            title="Sair"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </header>

                <main ref={mainContentRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <AppBreadcrumb />
                    {children}
                </main>

                <UpdateBanner />
                <OfflineIndicator />
                <InstallBanner />
            </div>
        </div>
    )
}
