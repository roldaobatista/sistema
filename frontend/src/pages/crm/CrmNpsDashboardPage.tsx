import { useQuery } from '@tanstack/react-query'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Loader2, Smile, Meh, Frown, TrendingUp, Users, Star, BarChart3 } from 'lucide-react'

interface NpsStats {
    score: number
    total_responses: number
    promoters: number
    passives: number
    detractors: number
    by_month: { month: string; score: number; responses: number }[]
    recent_feedback: { customer_name: string; score: number; feedback: string; created_at: string }[]
}

function scoreColor(score: number) {
    if (score >= 9) return 'text-green-600'
    if (score >= 7) return 'text-amber-500'
    return 'text-red-500'
}

function npsCategory(score: number) {
    if (score >= 50) return { label: 'Excelente', color: 'bg-green-100 text-green-800' }
    if (score >= 0) return { label: 'Bom', color: 'bg-amber-100 text-amber-800' }
    return { label: 'Crítico', color: 'bg-red-100 text-red-800' }
}

export function CrmNpsDashboardPage() {
    const { data, isLoading } = useQuery<NpsStats>({
        queryKey: ['crm-nps-stats'],
        queryFn: () => crmFeaturesApi.getNpsStats(),
    })

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader title="NPS Dashboard" subtitle="Net Promoter Score do módulo comercial" icon={Star} />
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            </div>
        )
    }

    const stats = data ?? { score: 0, total_responses: 0, promoters: 0, passives: 0, detractors: 0, by_month: [], recent_feedback: [] }
    const total = stats.promoters + stats.passives + stats.detractors || 1
    const promoterPct = Math.round((stats.promoters / total) * 100)
    const passivePct = Math.round((stats.passives / total) * 100)
    const detractorPct = Math.round((stats.detractors / total) * 100)
    const cat = npsCategory(stats.score)

    return (
        <div className="space-y-6">
            <PageHeader title="NPS Dashboard" subtitle="Net Promoter Score do módulo comercial" icon={Star} />

            {/* Score Hero Card */}
            <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-emerald-500/5" />
                <CardContent className="relative pt-8 pb-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-500/20 to-emerald-500/20 blur-xl scale-150" />
                            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-brand-200 bg-surface-0 shadow-lg">
                                <div className="text-center">
                                    <p className="text-4xl font-black tracking-tight text-brand-600">{stats.score}</p>
                                    <p className="text-xs font-medium text-muted-foreground">NPS Score</p>
                                </div>
                            </div>
                        </div>
                        <Badge className={cat.color}>{cat.label}</Badge>
                        <p className="text-sm text-muted-foreground">
                            Baseado em <strong>{stats.total_responses}</strong> respostas
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Distribution Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Promotores (9-10)</p>
                                <p className="text-2xl font-bold text-green-600">{stats.promoters}</p>
                                <p className="text-xs text-muted-foreground">{promoterPct}% do total</p>
                            </div>
                            <Smile className="h-10 w-10 text-green-500/50" />
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-surface-100">
                            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${promoterPct}%` }} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Neutros (7-8)</p>
                                <p className="text-2xl font-bold text-amber-600">{stats.passives}</p>
                                <p className="text-xs text-muted-foreground">{passivePct}% do total</p>
                            </div>
                            <Meh className="h-10 w-10 text-amber-500/50" />
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-surface-100">
                            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${passivePct}%` }} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Detratores (0-6)</p>
                                <p className="text-2xl font-bold text-red-600">{stats.detractors}</p>
                                <p className="text-xs text-muted-foreground">{detractorPct}% do total</p>
                            </div>
                            <Frown className="h-10 w-10 text-red-500/50" />
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-surface-100">
                            <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${detractorPct}%` }} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stacked Bar Visual */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="h-4 w-4" />
                        Distribuição Visual
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-8 w-full overflow-hidden rounded-full">
                        <div className="flex items-center justify-center bg-green-500 text-xs font-bold text-white transition-all" style={{ width: `${promoterPct}%` }}>
                            {promoterPct > 10 && `${promoterPct}%`}
                        </div>
                        <div className="flex items-center justify-center bg-amber-400 text-xs font-bold text-white transition-all" style={{ width: `${passivePct}%` }}>
                            {passivePct > 10 && `${passivePct}%`}
                        </div>
                        <div className="flex items-center justify-center bg-red-500 text-xs font-bold text-white transition-all" style={{ width: `${detractorPct}%` }}>
                            {detractorPct > 10 && `${detractorPct}%`}
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Promotores</span>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Neutros</span>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Detratores</span>
                    </div>
                </CardContent>
            </Card>

            {/* Monthly Trend */}
            {stats.by_month.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-4 w-4" />
                            Evolução Mensal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {stats.by_month.map(m => (
                                <div key={m.month} className="flex items-center gap-3">
                                    <span className="w-20 text-xs font-medium text-muted-foreground">{m.month}</span>
                                    <div className="flex-1 h-6 bg-surface-100 rounded-full overflow-hidden relative">
                                        <div
                                            className={`h-full rounded-full transition-all ${m.score >= 50 ? 'bg-green-500' : m.score >= 0 ? 'bg-amber-400' : 'bg-red-500'}`}
                                            style={{ width: `${Math.max(5, ((m.score + 100) / 200) * 100)}%` }}
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
                                            {m.score}
                                        </span>
                                    </div>
                                    <span className="w-16 text-right text-xs text-muted-foreground">{m.responses} resp.</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recent Feedback */}
            {stats.recent_feedback?.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="h-4 w-4" />
                            Feedbacks Recentes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.recent_feedback.map((fb, i) => (
                                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${fb.score >= 9 ? 'bg-green-500' : fb.score >= 7 ? 'bg-amber-400' : 'bg-red-500'}`}>
                                        {fb.score}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium truncate">{fb.customer_name}</p>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {new Date(fb.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        {fb.feedback && (
                                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{fb.feedback}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
