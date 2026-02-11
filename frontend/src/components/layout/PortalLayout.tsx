import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    FileText,
    LogOut,
    Menu,
    X,
    User,
    Phone,
    DollarSign,
    Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePortalAuthStore } from '@/stores/portal-auth-store'
import { useState } from 'react'

interface NavItem {
    label: string
    icon: React.ElementType
    path: string
}

const navigation: NavItem[] = [
    { label: 'Visão Geral', icon: LayoutDashboard, path: '/portal' },
    { label: 'Minhas OS', icon: FileText, path: '/portal/os' },
    { label: 'Orçamentos', icon: DollarSign, path: '/portal/orcamentos' },
    { label: 'Financeiro', icon: DollarSign, path: '/portal/financeiro' },
    { label: 'Abrir Chamado', icon: Phone, path: '/portal/chamados/novo' },
]

export function PortalLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation()
    const { user, logout } = usePortalAuthStore()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const isActive = (path: string) => location.pathname === path

    return (
        <div className="min-h-screen bg-surface-50">
            {/* Topbar */}
            <header className="bg-white border-b border-subtle sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center gap-2">
                                <div className="bg-brand-600 text-white p-1.5 rounded-lg font-bold">
                                    PC
                                </div>
                                <span className="font-bold text-surface-900 hidden sm:block">Portal do Cliente</span>
                            </div>
                            <nav className="hidden sm:ml-6 sm:flex sm:space-x-4">
                                {navigation.map((item) => (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={cn(
                                            "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 h-full",
                                            isActive(item.path)
                                                ? "border-brand-500 text-brand-600"
                                                : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 mr-2" />
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-surface-600 hidden sm:block">
                                Olá, <span className="font-semibold text-surface-900">{user?.name}</span>
                            </span>
                            <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
                                {user?.name?.charAt(0)}
                            </div>
                            <button
                                onClick={() => logout()}
                                className="p-2 rounded-full text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                            <button
                                className="sm:hidden p-2 text-surface-500"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="sm:hidden bg-white border-t border-subtle">
                        <div className="pt-2 pb-4 space-y-1">
                            {navigation.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                        "block pl-3 pr-4 py-2 border-l-4 text-base font-medium",
                                        isActive(item.path)
                                            ? "bg-brand-50 border-brand-500 text-brand-700"
                                            : "border-transparent text-surface-500 hover:bg-surface-50 hover:border-surface-300 hover:text-surface-700"
                                    )}
                                >
                                    <div className="flex items-center">
                                        <item.icon className="h-5 w-5 mr-3" />
                                        {item.label}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    )
}
