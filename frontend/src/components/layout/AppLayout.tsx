import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Users,
    FileText,
    Wrench,
    DollarSign,
    BarChart3,
    Settings,
    Shield,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Menu,
    X,
    Building2,
    Package,
    Briefcase,
    KeyRound,
    Grid3x3,
    Calendar,
    Clock,
    ArrowDownToLine,
    ArrowUpFromLine,
    Award,
    Receipt,
    WifiOff,
    Download,
    Phone,
    Upload,
    Scale,
    RotateCcw,
    History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { usePWA } from '@/hooks/usePWA'
import { useCurrentTenant as useTenantHook } from '@/hooks/useCurrentTenant'
import NotificationPanel from '@/components/notifications/NotificationPanel'

interface NavItem {
    label: string
    icon: React.ElementType
    path: string
    permission?: string
    children?: Omit<NavItem, 'children'>[]
}

const navigation: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    {
        label: 'CRM',
        icon: Briefcase,
        path: '/crm',
        children: [
            { label: 'Dashboard', icon: BarChart3, path: '/crm' },
            { label: 'Pipeline', icon: Grid3x3, path: '/crm/pipeline' },
            { label: 'Templates', icon: FileText, path: '/crm/templates' },
        ],
    },
    {
        label: 'Cadastros',
        icon: Package,
        path: '/cadastros',
        children: [
            { label: 'Clientes', icon: Users, path: '/cadastros/clientes' },
            { label: 'Produtos', icon: Package, path: '/cadastros/produtos' },
            { label: 'Serviços', icon: Briefcase, path: '/cadastros/servicos' },
        ],
    },
    { label: 'Orçamentos', icon: FileText, path: '/orcamentos' },
    { label: 'Chamados', icon: Phone, path: '/chamados' },
    { label: 'Ordens de Serviço', icon: FileText, path: '/os' },
    { label: 'Contratos Recorrentes', icon: RotateCcw, path: '/os/contratos-recorrentes' },
    {
        label: 'Técnicos',
        icon: Wrench,
        path: '/tecnicos',
        children: [
            { label: 'Agenda', icon: Calendar, path: '/tecnicos/agenda' },
            { label: 'Apontamentos', icon: Clock, path: '/tecnicos/apontamentos' },
            { label: 'Caixa', icon: DollarSign, path: '/tecnicos/caixa' },
        ],
    },
    {
        label: 'Financeiro',
        icon: DollarSign,
        path: '/financeiro',
        children: [
            { label: 'Contas a Receber', icon: ArrowDownToLine, path: '/financeiro/receber' },
            { label: 'Contas a Pagar', icon: ArrowUpFromLine, path: '/financeiro/pagar' },
            { label: 'Comissões', icon: Award, path: '/financeiro/comissoes' },
            { label: 'Despesas', icon: Receipt, path: '/financeiro/despesas' },
        ],
    },
    { label: 'Relatórios', icon: BarChart3, path: '/relatorios' },
    { label: 'Importação', icon: Upload, path: '/importacao' },
    { label: 'Equipamentos', icon: Scale, path: '/equipamentos' },
    { label: 'Agenda Calibrações', icon: Calendar, path: '/agenda-calibracoes' },
    {
        label: 'IAM',
        icon: Shield,
        path: '/iam',
        children: [
            { label: 'Usuários', icon: Users, path: '/iam/usuarios' },
            { label: 'Roles', icon: KeyRound, path: '/iam/roles' },
            { label: 'Permissões', icon: Grid3x3, path: '/iam/permissoes' },
        ],
    },
    {
        label: 'Configurações',
        icon: Settings,
        path: '/configuracoes',
        children: [
            { label: 'Filiais', icon: Building2, path: '/configuracoes/filiais' },
            { label: 'Empresas', icon: Building2, path: '/configuracoes/empresas' },
            { label: 'Auditoria', icon: History, path: '/configuracoes/auditoria' },
        ],
    },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation()
    const { user, logout } = useAuthStore()
    const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, toggleMobileSidebar } = useUIStore()
    const { isInstallable, isOnline, install } = usePWA()
    const { currentTenant, tenants, switchTenant, isSwitching } = useTenantHook()
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => {
            const initial = new Set<string>()
            navigation.forEach(item => {
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
            next.has(path) ? next.delete(path) : next.add(path)
            return next
        })
    }

    const isActive = (path: string) => location.pathname === path

    return (
        <div className="flex h-screen overflow-hidden bg-surface-50">
            {/* --- Overlay Mobile --- */}
            {sidebarMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={toggleMobileSidebar}
                />
            )}

            {/* --- Sidebar --- */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-surface-200 bg-white transition-all duration-300 ease-smooth',
                    'lg:relative lg:z-auto',
                    sidebarCollapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]',
                    sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                {/* Logo */}
                <div className="flex h-[var(--topbar-height)] items-center gap-3 border-b border-surface-200 px-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm">
                        OS
                    </div>
                    {!sidebarCollapsed && (
                        <span className="truncate font-semibold text-surface-900 text-sm">
                            Sistema OS
                        </span>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    {navigation.map((item) => (
                        <div key={item.path}>
                            {item.children ? (
                                <button
                                    onClick={() => toggleGroup(item.path)}
                                    className={cn(
                                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        item.children.some(c => isActive(c.path))
                                            ? 'bg-brand-50 text-brand-700'
                                            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
                                        sidebarCollapsed && 'justify-center px-2'
                                    )}
                                >
                                    <item.icon className={cn(
                                        'h-5 w-5 shrink-0 transition-colors',
                                        item.children.some(c => isActive(c.path)) ? 'text-brand-500' : 'text-surface-400 group-hover:text-brand-500'
                                    )} />
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className="flex-1 text-left truncate">{item.label}</span>
                                            <ChevronRight
                                                className={cn(
                                                    'h-4 w-4 transition-transform',
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
                                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        isActive(item.path)
                                            ? 'bg-brand-50 text-brand-700'
                                            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
                                        sidebarCollapsed && 'justify-center px-2'
                                    )}
                                >
                                    <item.icon className={cn(
                                        'h-5 w-5 shrink-0 transition-colors',
                                        isActive(item.path) ? 'text-brand-500' : 'text-surface-400 group-hover:text-brand-500'
                                    )} />
                                    {!sidebarCollapsed && (
                                        <span className="flex-1 text-left truncate">{item.label}</span>
                                    )}
                                </Link>
                            )}

                            {/* Sub-items */}
                            {item.children && !sidebarCollapsed && expandedGroups.has(item.path) && (
                                <div className="ml-4 mt-1 space-y-1 border-l border-surface-200 pl-3">
                                    {item.children.map((child) => (
                                        <Link
                                            key={child.path}
                                            to={child.path}
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                                                isActive(child.path)
                                                    ? 'bg-brand-50 text-brand-700'
                                                    : 'text-surface-500 hover:bg-surface-100 hover:text-surface-800'
                                            )}
                                        >
                                            <child.icon className="h-4 w-4" />
                                            <span>{child.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* Collapse toggle */}
                <div className="hidden border-t border-surface-200 p-3 lg:block">
                    <button
                        onClick={toggleSidebar}
                        className="flex w-full items-center justify-center rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors"
                    >
                        {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                </div>
            </aside>

            {/* --- Main Area --- */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Offline indicator */}
                {!isOnline && (
                    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-medium text-white">
                        <WifiOff className="h-3.5 w-3.5" />
                        Você está offline — dados em cache serão exibidos
                    </div>
                )}

                {/* Topbar */}
                <header className="flex h-[var(--topbar-height)] items-center justify-between border-b border-surface-200 bg-white px-4 lg:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleMobileSidebar}
                            className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 lg:hidden"
                        >
                            {sidebarMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Install PWA button */}
                        {isInstallable && (
                            <button onClick={install}
                                className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100">
                                <Download className="h-3.5 w-3.5" />
                                Instalar App
                            </button>
                        )}

                        {/* Tenant selector */}
                        {tenants.length > 1 ? (
                            <select
                                value={currentTenant?.id ?? ''}
                                onChange={e => switchTenant(Number(e.target.value))}
                                disabled={isSwitching}
                                aria-label="Selecionar empresa"
                                className="hidden appearance-none items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 sm:block border-0 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
                            >
                                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        ) : (
                            <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 sm:flex">
                                <Building2 className="h-3.5 w-3.5" />
                                {currentTenant?.name ?? '—'}
                            </span>
                        )}

                        {/* Notifications */}
                        <NotificationPanel />

                        {/* User */}
                        <Link to="/perfil" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-50 transition-colors">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                            </div>
                            <span className="hidden text-sm font-medium text-surface-700 sm:block">
                                {user?.name ?? 'Usuário'}
                            </span>
                        </Link>

                        <button
                            onClick={logout}
                            className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Sair"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
