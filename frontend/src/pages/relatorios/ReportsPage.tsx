import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    ClipboardList, Users, DollarSign, Award, TrendingUp,
    Calendar, ArrowRight, FileText, Phone, Wallet, Target, Scale, Download,
    Truck, Package, UserCheck, FileX, Building2,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import {
    OsReportTab, ProductivityReportTab, FinancialReportTab,
    CommissionsReportTab, ProfitabilityReportTab, QuotesReportTab,
    ServiceCallsReportTab, TechnicianCashReportTab, CrmReportTab,
    EquipmentsReportTab, SuppliersReportTab, StockReportTab,
    CustomersReportTab,
} from './tabs'

type Tab = 'os' | 'productivity' | 'financial' | 'commissions' | 'profitability' | 'quotes' | 'service_calls' | 'technician_cash' | 'crm' | 'equipments' | 'suppliers' | 'stock' | 'customers'

const tabs: { key: Tab; label: string; icon: any; permission: string }[] = [
    { key: 'os', label: 'Ordens', icon: ClipboardList, permission: 'reports.os_report.view' },
    { key: 'productivity', label: 'Produtividade', icon: Users, permission: 'reports.productivity_report.view' },
    { key: 'financial', label: 'Financeiro', icon: DollarSign, permission: 'reports.financial_report.view' },
    { key: 'commissions', label: 'Comissões', icon: Award, permission: 'reports.commission_report.view' },
    { key: 'profitability', label: 'Margem', icon: TrendingUp, permission: 'reports.margin_report.view' },
    { key: 'quotes', label: 'Orçamentos', icon: FileText, permission: 'reports.quotes_report.view' },
    { key: 'service_calls', label: 'Chamados', icon: Phone, permission: 'reports.service_calls_report.view' },
    { key: 'technician_cash', label: 'Caixa', icon: Wallet, permission: 'reports.technician_cash_report.view' },
    { key: 'crm', label: 'CRM', icon: Target, permission: 'reports.crm_report.view' },
    { key: 'equipments', label: 'Equipamentos', icon: Scale, permission: 'reports.equipments_report.view' },
    { key: 'suppliers', label: 'Fornecedores', icon: Truck, permission: 'reports.suppliers_report.view' },
    { key: 'stock', label: 'Estoque', icon: Package, permission: 'reports.stock_report.view' },
    { key: 'customers', label: 'Clientes', icon: UserCheck, permission: 'reports.customers_report.view' },
]

const endpoint: Record<Tab, string> = {
    os: '/reports/work-orders',
    productivity: '/reports/productivity',
    financial: '/reports/financial',
    commissions: '/reports/commissions',
    profitability: '/reports/profitability',
    quotes: '/reports/quotes',
    service_calls: '/reports/service-calls',
    technician_cash: '/reports/technician-cash',
    crm: '/reports/crm',
    equipments: '/reports/equipments',
    suppliers: '/reports/suppliers',
    stock: '/reports/stock',
    customers: '/reports/customers',
}

const exportType: Record<Tab, string> = {
    os: 'work-orders',
    productivity: 'productivity',
    financial: 'financial',
    commissions: 'commissions',
    profitability: 'profitability',
    quotes: 'quotes',
    service_calls: 'service-calls',
    technician_cash: 'technician-cash',
    crm: 'crm',
    equipments: 'equipments',
    suppliers: 'suppliers',
    stock: 'stock',
    customers: 'customers',
}

const tabComponents: Record<Tab, React.FC<{ data: any }>> = {
    os: OsReportTab,
    productivity: ProductivityReportTab,
    financial: FinancialReportTab,
    commissions: CommissionsReportTab,
    profitability: ProfitabilityReportTab,
    quotes: QuotesReportTab,
    service_calls: ServiceCallsReportTab,
    technician_cash: TechnicianCashReportTab,
    crm: CrmReportTab,
    equipments: EquipmentsReportTab,
    suppliers: SuppliersReportTab,
    stock: StockReportTab,
    customers: CustomersReportTab,
}

export function ReportsPage() {
    const { hasPermission } = useAuthStore()

    const visibleTabs = useMemo(
        () => tabs.filter(t => hasPermission(t.permission)),
        [hasPermission]
    )

    const [tab, setTab] = useState<Tab>(() => visibleTabs[0]?.key ?? 'os')
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'
    const [from, setFrom] = useState(monthStart)
    const [to, setTo] = useState(today)
    const [osNumber, setOsNumber] = useState('')
    const [branchId, setBranchId] = useState('')
    const [isExporting, setIsExporting] = useState(false)
    const [exportError, setExportError] = useState('')
    const isFinancialTab = ['financial', 'commissions', 'profitability', 'technician_cash'].includes(tab)

    const { data: branchesRes } = useQuery({
        queryKey: ['branches-list'],
        queryFn: () => api.get('/branches'),
        staleTime: 5 * 60 * 1000,
    })
    const branches: { id: number; name: string }[] = branchesRes?.data ?? []

    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.some(t => t.key === tab)) {
            setTab(visibleTabs[0].key)
        }
    }, [visibleTabs, tab])

    const { data: res, isLoading, isError } = useQuery({
        queryKey: ['report', tab, from, to, isFinancialTab ? osNumber : '', branchId],
        queryFn: () => api.get(endpoint[tab], {
            params: {
                from,
                to,
                ...(isFinancialTab && osNumber.trim() ? { os_number: osNumber.trim() } : {}),
                ...(branchId ? { branch_id: branchId } : {}),
            },
        }),
        enabled: visibleTabs.some(t => t.key === tab),
    })

    useEffect(() => {
        if (isError) toast.error('Erro ao carregar relatório. Tente novamente.')
    }, [isError])

    const data = res?.data ?? {}

    const handleExport = async () => {
        setIsExporting(true)
        try {
            const reportType = exportType[tab]
            const response = await api.get(`/reports/${reportType}/export`, {
                params: {
                    from,
                    to,
                    ...(isFinancialTab && osNumber.trim() ? { os_number: osNumber.trim() } : {}),
                    ...(branchId ? { branch_id: branchId } : {}),
                },
                responseType: 'blob',
            })

            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `relatorio-${reportType}-${from}-${to}.csv`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (err: any) {
            const status = err?.response?.status
            if (status === 403) {
                setExportError('Sem permissão para exportar este relatório.')
            } else {
                setExportError('Erro ao exportar relatório. Tente novamente.')
            }
            setTimeout(() => setExportError(''), 5000)
        } finally {
            setIsExporting(false)
        }
    }

    if (visibleTabs.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-20 text-surface-400">
                <FileX className="h-12 w-12" />
                <p className="text-sm font-medium">Você não possui permissão para acessar nenhum relatório.</p>
            </div>
        )
    }

    const TabContent = tabComponents[tab]

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Relatórios</h1>
                <p className="mt-0.5 text-sm text-surface-500">Análise de desempenho e resultados</p>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap rounded-lg border border-default bg-surface-50 p-0.5">
                    {visibleTabs.map(t => {
                        const Icon = t.icon
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                                    tab === t.key ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
                                <Icon className="h-3.5 w-3.5" />{t.label}
                            </button>
                        )
                    })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {branches.length > 1 && !['stock', 'suppliers'].includes(tab) && (
                        <div className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-surface-400" />
                            <select
                                value={branchId}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBranchId(e.target.value)}
                                aria-label="Filtrar por filial"
                                className="rounded-lg border border-default bg-surface-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                            >
                                <option value="">Todas filiais</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {isFinancialTab && (
                        <input
                            value={osNumber}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOsNumber(e.target.value)}
                            placeholder="Filtrar por OS física"
                            className="w-52 rounded-lg border border-default bg-surface-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                        />
                    )}
                    <Calendar className="h-4 w-4 text-surface-400" />
                    <input type="date" value={from} max={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} aria-label="Data início"
                        className="rounded-lg border border-default bg-surface-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
                    <ArrowRight className="h-3.5 w-3.5 text-surface-400" />
                    <input type="date" value={to} min={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} aria-label="Data fim"
                        className="rounded-lg border border-default bg-surface-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        title="Exportar CSV"
                        className="flex items-center gap-1.5 rounded-lg border border-default bg-surface-50 px-3 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Download className="h-3.5 w-3.5" />
                        {isExporting ? 'Gerando...' : 'CSV'}
                    </button>
                    {exportError && (
                        <span className="text-xs text-red-600 font-medium">{exportError}</span>
                    )}
                </div>
            </div>

            {isLoading && (
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="rounded-xl border border-default bg-surface-0 p-4 shadow-card animate-pulse">
                                <div className="h-3 w-20 rounded bg-surface-200 mb-3" />
                                <div className="h-6 w-16 rounded bg-surface-200 mb-2" />
                                <div className="h-3 w-24 rounded bg-surface-100" />
                            </div>
                        ))}
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card animate-pulse">
                        <div className="h-4 w-32 rounded bg-surface-200 mb-4" />
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <div key={i} className="h-3 w-full rounded bg-surface-100" />)}
                        </div>
                    </div>
                </div>
            )}
            {isError && <div className="py-12 text-center text-sm text-red-600">Erro ao carregar relatório. Verifique sua conexão e tente novamente.</div>}

            {!isLoading && !isError && TabContent && <TabContent data={data} />}
        </div>
    )
}
