import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmForecast } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
    TrendingUp, TrendingDown, Target, Camera, BarChart3, DollarSign,
    ArrowUpRight, ArrowDownRight, Loader2, RefreshCw,
} from 'lucide-react'

const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

const fmtMonth = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export function CrmForecastPage() {
    const queryClient = useQueryClient()
    const [months, setMonths] = useState('6')

    const { data, isLoading, isError } = useQuery({
        queryKey: ['crm-forecast', months],
        queryFn: () => crmFeaturesApi.getForecast({ months: Number(months) }).then(r => r.data),
    })

    const snapshotMut = useMutation({
        mutationFn: () => crmFeaturesApi.createSnapshot(),
        onSuccess: () => {
            toast.success('Snapshot do forecast salvo com sucesso')
            queryClient.invalidateQueries({ queryKey: ['crm-forecast'] })
        },
        onError: () => toast.error('Erro ao salvar snapshot'),
    })

    const forecasts: CrmForecast[] = data?.forecast ?? []
    const historicalWon: unknown[] = data?.historical_won ?? []

    const totals = forecasts.reduce(
        (acc, f) => ({
            pipeline: acc.pipeline + f.pipeline_value,
            weighted: acc.weighted + f.weighted_value,
            bestCase: acc.bestCase + f.best_case,
            worstCase: acc.worstCase + f.worst_case,
            committed: acc.committed + f.committed,
            deals: acc.deals + f.deal_count,
        }),
        { pipeline: 0, weighted: 0, bestCase: 0, worstCase: 0, committed: 0, deals: 0 },
    )

    const avgWinRate = forecasts.length
        ? forecasts.reduce((s, f) => s + f.historical_win_rate, 0) / forecasts.length
        : 0

    const maxWeighted = Math.max(...forecasts.map(f => f.weighted_value), 1)

    return (
        <div className="space-y-6">
            <PageHeader
                title="Previsão de Vendas"
                subtitle="Forecast de receita com cenários e análise histórica"
                icon={BarChart3}
            >
                <Select value={months} onValueChange={setMonths}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => snapshotMut.mutate()}
                    disabled={snapshotMut.isPending}
                    icon={snapshotMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                >
                    Salvar Snapshot
                </Button>
            </PageHeader>

            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {isError && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <RefreshCw className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Erro ao carregar previsão de vendas.</p>
                            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['crm-forecast'] })}>
                                Tentar novamente
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && (
                <>
                    {/* KPI Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                        <DollarSign className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Pipeline Total</p>
                                        <p className="text-2xl font-bold">{fmtBRL(totals.pipeline)}</p>
                                        <p className="text-xs text-muted-foreground">{totals.deals} negócios</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Melhor Cenário</p>
                                        <p className="text-2xl font-bold text-emerald-700">{fmtBRL(totals.bestCase)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                                        <Target className="h-6 w-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Ponderado</p>
                                        <p className="text-2xl font-bold text-amber-700">{fmtBRL(totals.weighted)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                                        <TrendingDown className="h-6 w-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Pior Cenário</p>
                                        <p className="text-2xl font-bold text-purple-700">{fmtBRL(totals.worstCase)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Win Rate + Committed */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Taxa de Conversão Histórica</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <div className="relative h-24 w-24">
                                        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                                            <path
                                                d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                                                fill="none"
                                                stroke="currentColor"
                                                className="text-muted/30"
                                                strokeWidth="3"
                                            />
                                            <path
                                                d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                                                fill="none"
                                                stroke="currentColor"
                                                className="text-emerald-500"
                                                strokeWidth="3"
                                                strokeDasharray={`${avgWinRate * 100}, 100`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                                            {fmtPct(avgWinRate)}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                            Média das taxas de conversão dos períodos selecionados
                                        </p>
                                        {avgWinRate >= 0.3 ? (
                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                                                <ArrowUpRight className="mr-1 h-3 w-3" /> Acima da média
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-red-100 text-red-700">
                                                <ArrowDownRight className="mr-1 h-3 w-3" /> Abaixo da média
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Committed (Confirmado)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <p className="text-3xl font-bold">{fmtBRL(totals.committed)}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Valor de negócios com alta probabilidade de fechamento
                                    </p>
                                    <div className="h-2 rounded-full bg-muted">
                                        <div
                                            className="h-2 rounded-full bg-emerald-500 transition-all"
                                            style={{ width: `${totals.pipeline ? Math.min((totals.committed / totals.pipeline) * 100, 100) : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {totals.pipeline ? ((totals.committed / totals.pipeline) * 100).toFixed(1) : 0}% do pipeline total
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Revenue Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Receita Prevista por Período</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {forecasts.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Nenhum dado de previsão disponível
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-end gap-2" style={{ height: 220 }}>
                                        {forecasts.map((f, i) => (
                                            <div key={i} className="flex flex-1 flex-col items-center gap-1">
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    {fmtBRL(f.weighted_value)}
                                                </span>
                                                <div className="relative w-full flex justify-center gap-0.5" style={{ height: 180 }}>
                                                    <div
                                                        className="w-1/4 rounded-t bg-emerald-200 transition-all"
                                                        style={{ height: `${(f.best_case / maxWeighted) * 100}%`, marginTop: 'auto' }}
                                                        title={`Melhor: ${fmtBRL(f.best_case)}`}
                                                    />
                                                    <div
                                                        className="w-1/4 rounded-t bg-blue-500 transition-all"
                                                        style={{ height: `${(f.weighted_value / maxWeighted) * 100}%`, marginTop: 'auto' }}
                                                        title={`Ponderado: ${fmtBRL(f.weighted_value)}`}
                                                    />
                                                    <div
                                                        className="w-1/4 rounded-t bg-amber-400 transition-all"
                                                        style={{ height: `${(f.worst_case / maxWeighted) * 100}%`, marginTop: 'auto' }}
                                                        title={`Pior: ${fmtBRL(f.worst_case)}`}
                                                    />
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {fmtMonth(f.period_start)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-block h-3 w-3 rounded bg-emerald-200" /> Melhor Cenário
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-block h-3 w-3 rounded bg-blue-500" /> Ponderado
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-block h-3 w-3 rounded bg-amber-400" /> Pior Cenário
                                        </span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Forecast Detail Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Detalhamento por Período</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="pb-3 font-medium">Período</th>
                                            <th className="pb-3 font-medium text-right">Pipeline</th>
                                            <th className="pb-3 font-medium text-right">Melhor</th>
                                            <th className="pb-3 font-medium text-right">Ponderado</th>
                                            <th className="pb-3 font-medium text-right">Pior</th>
                                            <th className="pb-3 font-medium text-right">Committed</th>
                                            <th className="pb-3 font-medium text-right">Negócios</th>
                                            <th className="pb-3 font-medium text-right">Win Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {forecasts.map((f, i) => (
                                            <tr key={i} className="border-b last:border-0">
                                                <td className="py-3 font-medium">{fmtMonth(f.period_start)}</td>
                                                <td className="py-3 text-right">{fmtBRL(f.pipeline_value)}</td>
                                                <td className="py-3 text-right text-emerald-600">{fmtBRL(f.best_case)}</td>
                                                <td className="py-3 text-right text-blue-600 font-medium">{fmtBRL(f.weighted_value)}</td>
                                                <td className="py-3 text-right text-amber-600">{fmtBRL(f.worst_case)}</td>
                                                <td className="py-3 text-right">{fmtBRL(f.committed)}</td>
                                                <td className="py-3 text-right">{f.deal_count}</td>
                                                <td className="py-3 text-right">{fmtPct(f.historical_win_rate)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {forecasts.length > 1 && (
                                        <tfoot>
                                            <tr className="font-semibold border-t-2">
                                                <td className="pt-3">Total</td>
                                                <td className="pt-3 text-right">{fmtBRL(totals.pipeline)}</td>
                                                <td className="pt-3 text-right text-emerald-600">{fmtBRL(totals.bestCase)}</td>
                                                <td className="pt-3 text-right text-blue-600">{fmtBRL(totals.weighted)}</td>
                                                <td className="pt-3 text-right text-amber-600">{fmtBRL(totals.worstCase)}</td>
                                                <td className="pt-3 text-right">{fmtBRL(totals.committed)}</td>
                                                <td className="pt-3 text-right">{totals.deals}</td>
                                                <td className="pt-3 text-right">{fmtPct(avgWinRate)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
