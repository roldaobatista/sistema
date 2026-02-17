import { useQuery } from '@tanstack/react-query'
import { Package, AlertTriangle, TrendingDown, DollarSign, ArrowRight, Warehouse, Tag, ClipboardCheck, ScrollText, ArrowLeftRight, BarChart3, QrCode } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'

interface StockSummary {
    total_products: number
    total_value: number
    low_stock_count: number
    out_of_stock_count: number
}

interface LowStockProduct {
    id: number
    name: string
    code: string | null
    unit: string
    stock_qty: string
    stock_min: string
    category: { id: number; name: string } | null
}

export function StockDashboardPage() {
    const { data: summaryRes, isLoading: loadingSummary, isError: summaryError } = useQuery({
        queryKey: ['stock-summary'],
        queryFn: () => api.get('/stock/summary'),
    })
    const summary: StockSummary = summaryRes?.data?.stats ?? { total_products: 0, total_value: 0, low_stock_count: 0, out_of_stock_count: 0 }

    const { data: alertsRes, isLoading: loadingAlerts, isError: alertsError } = useQuery({
        queryKey: ['stock-low-alerts'],
        queryFn: () => api.get('/stock/low-alerts'),
    })
    const alerts: LowStockProduct[] = alertsRes?.data?.data ?? []

    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const cards = [
        { label: 'Total de Produtos', value: summary.total_products, icon: Package, color: 'text-brand-600 bg-brand-50' },
        { label: 'Valor em Estoque', value: formatBRL(summary.total_value), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Estoque Baixo', value: summary.low_stock_count, icon: TrendingDown, color: 'text-amber-600 bg-amber-50' },
        { label: 'Sem Estoque', value: summary.out_of_stock_count, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    ]

    return (
        <div className="space-y-5">
            <PageHeader
                title="Estoque"
                subtitle="Visão geral do controle de estoque"
                actions={[
                    {
                        label: 'Ver Movimentações',
                        icon: <ArrowRight className="h-4 w-4" />,
                        href: '/estoque/movimentacoes',
                    },
                ]}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map(card => (
                    <div key={card.label} className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.color)}>
                                <card.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-surface-500">{card.label}</p>
                                <p className="text-xl font-bold text-surface-900">
                                    {loadingSummary ? '—' : summaryError ? 'Erro' : card.value}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {!loadingSummary && summary.total_products > 0 && (() => {
                const ok = summary.total_products - summary.low_stock_count - summary.out_of_stock_count
                const total = summary.total_products
                const pOk = (ok / total) * 100
                const pLow = (summary.low_stock_count / total) * 100
                const pOut = (summary.out_of_stock_count / total) * 100
                return (
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-surface-900">Saúde do Estoque</h3>
                            <span className="text-xs text-surface-400">{total} produtos ativos</span>
                        </div>
                        <div className="flex h-4 rounded-full overflow-hidden bg-surface-100">
                            <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${pOk}%` }}
                                title={`Em dia: ${ok} (${pOk.toFixed(0)}%)`} />
                            <div className="bg-amber-500 transition-all duration-700" style={{ width: `${pLow}%` }}
                                title={`Baixo: ${summary.low_stock_count} (${pLow.toFixed(0)}%)`} />
                            <div className="bg-red-500 transition-all duration-700" style={{ width: `${pOut}%` }}
                                title={`Sem estoque: ${summary.out_of_stock_count} (${pOut.toFixed(0)}%)`} />
                        </div>
                        <div className="flex items-center gap-4 mt-2.5 text-xs">
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="text-surface-600">Em dia ({ok})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                                <span className="text-surface-600">Baixo ({summary.low_stock_count})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                <span className="text-surface-600">Zerado ({summary.out_of_stock_count})</span>
                            </div>
                        </div>
                    </div>
                )
            })()}

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
                {[
                    { label: 'Armazéns', icon: Warehouse, path: '/estoque/armazens', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
                    { label: 'Lotes', icon: Tag, path: '/estoque/lotes', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
                    { label: 'Movimentações', icon: ArrowLeftRight, path: '/estoque/movimentacoes', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
                    { label: 'Inventário Cego', icon: ClipboardCheck, path: '/estoque/inventarios', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
                    { label: 'Meu inventário', icon: ClipboardCheck, path: '/estoque/inventario-pwa', color: 'text-teal-600 bg-teal-50 hover:bg-teal-100' },
                    { label: 'Etiquetas', icon: Tag, path: '/estoque/etiquetas', color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
                    { label: 'Kardex', icon: ScrollText, path: '/estoque/kardex', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
                    { label: 'Inteligência', icon: BarChart3, path: '/estoque/inteligencia', color: 'text-rose-600 bg-rose-50 hover:bg-rose-100' },
                    { label: 'Integração', icon: QrCode, path: '/estoque/integracao', color: 'text-cyan-600 bg-cyan-50 hover:bg-cyan-100' },
                ].map(link => (
                    <Link
                        key={link.path}
                        to={link.path}
                        className={cn(
                            'flex items-center gap-3 rounded-xl border border-default p-4 transition-colors duration-150',
                            link.color,
                        )}
                    >
                        <link.icon className="h-5 w-5" />
                        <span className="text-sm font-semibold">{link.label}</span>
                        <ArrowRight className="ml-auto h-4 w-4 opacity-40" />
                    </Link>
                ))}
            </div>

            <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="border-b border-subtle px-5 py-4">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-surface-900">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Alertas de Estoque Baixo
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-subtle bg-surface-50">
                                <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Produto</th>
                                <th className="hidden px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500 md:table-cell">Categoria</th>
                                <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Atual</th>
                                <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Mínimo</th>
                                <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Deficit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingAlerts ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                            ) : alertsError ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-red-500">Erro ao carregar alertas. Tente recarregar a página.</td></tr>
                            ) : alerts.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Package className="h-8 w-8 text-surface-300" />
                                        Nenhum produto com estoque baixo 🎉
                                    </div>
                                </td></tr>
                            ) : alerts.map(p => {
                                const deficit = parseFloat(p.stock_min) - parseFloat(p.stock_qty)
                                const isZero = parseFloat(p.stock_qty) <= 0
                                return (
                                    <tr key={p.id} className="hover:bg-surface-50 transition-colors duration-100">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', isZero ? 'bg-red-50' : 'bg-amber-50')}>
                                                    {isZero ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <TrendingDown className="h-4 w-4 text-amber-600" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-surface-900">{p.name}</p>
                                                    {p.code && <p className="text-xs text-surface-400">#{p.code}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hidden px-4 py-3 md:table-cell">
                                            {p.category ? <Badge variant="brand">{p.category.name}</Badge> : <span className="text-xs text-surface-400">—</span>}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-right">
                                            <span className={cn('text-sm font-medium', isZero ? 'text-red-600' : 'text-amber-600')}>
                                                {parseFloat(p.stock_qty)} {p.unit}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-2.5 text-right text-sm text-surface-600">
                                            {parseFloat(p.stock_min)} {p.unit}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-right">
                                            <Badge variant={isZero ? 'red' : 'amber'}>
                                                -{deficit.toFixed(1)} {p.unit}
                                            </Badge>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
