import { useState } from 'react'
import { BarChart3, Users, Scale, AlertTriangle, Clock, CheckCircle, XCircle, TrendingUp, MapPin } from 'lucide-react'
import { useInmetroDashboard, useInmetroCities } from '@/hooks/useInmetro'
import { Link } from 'react-router-dom'

const statusLabels: Record<string, string> = {
    approved: 'Aprovado',
    rejected: 'Reprovado',
    repaired: 'Reparado',
    unknown: 'Desconhecido',
}

const statusColors: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    repaired: 'bg-amber-100 text-amber-700',
    unknown: 'bg-surface-100 text-surface-600',
}

export function InmetroDashboardPage() {
    const { data: dashboard, isLoading } = useInmetroDashboard()
    const { data: cities } = useInmetroCities()

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 w-64 bg-surface-200 rounded" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-24 bg-surface-100 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (!dashboard) return null

    const { totals, leads, by_city, by_status, by_brand } = dashboard

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900">Inteligência INMETRO</h1>
                    <p className="text-sm text-surface-500 mt-0.5">Prospecção inteligente baseada em dados públicos</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        to="/inmetro/import"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                        Importar
                    </Link>
                    <Link
                        to="/inmetro/competitors"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                        Concorrentes
                    </Link>
                    <Link
                        to="/inmetro/leads"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                    >
                        <Users className="h-4 w-4" /> Ver Leads
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="Proprietários" value={totals.owners} icon={Users} color="brand" to="/inmetro/leads" />
                <KPICard label="Instrumentos" value={totals.instruments} icon={Scale} color="blue" to="/inmetro/instrumentos" />
                <KPICard label="Vencidos" value={totals.overdue} icon={AlertTriangle} color="red" to="/inmetro/instrumentos?overdue=true" />
                <KPICard label="Vence em 30d" value={totals.expiring_30d} icon={Clock} color="amber" to="/inmetro/instrumentos?days_until_due=30" />
                <KPICard label="Vence em 60d" value={totals.expiring_60d} icon={Clock} color="orange" to="/inmetro/instrumentos?days_until_due=60" />
                <KPICard label="Vence em 90d" value={totals.expiring_90d} icon={Clock} color="yellow" to="/inmetro/instrumentos?days_until_due=90" />
                <KPICard label="Leads Novos" value={leads.new} icon={TrendingUp} color="green" to="/inmetro/leads?lead_status=new" />
                <KPICard label="Convertidos" value={leads.converted} icon={CheckCircle} color="emerald" to="/inmetro/leads?lead_status=converted" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* By City */}
                <div className="col-span-1 lg:col-span-2 rounded-xl border border-default bg-surface-0 p-5">
                    <h2 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-brand-500" /> Instrumentos por Cidade
                    </h2>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {(by_city ?? []).map((item: { city: string; total: number }) => (
                            <Link
                                key={item.city}
                                to={`/inmetro/instrumentos?city=${encodeURIComponent(item.city || '')}`}
                                className="flex items-center justify-between py-1.5 border-b border-subtle last:border-0 hover:bg-surface-50 rounded px-1 -mx-1 transition-colors"
                            >
                                <span className="text-sm text-surface-700 font-medium">{item.city || 'Sem cidade'}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 rounded-full bg-surface-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-brand-500"
                                            style={{ width: `${Math.min((item.total / (by_city?.[0]?.total || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-surface-600 w-10 text-right">{item.total}</span>
                                </div>
                            </Link>
                        ))}
                        {(!by_city || by_city.length === 0) && (
                            <p className="text-sm text-surface-400 text-center py-4">Nenhum dado importado. Importe dados primeiro.</p>
                        )}
                    </div>
                </div>

                {/* By Status + Brand */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-default bg-surface-0 p-5">
                        <h2 className="text-sm font-semibold text-surface-800 mb-4">Status dos Instrumentos</h2>
                        <div className="space-y-2">
                            {(by_status ?? []).map((item: { current_status: string; total: number }) => (
                                <div key={item.current_status} className="flex items-center justify-between">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[item.current_status] || 'bg-surface-100 text-surface-600'}`}>
                                        {statusLabels[item.current_status] || item.current_status}
                                    </span>
                                    <span className="text-sm font-bold text-surface-700">{item.total}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 p-5">
                        <h2 className="text-sm font-semibold text-surface-800 mb-4">Top Marcas</h2>
                        <div className="space-y-2">
                            {(by_brand ?? []).map((item: { brand: string; total: number }) => (
                                <div key={item.brand} className="flex items-center justify-between">
                                    <span className="text-sm text-surface-700">{item.brand}</span>
                                    <span className="text-xs font-bold text-surface-500">{item.total}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Lead Pipeline */}
            <div className="rounded-xl border border-default bg-surface-0 p-5">
                <h2 className="text-sm font-semibold text-surface-800 mb-4">Pipeline de Leads</h2>
                <div className="flex gap-4">
                    <PipelineCard label="Novos" value={leads.new} color="bg-blue-500" to="/inmetro/leads?lead_status=new" />
                    <PipelineCard label="Contactados" value={leads.contacted} color="bg-amber-500" to="/inmetro/leads?lead_status=contacted" />
                    <PipelineCard label="Negociando" value={leads.negotiating ?? 0} color="bg-purple-500" to="/inmetro/leads?lead_status=negotiating" />
                    <PipelineCard label="Convertidos" value={leads.converted} color="bg-green-500" to="/inmetro/leads?lead_status=converted" />
                    <PipelineCard label="Perdidos" value={leads.lost ?? 0} color="bg-surface-400" to="/inmetro/leads?lead_status=lost" />
                </div>
            </div>
        </div>
    )
}

function KPICard({ label, value, icon: Icon, color, to }: {
    label: string; value: number; icon: React.ElementType; color: string; to?: string
}) {
    const colorMap: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 border-brand-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    }
    const cls = `rounded-xl border p-4 transition-shadow hover:shadow-md cursor-pointer ${colorMap[color] || 'bg-surface-50 text-surface-600 border-default'}`
    const content = (
        <>
            <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 opacity-70" />
            </div>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs font-medium opacity-70 mt-0.5">{label}</p>
        </>
    )
    if (to) return <Link to={to} className={cls}>{content}</Link>
    return <div className={cls}>{content}</div>
}

function PipelineCard({ label, value, color, to }: { label: string; value: number; color: string; to?: string }) {
    const cls = "flex-1 rounded-xl border border-default bg-surface-0 p-4 text-center transition-shadow hover:shadow-md cursor-pointer"
    const content = (
        <>
            <div className={`h-1.5 rounded-full ${color} mb-3`} />
            <p className="text-2xl font-bold text-surface-900">{value}</p>
            <p className="text-xs text-surface-500 mt-0.5">{label}</p>
        </>
    )
    if (to) return <Link to={to} className={cls}>{content}</Link>
    return <div className={cls}>{content}</div>
}

export default InmetroDashboardPage

