import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGamificationDashboard, recalculateGamification } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Trophy, Medal, RefreshCw, Star, MapPin, Briefcase, Users, Target, Handshake, TrendingUp, Award, Flame, Crown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const RANK_CONFIG = [
    { icon: Crown, bg: 'bg-gradient-to-br from-amber-400 to-amber-600', ring: 'ring-amber-300', text: 'text-white', shadow: 'shadow-amber-200/50' },
    { icon: Medal, bg: 'bg-gradient-to-br from-surface-300 to-surface-500', ring: 'ring-surface-300', text: 'text-white', shadow: 'shadow-surface-200/50' },
    { icon: Award, bg: 'bg-gradient-to-br from-amber-600 to-amber-800', ring: 'ring-amber-400', text: 'text-white', shadow: 'shadow-amber-300/50' },
]

const STAT_ICONS: Record<string, React.ElementType> = {
    visits_count: MapPin,
    deals_won: Briefcase,
    activities_count: Users,
    coverage_percent: Target,
    csat_avg: Star,
}

export function CrmGamificationPage() {
    const qc = useQueryClient()
    const { data, isLoading } = useQuery({ queryKey: ['gamification'], queryFn: getGamificationDashboard })
    const recalcMut = useMutation({
        mutationFn: recalculateGamification,
        onSuccess: (d) => {
            qc.invalidateQueries({ queryKey: ['gamification'] })
            toast.success(d.message)
        },
    })

    const leaderboard = data?.leaderboard ?? []
    const top3 = leaderboard.slice(0, 3)
    const rest = leaderboard.slice(3)

    // Calculate totals for stats cards
    const totals = leaderboard.reduce(
        (acc: Record<string, number>, s: Record<string, unknown>) => ({
            visits: acc.visits + (s.visits_count as number ?? 0),
            deals: acc.deals + (s.deals_won as number ?? 0),
            activities: acc.activities + (s.activities_count as number ?? 0),
            points: acc.points + (s.total_points as number ?? 0),
        }),
        { visits: 0, deals: 0, activities: 0, points: 0 },
    )

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader title="Gamificação Comercial" description="Ranking e conquistas do time de vendas" />
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <PageHeader title="Gamificação Comercial" description={`Ranking e conquistas — ${data?.period ?? ''}`} />
                <Button onClick={() => recalcMut.mutate()} disabled={recalcMut.isPending} variant="ghost">
                    {recalcMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Recalcular
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Pontos', value: totals.points, icon: Flame, color: 'text-amber-600 bg-amber-50' },
                    { label: 'Visitas', value: totals.visits, icon: MapPin, color: 'text-blue-600 bg-blue-50' },
                    { label: 'Deals Fechados', value: totals.deals, icon: Briefcase, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Atividades', value: totals.activities, icon: Users, color: 'text-purple-600 bg-purple-50' },
                ].map((stat) => (
                    <Card key={stat.label}>
                        <CardContent className="py-4 flex items-center gap-3">
                            <div className={`rounded-lg p-2.5 ${stat.color}`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-surface-900 tabular-nums">{stat.value.toLocaleString('pt-BR')}</p>
                                <p className="text-xs text-surface-500">{stat.label}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Podium - Top 3 */}
            {top3.length > 0 && (
                <div className="grid grid-cols-3 gap-4 items-end">
                    {/* Reorder: 2nd, 1st, 3rd for visual podium effect */}
                    {[top3[1], top3[0], top3[2]].map((s, podiumIdx) => {
                        if (!s) return <div key={podiumIdx} />
                        const realIdx = podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2
                        const config = RANK_CONFIG[realIdx]
                        const isFirst = realIdx === 0

                        return (
                            <Card key={s.id as number} className={`relative overflow-hidden transition-all hover:scale-[1.02] ${isFirst ? 'shadow-lg' : ''}`}>
                                <div className={`absolute top-0 left-0 right-0 h-1.5 ${config.bg}`} />
                                <CardContent className={`py-6 text-center ${isFirst ? 'py-8' : ''}`}>
                                    <div className={`inline-flex items-center justify-center rounded-full ${config.bg} ${config.text} ring-4 ${config.ring} shadow-lg ${config.shadow} mb-3 ${isFirst ? 'h-16 w-16' : 'h-12 w-12'}`}>
                                        <config.icon className={isFirst ? 'h-8 w-8' : 'h-6 w-6'} />
                                    </div>
                                    <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider mb-1">
                                        {realIdx === 0 ? '🥇 1º Lugar' : realIdx === 1 ? '🥈 2º Lugar' : '🥉 3º Lugar'}
                                    </p>
                                    <p className={`font-bold text-surface-900 truncate ${isFirst ? 'text-lg' : 'text-base'}`}>
                                        {(s.user as Record<string, unknown>)?.name as string}
                                    </p>
                                    <p className={`font-bold text-brand-600 mt-1 ${isFirst ? 'text-3xl' : 'text-2xl'}`}>
                                        {(s.total_points as number).toLocaleString('pt-BR')}
                                    </p>
                                    <p className="text-xs text-surface-400">pontos</p>

                                    {/* Mini stats */}
                                    <div className="flex justify-center gap-3 mt-4 pt-3 border-t border-subtle">
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-surface-700">{s.visits_count as number}</p>
                                            <p className="text-[10px] text-surface-400">Visitas</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-surface-700">{s.deals_won as number}</p>
                                            <p className="text-[10px] text-surface-400">Deals</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-surface-700">{s.coverage_percent as number}%</p>
                                            <p className="text-[10px] text-surface-400">Cobertura</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Full Ranking Table */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            Ranking Completo
                        </CardTitle>
                        <Badge variant="outline">{data?.period}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-y border-subtle bg-surface-50/80">
                                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-surface-500 uppercase">#</th>
                                    <th className="text-left px-3 text-xs font-semibold text-surface-500 uppercase">Vendedor</th>
                                    <th className="text-center px-3"><MapPin className="h-3.5 w-3.5 mx-auto text-surface-400" /></th>
                                    <th className="text-center px-3"><Briefcase className="h-3.5 w-3.5 mx-auto text-surface-400" /></th>
                                    <th className="text-center px-3"><Users className="h-3.5 w-3.5 mx-auto text-surface-400" /></th>
                                    <th className="text-center px-3"><Target className="h-3.5 w-3.5 mx-auto text-surface-400" /></th>
                                    <th className="text-center px-3"><Star className="h-3.5 w-3.5 mx-auto text-surface-400" /></th>
                                    <th className="text-center px-3"><Handshake className="h-3.5 w-3.5 mx-auto text-surface-400" /></th>
                                    <th className="text-right px-3 text-xs font-semibold text-surface-500 uppercase">Pontos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {leaderboard.map((s: Record<string, unknown>, idx: number) => {
                                    const isTop3 = idx < 3
                                    return (
                                        <tr key={s.id as number} className={`hover:bg-surface-50/80 transition-colors ${isTop3 ? 'bg-amber-50/30' : ''}`}>
                                            <td className="text-center py-2.5 px-3">
                                                {isTop3 ? (
                                                    <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' :
                                                            idx === 1 ? 'bg-surface-200 text-surface-600' :
                                                                'bg-amber-100/70 text-amber-600'
                                                        }`}>
                                                        {s.rank_position as number}
                                                    </span>
                                                ) : (
                                                    <span className="text-surface-400 font-medium">{s.rank_position as number}</span>
                                                )}
                                            </td>
                                            <td className="px-3 font-medium text-surface-800">
                                                {(s.user as Record<string, unknown>)?.name as string}
                                            </td>
                                            <td className="text-center px-3 tabular-nums text-surface-600">{s.visits_count as number}</td>
                                            <td className="text-center px-3 tabular-nums text-surface-600">{s.deals_won as number}</td>
                                            <td className="text-center px-3 tabular-nums text-surface-600">{s.activities_count as number}</td>
                                            <td className="text-center px-3 tabular-nums text-surface-600">{s.coverage_percent as number}%</td>
                                            <td className="text-center px-3 tabular-nums text-surface-600">{s.csat_avg as number}</td>
                                            <td className="text-center px-3 tabular-nums text-surface-600">
                                                {s.commitments_on_time as number}/{s.commitments_total as number}
                                            </td>
                                            <td className="text-right px-3 font-bold text-brand-600 tabular-nums">{(s.total_points as number).toLocaleString('pt-BR')}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
