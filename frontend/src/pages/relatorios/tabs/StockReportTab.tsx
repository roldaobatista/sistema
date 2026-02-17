import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { Package, AlertTriangle, DollarSign, Archive } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const COLORS = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b']

interface Props { data: any }

export function StockReportTab({ data }: Props) {
    const summary = data.summary ?? {}
    const products = data.products ?? []
    const movements = data.recent_movements ?? []

    const top10 = [...products]
        .map((p: any) => ({
            name: p.name?.substring(0, 25) ?? 'Sem nome',
            value: Number(p.stock_qty ?? 0) * Number(p.cost_price ?? 0),
        }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 10)

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCardSpark label="Produtos" value={summary.total_products ?? 0} icon={<Package className="h-4 w-4" />} sparkColor="#6366f1" />
                <KpiCardSpark
                    label="Sem Estoque"
                    value={summary.out_of_stock ?? 0}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    sparkColor="#ef4444"
                    valueClassName={(summary.out_of_stock ?? 0) > 0 ? 'text-red-600' : undefined}
                />
                <KpiCardSpark
                    label="Estoque Baixo"
                    value={summary.low_stock ?? 0}
                    icon={<Archive className="h-4 w-4" />}
                    sparkColor="#f59e0b"
                    valueClassName={(summary.low_stock ?? 0) > 0 ? 'text-amber-600' : undefined}
                />
                <KpiCardSpark label="Valor Total" value={fmtBRL(summary.total_cost_value ?? 0)} icon={<DollarSign className="h-4 w-4" />} sparkColor="#22c55e" />
            </div>

            {top10.length > 0 && (
                <ChartCard title="Top 10 — Valor em Estoque" icon={<Package className="h-4 w-4" />} height={350}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                            <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: any) => [fmtBRL(Number(v)), 'Valor'] as any} />
                            <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} animationDuration={800}>
                                {top10.map((_: any, i: number) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {movements.length > 0 && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                    <div className="px-5 pt-4 pb-2">
                        <h3 className="text-sm font-semibold text-surface-700">Movimentações Recentes</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-surface-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-surface-500">Produto</th>
                                    <th className="px-4 py-2 text-center font-medium text-surface-500">Tipo</th>
                                    <th className="px-4 py-2 text-right font-medium text-surface-500">Qtd</th>
                                    <th className="px-4 py-2 text-left font-medium text-surface-500">Referência</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {movements.slice(0, 20).map((m: any) => (
                                    <tr key={m.id}>
                                        <td className="px-4 py-2 max-w-[200px] truncate">{m.product_name}</td>
                                        <td className="px-4 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${m.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {m.type === 'in' ? 'Entrada' : 'Saída'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums font-medium">{m.quantity}</td>
                                        <td className="px-4 py-2 text-surface-500">{m.reference}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
