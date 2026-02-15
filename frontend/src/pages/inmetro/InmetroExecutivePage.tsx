import {
    useExecutiveDashboard,
    useRevenueForecast,
    useConversionFunnel,
    useYearOverYear,
    useSegmentDistribution,
} from '@/hooks/useInmetroAdvanced'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
    TrendingUp,
    TrendingDown,
    BarChart3,
    DollarSign,
    Users,
    Target,
    Percent,
    Calendar,
} from 'lucide-react'

function KpiCard({ label, value, icon: Icon, trend, trendLabel }: {
    label: string
    value: string | number
    icon: React.ElementType
    trend?: 'up' | 'down' | 'neutral'
    trendLabel?: string
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="text-2xl font-bold mt-1">{value}</p>
                        {trendLabel && (
                            <p className={`text-xs mt-1 flex items-center gap-1 ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
                                {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                                {trendLabel}
                            </p>
                        )}
                    </div>
                    <Icon className="w-10 h-10 text-muted-foreground/30" />
                </div>
            </CardContent>
        </Card>
    )
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="font-medium">{value}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

export default function InmetroExecutivePage() {

    const { data: dashboard, isLoading: loadingDash } = useExecutiveDashboard()
    const { data: forecast } = useRevenueForecast()
    const { data: funnel } = useConversionFunnel()
    const { data: yoy } = useYearOverYear()
    const { data: segments } = useSegmentDistribution()

    if (loadingDash) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
                <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
            </div>
        )
    }

    const kpis = dashboard?.kpis ?? {}
    const roi = dashboard?.roi ?? {}

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Dashboard Executivo INMETRO</h1>
                <p className="text-muted-foreground">Visão estratégica do módulo de inteligência de mercado</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Leads Totais" value={kpis.total_leads ?? 0} icon={Users} />
                <KpiCard label="Taxa de Conversão" value={`${kpis.conversion_rate ?? 0}%`} icon={Percent} />
                <KpiCard label="Receita Potencial" value={`R$ ${(kpis.potential_revenue ?? 0).toLocaleString('pt-BR')}`} icon={DollarSign} />
                <KpiCard label="ROI do Módulo" value={`${roi.roi_percentage ?? 0}%`} icon={Target} trend={roi.roi_percentage > 100 ? 'up' : 'down'} trendLabel={roi.roi_percentage > 100 ? 'Positivo' : 'Necessita atenção'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Conversion Funnel */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" /> Funil de Conversão
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {funnel?.stages ? (
                            Object.entries(funnel.stages).map(([stage, count]) => {
                                const colors: Record<string, string> = {
                                    new: 'bg-blue-500',
                                    contacted: 'bg-cyan-500',
                                    negotiating: 'bg-amber-500',
                                    converted: 'bg-green-500',
                                    lost: 'bg-red-500',
                                }
                                const labels: Record<string, string> = {
                                    new: 'Novos',
                                    contacted: 'Contatados',
                                    negotiating: 'Em Negociação',
                                    converted: 'Convertidos',
                                    lost: 'Perdidos',
                                }
                                const maxVal = Math.max(...Object.values(funnel.stages as Record<string, number>))
                                return (
                                    <FunnelBar
                                        key={stage}
                                        label={labels[stage] || stage}
                                        value={count as number}
                                        max={maxVal}
                                        color={colors[stage] || 'bg-gray-500'}
                                    />
                                )
                            })
                        ) : (
                            <p className="text-center text-muted-foreground py-4">Sem dados de funil</p>
                        )}
                        {funnel?.conversion_rates && (
                            <div className="mt-4 pt-4 border-t space-y-2">
                                <p className="text-sm font-medium">Taxas de Conversão</p>
                                {Object.entries(funnel.conversion_rates).map(([key, val]) => (
                                    <div key={key} className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{key}</span>
                                        <span className="font-medium">{String(val)}%</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Revenue Forecast */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" /> Previsão de Receita
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {forecast?.forecast ? (
                            <div className="space-y-3">
                                {forecast.forecast.map((m: any) => (
                                    <div key={m.month} className="flex items-center justify-between">
                                        <span className="text-sm">{m.label ?? m.month}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">R$ {(m.estimated_revenue ?? 0).toLocaleString('pt-BR')}</span>
                                            <Badge variant="outline">{m.calibrations ?? 0} cal.</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Sem dados de previsão</p>
                        )}
                    </CardContent>
                </Card>

                {/* Year over Year */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" /> Comparativo Anual
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {yoy?.comparison ? (
                            <div className="space-y-4">
                                {Object.entries(yoy.comparison).map(([metric, data]: [string, any]) => (
                                    <div key={metric} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="capitalize">{metric.replace(/_/g, ' ')}</span>
                                            <span className={data.change > 0 ? 'text-green-500' : data.change < 0 ? 'text-red-500' : ''}>
                                                {data.change > 0 ? '+' : ''}{data.change}%
                                            </span>
                                        </div>
                                        <div className="flex gap-4 text-xs text-muted-foreground">
                                            <span>{yoy.previous_year}: {data.previous}</span>
                                            <span>{yoy.current_year}: {data.current}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Sem dados comparativos</p>
                        )}
                    </CardContent>
                </Card>

                {/* Segment Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5" /> Distribuição por Segmento
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {segments?.segments ? (
                            <div className="space-y-3">
                                {segments.segments.map((seg: any) => {
                                    const total = segments.total || 1
                                    const pct = ((seg.count / total) * 100).toFixed(1)
                                    return (
                                        <div key={seg.segment} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="capitalize">{seg.segment || 'Não classificado'}</span>
                                                <span>{seg.count} ({pct}%)</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Sem dados de segmento</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
