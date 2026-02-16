import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/pageheader'
import { Gauge, TrendingUp, Clock, DollarSign, BarChart3, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const fmtBRL = (v: number | string) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface VelocityData {
    avg_cycle_days: number
    avg_deal_value: number
    velocity_number: number
    win_rate: number
    total_deals: number
    stages: {
        name: string
        deals_count: number
        total_value: number
        avg_days_in_stage: number
    }[]
}

export function CrmVelocityPage() {
    const [months, setMonths] = useState('6')
    const [pipelineId, setPipelineId] = useState('all')

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['crm-velocity', months, pipelineId],
        queryFn: () =>
            crmFeaturesApi.getPipelineVelocity({
                months: Number(months),
                pipeline_id: pipelineId !== 'all' ? Number(pipelineId) : undefined,
            }),
    })

    const velocity: VelocityData = res?.data?.data ?? res?.data ?? {
        avg_cycle_days: 0,
        avg_deal_value: 0,
        velocity_number: 0,
        win_rate: 0,
        total_deals: 0,
        stages: [],
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <p className="text-surface-600">Erro ao carregar dados de velocidade.</p>
                <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
        )
    }

    const metrics = [
        {
            label: 'Ciclo Médio',
            value: `${velocity.avg_cycle_days.toFixed(1)} dias`,
            icon: Clock,
            color: 'text-blue-600 bg-blue-50',
        },
        {
            label: 'Valor Médio',
            value: fmtBRL(velocity.avg_deal_value),
            icon: DollarSign,
            color: 'text-green-600 bg-green-50',
        },
        {
            label: 'Velocidade',
            value: fmtBRL(velocity.velocity_number),
            icon: Gauge,
            color: 'text-purple-600 bg-purple-50',
            description: 'Receita potencial/dia',
        },
        {
            label: 'Taxa de Conversão',
            value: `${(velocity.win_rate ?? 0).toFixed(1)}%`,
            icon: TrendingUp,
            color: 'text-orange-600 bg-orange-50',
        },
    ]

    const stageMaxValue = Math.max(...(velocity.stages?.map(s => s.total_value) ?? [1]), 1)

    return (
        <div className="space-y-6">
            <PageHeader
                title="Velocidade do Pipeline"
                subtitle="Análise de velocidade e ciclo de vendas por etapa do funil."
                icon={Gauge}
            />

            <div className="flex flex-wrap items-center gap-3">
                <Select value={pipelineId} onValueChange={setPipelineId}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Pipelines</SelectItem>
                        <SelectItem value="1">Pipeline Principal</SelectItem>
                        <SelectItem value="2">Pipeline Secundário</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={months} onValueChange={setMonths}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="3">Últimos 3 meses</SelectItem>
                        <SelectItem value="6">Últimos 6 meses</SelectItem>
                        <SelectItem value="12">Últimos 12 meses</SelectItem>
                    </SelectContent>
                </Select>

                <Badge variant="secondary" className="ml-auto">
                    {velocity.total_deals ?? 0} negócios analisados
                </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((m) => (
                    <Card key={m.label}>
                        <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-surface-500">{m.label}</p>
                                    <p className="text-2xl font-bold mt-1">{m.value}</p>
                                    {m.description && (
                                        <p className="text-xs text-surface-400 mt-1">{m.description}</p>
                                    )}
                                </div>
                                <div className={`rounded-lg p-2.5 ${m.color}`}>
                                    <m.icon className="h-5 w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Análise por Etapa
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!velocity.stages?.length ? (
                        <div className="flex flex-col items-center py-10 text-surface-400">
                            <BarChart3 className="h-10 w-10 mb-2" />
                            <p>Nenhuma etapa encontrada para o período selecionado.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-surface-500">
                                        <th className="pb-3 pr-4 font-medium">Etapa</th>
                                        <th className="pb-3 pr-4 font-medium text-right">Negócios Ativos</th>
                                        <th className="pb-3 pr-4 font-medium text-right">Valor Total</th>
                                        <th className="pb-3 pr-4 font-medium text-right">Média de Dias</th>
                                        <th className="pb-3 font-medium min-w-[200px]">Volume</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {velocity.stages.map((stage) => (
                                        <tr key={stage.name} className="border-b last:border-0">
                                            <td className="py-3 pr-4 font-medium">{stage.name}</td>
                                            <td className="py-3 pr-4 text-right tabular-nums">
                                                {stage.deals_count}
                                            </td>
                                            <td className="py-3 pr-4 text-right tabular-nums">
                                                {fmtBRL(stage.total_value)}
                                            </td>
                                            <td className="py-3 pr-4 text-right tabular-nums">
                                                <Badge variant={stage.avg_days_in_stage > 30 ? 'destructive' : 'secondary'}>
                                                    {stage.avg_days_in_stage.toFixed(1)}d
                                                </Badge>
                                            </td>
                                            <td className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary-500 rounded-full transition-all"
                                                            style={{ width: `${(stage.total_value / stageMaxValue) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Fórmula de Velocidade</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                        <div className="text-center px-4 py-2 bg-blue-50 rounded-lg">
                            <p className="text-xs text-surface-500">Negócios</p>
                            <p className="text-lg font-bold text-blue-700">{velocity.total_deals}</p>
                        </div>
                        <span className="text-xl text-surface-400">×</span>
                        <div className="text-center px-4 py-2 bg-green-50 rounded-lg">
                            <p className="text-xs text-surface-500">Valor Médio</p>
                            <p className="text-lg font-bold text-green-700">{fmtBRL(velocity.avg_deal_value)}</p>
                        </div>
                        <span className="text-xl text-surface-400">×</span>
                        <div className="text-center px-4 py-2 bg-orange-50 rounded-lg">
                            <p className="text-xs text-surface-500">Win Rate</p>
                            <p className="text-lg font-bold text-orange-700">{(velocity.win_rate ?? 0).toFixed(1)}%</p>
                        </div>
                        <span className="text-xl text-surface-400">÷</span>
                        <div className="text-center px-4 py-2 bg-red-50 rounded-lg">
                            <p className="text-xs text-surface-500">Ciclo (dias)</p>
                            <p className="text-lg font-bold text-red-700">{velocity.avg_cycle_days.toFixed(1)}</p>
                        </div>
                        <span className="text-xl text-surface-400">=</span>
                        <div className="text-center px-4 py-2 bg-purple-50 rounded-lg border-2 border-purple-200">
                            <p className="text-xs text-surface-500">Velocidade</p>
                            <p className="text-lg font-bold text-purple-700">{fmtBRL(velocity.velocity_number)}/dia</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
