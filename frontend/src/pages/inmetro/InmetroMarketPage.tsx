import { useState , useMemo } from 'react'
import {
    BarChart3, TrendingUp, Users, Scale, AlertTriangle, Clock, MapPin,
    Warehouse, Shield, ChevronDown, ChevronUp, Loader2
} from 'lucide-react'
import {
    useMarketOverview, useCompetitorAnalysis, useRegionalAnalysis,
    useBrandAnalysis, useExpirationForecast
} from '@/hooks/useInmetro'
import { Link } from 'react-router-dom'

const statusLabels: Record<string, string> = {
    approved: 'Aprovado',
    rejected: 'Reprovado',
    repaired: 'Reparado',
    unknown: 'Desconhecido',
}

const statusColors: Record<string, string> = {
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    repaired: 'bg-amber-500',
    unknown: 'bg-surface-400',
}

export function InmetroMarketPage() {

    const { data: overview, isLoading: loadingOverview } = useMarketOverview()
    const { data: competitors, isLoading: loadingComp } = useCompetitorAnalysis()
    const { data: regional, isLoading: loadingRegional } = useRegionalAnalysis()
    const { data: brands, isLoading: loadingBrands } = useBrandAnalysis()
    const { data: forecast, isLoading: loadingForecast } = useExpirationForecast()

    const isLoading = loadingOverview || loadingComp || loadingRegional || loadingBrands || loadingForecast

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 w-64 bg-surface-200 rounded" />
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-24 bg-surface-100 rounded-xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-64 bg-surface-100 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    const maxForecast = forecast ? Math.max(...forecast.months.map(m => m.count), 1) : 1

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900">Dashboard de Mercado</h1>
                    <p className="text-sm text-surface-500 mt-0.5">Análise de mercado, concorrência e oportunidades</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/inmetro" className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors">
                        <BarChart3 className="h-4 w-4" /> Dashboard
                    </Link>
                    <Link to="/inmetro/mapa" className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors">
                        <MapPin className="h-4 w-4" /> Mapa
                    </Link>
                </div>
            </div>

            {/* Market KPIs */}
            {overview && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <KPICard icon={Users} label="Proprietários" value={overview.total_owners} color="brand" />
                    <KPICard icon={Scale} label="Instrumentos" value={overview.total_instruments} color="blue" />
                    <KPICard icon={Warehouse} label="Concorrentes" value={overview.total_competitors} color="amber" />
                    <KPICard icon={TrendingUp} label="Taxa Conversão" value={`${overview.conversion_rate}%`} color="green" />
                    <KPICard icon={AlertTriangle} label="Oportunidades" value={overview.market_opportunity} color="red" subtitle={`${overview.overdue} vencidos + ${overview.expiring_90d} expirando`} />
                </div>
            )}

            {/* Row 1: Expiration Forecast + Regional */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expiration Forecast Chart */}
                {forecast && (
                    <div className="rounded-xl border border-default bg-surface-0 p-5">
                        <h2 className="text-sm font-semibold text-surface-800 mb-1 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" /> Previsão de Vencimentos (12 meses)
                        </h2>
                        <p className="text-xs text-surface-500 mb-4">
                            {forecast.overdue} vencidos + {forecast.total_upcoming_12m} nos próximos 12 meses
                        </p>
                        <div className="flex items-end gap-1 h-40">
                            {forecast.months.map(m => (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[9px] font-bold text-surface-600">{m.count || ''}</span>
                                    <div
                                        className={`w-full rounded-t transition-all ${m.count > 0 ? 'bg-gradient-to-t from-amber-500 to-amber-300' : 'bg-surface-100'}`}
                                        style={{ height: `${Math.max((m.count / maxForecast) * 100, 2)}%`, minHeight: '2px' }}
                                    />
                                    <span className="text-[8px] text-surface-400 -rotate-45 origin-center whitespace-nowrap">{m.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Regional by State */}
                {regional && (
                    <div className="rounded-xl border border-default bg-surface-0 p-5">
                        <h2 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-brand-500" /> Distribuição por Estado
                        </h2>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                            {regional.by_state.map(row => {
                                const maxInst = regional.by_state[0]?.instrument_count || 1
                                return (
                                    <div key={row.state} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-surface-700 w-8">{row.state}</span>
                                        <div className="flex-1 h-5 rounded bg-surface-100 overflow-hidden relative">
                                            <div
                                                className="h-full rounded bg-gradient-to-r from-brand-400 to-brand-500 transition-all"
                                                style={{ width: `${(row.instrument_count / maxInst) * 100}%` }}
                                            />
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-surface-700">
                                                {row.instrument_count} equip. • {row.owner_count} prop.
                                            </span>
                                        </div>
                                        {row.overdue_count > 0 && (
                                            <span className="text-[10px] font-medium text-red-500">{row.overdue_count} venc.</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Row 2: Brands + Competitor Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Brand Analysis */}
                {brands && (
                    <div className="rounded-xl border border-default bg-surface-0 p-5">
                        <h2 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" /> Análise de Marcas
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Top Brands */}
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-2">Top Marcas</p>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {brands.by_brand.slice(0, 10).map((b, i) => (
                                        <div key={b.brand} className="flex items-center justify-between">
                                            <span className="text-xs text-surface-700 truncate max-w-[120px]">
                                                <span className="text-surface-400 mr-1">{i + 1}.</span>{b.brand}
                                            </span>
                                            <span className="text-xs font-bold text-surface-500">{b.total}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* By Type */}
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-2">Por Tipo</p>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {brands.by_type.map(t => (
                                        <div key={t.type} className="flex items-center justify-between">
                                            <span className="text-xs text-surface-700 truncate max-w-[120px]">{t.type}</span>
                                            <span className="text-xs font-bold text-surface-500">{t.total}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Status Distribution */}
                        <div className="mt-4 pt-3 border-t border-subtle">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-2">Por Status</p>
                            <div className="flex gap-2">
                                {brands.by_status.map(s => {
                                    const total = brands.by_status.reduce((acc, x) => acc + x.total, 0) || 1
                                    return (
                                        <div key={s.status} className="flex-1 text-center">
                                            <div className="h-2 rounded-full bg-surface-100 overflow-hidden mb-1">
                                                <div
                                                    className={`h-full rounded-full ${statusColors[s.status] || 'bg-surface-400'}`}
                                                    style={{ width: `${(s.total / total) * 100}%` }}
                                                />
                                            </div>
                                            <p className="text-xs font-bold text-surface-700">{s.total}</p>
                                            <p className="text-[9px] text-surface-400">{statusLabels[s.status] || s.status}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Competitor Analysis */}
                {competitors && <CompetitorSection data={competitors} />}
            </div>

            {/* Row 3: Top Cities */}
            {regional && (
                <div className="rounded-xl border border-default bg-surface-0 p-5">
                    <h2 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-brand-500" /> Top Cidades por Instrumentos
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-surface-500 border-b border-subtle">
                                    <th className="py-2 pr-4 font-semibold">Cidade</th>
                                    <th className="py-2 pr-4 font-semibold">UF</th>
                                    <th className="py-2 pr-4 font-semibold text-right">Instrumentos</th>
                                    <th className="py-2 pr-4 font-semibold text-right">Proprietários</th>
                                    <th className="py-2 font-semibold text-right">Vencidos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {regional.by_city.slice(0, 20).map(row => (
                                    <tr key={`${row.city}-${row.state}`} className="border-b border-subtle last:border-0 hover:bg-surface-50 transition-colors">
                                        <td className="py-2 pr-4 font-medium text-surface-800">{row.city}</td>
                                        <td className="py-2 pr-4 text-surface-500">{row.state}</td>
                                        <td className="py-2 pr-4 text-right font-bold text-brand-600">{row.instrument_count}</td>
                                        <td className="py-2 pr-4 text-right text-surface-600">{row.owner_count}</td>
                                        <td className="py-2 text-right">
                                            {row.overdue_count > 0 ? (
                                                <span className="text-red-600 font-bold">{row.overdue_count}</span>
                                            ) : (
                                                <span className="text-surface-300">—</span>
                                            )}
                                        </td>
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

function KPICard({ icon: Icon, label, value, color, subtitle }: {
    icon: React.ElementType; label: string; value: number | string; color: string; subtitle?: string
}) {
    const colorMap: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 border-brand-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        green: 'bg-green-50 text-green-600 border-green-100',
    }
    return (
        <div className={`rounded-xl border p-4 ${colorMap[color] || 'bg-surface-50 text-surface-600 border-default'}`}>
            <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 opacity-70" />
            </div>
            <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            <p className="text-xs font-medium opacity-70 mt-0.5">{label}</p>
            {subtitle && <p className="text-[10px] opacity-50 mt-0.5">{subtitle}</p>}
        </div>
    )
}

function CompetitorSection({ data }: { data: NonNullable<ReturnType<typeof useCompetitorAnalysis>['data']> }) {
    const citiesToShow = showAll ? data.by_city : data.by_city.slice(0, 8)
    const maxComp = data.by_city[0]?.total || 1

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-5">
            <h2 className="text-sm font-semibold text-surface-800 mb-1 flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-amber-500" /> Análise de Concorrência
            </h2>
            <p className="text-xs text-surface-500 mb-4">
                {data.total_competitor_cities} cidades com concorrentes • Nossa presença em {data.our_presence_in_competitor_cities}
            </p>

            {/* By City Bars */}
            <div className="space-y-1.5 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1">Concorrentes por Cidade</p>
                {citiesToShow.map(c => (
                    <div key={c.city} className="flex items-center gap-2">
                        <span className="text-xs text-surface-700 truncate w-28">{c.city}</span>
                        <div className="flex-1 h-3 rounded-full bg-surface-100 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                                style={{ width: `${(c.total / maxComp) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold text-surface-500 w-6 text-right">{c.total}</span>
                    </div>
                ))}
                {data.by_city.length > 8 && (
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-0.5 mt-1"
                    >
                        {showAll ? <><ChevronUp className="h-3 w-3" /> Mostrar menos</> : <><ChevronDown className="h-3 w-3" /> Ver todas ({data.by_city.length})</>}
                    </button>
                )}
            </div>

            {/* Species Distribution */}
            {Object.keys(data.species_distribution).length > 0 && (
                <div className="pt-3 border-t border-subtle">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-2">Espécies Autorizadas</p>
                    <div className="flex flex-wrap gap-1.5">
                        {Object.entries(data.species_distribution).slice(0, 10).map(([species, count]) => (
                            <span key={species} className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 border border-amber-200">
                                {species} <span className="font-bold">({count})</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default InmetroMarketPage
