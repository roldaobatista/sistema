import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crmFeaturesApi, CrmCohort } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/pageheader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Loader2, AlertCircle, TrendingUp, Info } from 'lucide-react'

function getCellColor(pct: number): string {
    if (pct >= 50) return 'bg-green-600 text-white'
    if (pct >= 30) return 'bg-green-500 text-white'
    if (pct >= 20) return 'bg-green-400 text-white'
    if (pct >= 10) return 'bg-green-300 text-green-900'
    if (pct >= 5) return 'bg-green-200 text-green-800'
    if (pct > 0) return 'bg-green-100 text-green-700'
    return 'bg-surface-50 text-surface-400'
}

function formatMonth(isoMonth: string): string {
    const [year, month] = isoMonth.split('-')
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${months[Number(month) - 1]}/${year?.slice(2)}`
}

const COHORT_COLUMNS = ['month_0', 'month_1', 'month_2', 'month_3', 'month_4', 'month_5', 'month_6'] as const

export function CrmCohortPage() {
    const [months, setMonths] = useState('12')

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['crm-cohort', months],
        queryFn: () => crmFeaturesApi.getCohortAnalysis({ months: Number(months) }),
    })

    const raw = res?.data
    const cohorts: CrmCohort[] = Array.isArray(raw) ? raw : (raw as unknown as { data?: CrmCohort[] })?.data ?? []

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
                <p className="text-surface-600">Erro ao carregar análise de coorte.</p>
                <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
        )
    }

    const totalCreated = cohorts.reduce((sum, c) => sum + c.created, 0)

    const avgConversionByMonth: Record<string, number> = {}
    COHORT_COLUMNS.forEach((col) => {
        const values = cohorts
            .map((c) => (c.conversions?.[col] != null && c.created > 0 ? (c.conversions[col] / c.created) * 100 : null))
            .filter((v): v is number => v !== null)
        avgConversionByMonth[col] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
    })

    return (
        <div className="space-y-6">
            <PageHeader
                title="Análise de Coorte"
                subtitle="Visualize a conversão de leads agrupados por mês de criação."
                icon={Users}
            />

            <div className="flex flex-wrap items-center gap-3">
                <Select value={months} onValueChange={setMonths}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="6">Últimos 6 meses</SelectItem>
                        <SelectItem value="12">Últimos 12 meses</SelectItem>
                        <SelectItem value="18">Últimos 18 meses</SelectItem>
                    </SelectContent>
                </Select>

                <Badge variant="secondary" className="ml-auto">
                    {totalCreated} leads analisados
                </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Mês 0 (Imediato)', col: 'month_0', color: 'text-blue-600 bg-blue-50' },
                    { label: 'Mês 3', col: 'month_3', color: 'text-green-600 bg-green-50' },
                    { label: 'Mês 6', col: 'month_6', color: 'text-purple-600 bg-purple-50' },
                ].map((m) => (
                    <Card key={m.col}>
                        <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-surface-500">Conversão {m.label}</p>
                                    <p className="text-2xl font-bold mt-1">
                                        {(avgConversionByMonth[m.col] ?? 0).toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-surface-400 mt-1">Média entre coortes</p>
                                </div>
                                <div className={`rounded-lg p-2.5 ${m.color}`}>
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Mapa de Calor - Conversão por Coorte
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!cohorts.length ? (
                        <div className="flex flex-col items-center py-10 text-surface-400">
                            <Users className="h-10 w-10 mb-2" />
                            <p>Nenhum dado de coorte disponível para o período selecionado.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-surface-500">
                                        <th className="pb-3 pr-4 text-left font-medium">Coorte</th>
                                        <th className="pb-3 pr-2 text-right font-medium">Criados</th>
                                        {COHORT_COLUMNS.map((col, i) => (
                                            <th key={col} className="pb-3 px-1 text-center font-medium min-w-[70px]">
                                                Mês {i}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {cohorts.map((cohort) => (
                                        <tr key={cohort.cohort} className="border-b last:border-0">
                                            <td className="py-2 pr-4 font-medium whitespace-nowrap">
                                                {formatMonth(cohort.cohort)}
                                            </td>
                                            <td className="py-2 pr-2 text-right tabular-nums text-surface-600">
                                                {cohort.created}
                                            </td>
                                            {COHORT_COLUMNS.map((col) => {
                                                const raw = cohort.conversions?.[col]
                                                if (raw == null || cohort.created === 0) {
                                                    return (
                                                        <td key={col} className="py-2 px-1 text-center">
                                                            <span className="inline-block w-full rounded px-2 py-1 bg-surface-50 text-surface-300">
                                                                —
                                                            </span>
                                                        </td>
                                                    )
                                                }
                                                const pct = (raw / cohort.created) * 100
                                                return (
                                                    <td key={col} className="py-2 px-1 text-center">
                                                        <span
                                                            className={`inline-block w-full rounded px-2 py-1 text-xs font-semibold tabular-nums ${getCellColor(pct)}`}
                                                            title={`${raw} de ${cohort.created} (${pct.toFixed(1)}%)`}
                                                        >
                                                            {pct.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 font-semibold">
                                        <td className="py-2 pr-4">Média</td>
                                        <td className="py-2 pr-2 text-right tabular-nums">
                                            {cohorts.length ? Math.round(totalCreated / cohorts.length) : 0}
                                        </td>
                                        {COHORT_COLUMNS.map((col) => (
                                            <td key={col} className="py-2 px-1 text-center">
                                                <span
                                                    className={`inline-block w-full rounded px-2 py-1 text-xs font-semibold tabular-nums ${getCellColor(avgConversionByMonth[col] ?? 0)}`}
                                                >
                                                    {(avgConversionByMonth[col] ?? 0).toFixed(1)}%
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-surface-600 space-y-1">
                            <p className="font-medium text-surface-800">Como ler este mapa</p>
                            <p>Cada linha representa um grupo (coorte) de leads criados no mesmo mês. As colunas mostram a taxa de conversão acumulada ao longo dos meses seguintes.</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {[
                                    { label: '0%', cls: 'bg-surface-50 text-surface-400' },
                                    { label: '1-5%', cls: 'bg-green-100 text-green-700' },
                                    { label: '5-10%', cls: 'bg-green-200 text-green-800' },
                                    { label: '10-20%', cls: 'bg-green-300 text-green-900' },
                                    { label: '20-30%', cls: 'bg-green-400 text-white' },
                                    { label: '30-50%', cls: 'bg-green-500 text-white' },
                                    { label: '50%+', cls: 'bg-green-600 text-white' },
                                ].map((l) => (
                                    <span key={l.label} className={`rounded px-2 py-0.5 text-xs font-medium ${l.cls}`}>
                                        {l.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
