import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom'
import {
    ClipboardList,
    Camera,
    Receipt,
    User,
    Wifi,
    WifiOff,
    RefreshCw,
    Briefcase,
    ShieldAlert,
    Settings,
    ScanBarcode,
    Calendar,
    Wallet,
    Bell,
    Clock,
    Plus,
    Gauge,
    Menu,
    X,
} from 'lucide-react'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
    { path: '/tech', icon: Briefcase, label: 'OS', end: true },
    { path: '/tech/agenda', icon: Calendar, label: 'Agenda' },
    { path: '/tech/caixa', icon: Wallet, label: 'Caixa' },
    { path: '/tech/perfil', icon: User, label: 'Perfil' },
]

const MORE_ITEMS = [
    { path: '/tech/nova-os', icon: Plus, label: 'Nova OS' },
    { path: '/tech/despesas', icon: Receipt, label: 'Despesas' },
    { path: '/tech/apontamentos', icon: Clock, label: 'Horas' },
    { path: '/tech/equipamentos', icon: Gauge, label: 'Equipamentos' },
    { path: '/tech/notificacoes', icon: Bell, label: 'Notificações' },
    { path: '/tech/barcode', icon: ScanBarcode, label: 'Scanner' },
    { path: '/tech/configuracoes', icon: Settings, label: 'Configurações' },
]

const ALLOWED_TECH_ROLES = ['tecnico', 'tecnico_vendedor', 'motorista', 'super_admin', 'admin', 'gerente']

export default function TechShell() {
    const { isAuthenticated, user, hasRole } = useAuthStore()
    const { isOnline, pendingCount, isSyncing, syncNow, lastSyncAt } = useSyncStatus()
    const location = useLocation()
    const navigate = useNavigate()
    const [showSyncBar, setShowSyncBar] = useState(false)
    const [showMoreMenu, setShowMoreMenu] = useState(false)

    // Show sync bar briefly when sync completes
    useEffect(() => {
        if (lastSyncAt) {
            setShowSyncBar(true)
            const timer = setTimeout(() => setShowSyncBar(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [lastSyncAt])

    // GAP-18: Gate de autenticação
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    // GAP-18: Gate de role — apenas roles de campo e administrativas
    const hasAllowedRole = ALLOWED_TECH_ROLES.some(role => hasRole(role))
    if (user && !hasAllowedRole) {
        return (
            <div className="flex flex-col items-center justify-center h-[100dvh] bg-surface-50 dark:bg-surface-950 px-6">
                <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30 p-8 text-center shadow-sm max-w-md">
                    <ShieldAlert className="mx-auto h-12 w-12 text-red-400 mb-4" />
                    <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">Acesso negado</h2>
                    <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                        Você não tem permissão para acessar o painel técnico.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                    >
                        Ir para o Dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-surface-50 dark:bg-surface-950">
            {/* ─── Top Bar ────────────────────────────────── */}
            <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 safe-area-top">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
                        Kalibrium
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Pending sync badge */}
                    {pendingCount > 0 && (
                        <button
                            onClick={() => syncNow()}
                            disabled={isSyncing || !isOnline}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
                            {pendingCount}
                        </button>
                    )}

                    {/* Online/offline indicator */}
                    <div className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                        isOnline
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    )}>
                        {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                </div>
            </header>

            {/* ─── Sync notification bar ─────────────────── */}
            {showSyncBar && (
                <div className="px-4 py-1.5 bg-emerald-500 text-white text-xs text-center font-medium animate-in slide-in-from-top-2">
                    ✓ Sincronizado com sucesso
                </div>
            )}

            {/* ─── Content Area ──────────────────────────── */}
            <main className="flex-1 overflow-y-auto overscroll-contain">
                <Outlet />
            </main>

            {/* ─── More menu overlay ─────────────────────── */}
            {showMoreMenu && (
                <div className="absolute inset-0 z-50 flex flex-col">
                    <button
                        onClick={() => setShowMoreMenu(false)}
                        className="flex-1 bg-black/40 backdrop-blur-sm"
                        aria-label="Fechar menu"
                    />
                    <div className="bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 rounded-t-2xl p-4 pb-6 safe-area-bottom animate-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">Mais opções</h3>
                            <button onClick={() => setShowMoreMenu(false)} className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                                <X className="w-5 h-5 text-surface-500" />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {MORE_ITEMS.map((item) => {
                                const isActive = location.pathname === item.path
                                return (
                                    <button
                                        key={item.path}
                                        onClick={() => { navigate(item.path); setShowMoreMenu(false) }}
                                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 active:scale-95 transition-all"
                                    >
                                        <div className={cn(
                                            'w-10 h-10 rounded-xl flex items-center justify-center',
                                            isActive ? 'bg-brand-100 dark:bg-brand-900/30' : 'bg-surface-100 dark:bg-surface-800'
                                        )}>
                                            <item.icon className={cn('w-5 h-5', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-surface-600 dark:text-surface-400')} />
                                        </div>
                                        <span className={cn('text-[10px] font-medium', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-surface-600 dark:text-surface-400')}>
                                            {item.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Bottom Navigation ─────────────────────── */}
            <nav className="flex items-center justify-around bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 safe-area-bottom">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.end}
                        className={({ isActive }) => cn(
                            'flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors min-w-[60px]',
                            isActive
                                ? 'text-brand-600 dark:text-brand-400'
                                : 'text-surface-500 dark:text-surface-400'
                        )}
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
                <button
                    onClick={() => setShowMoreMenu(true)}
                    className={cn(
                        'flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors min-w-[60px]',
                        showMoreMenu ? 'text-brand-600 dark:text-brand-400' : 'text-surface-500 dark:text-surface-400'
                    )}
                >
                    <Menu className="w-5 h-5" />
                    <span>Mais</span>
                </button>
            </nav>
        </div>
    )
}
