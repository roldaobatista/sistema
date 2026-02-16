import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRfmScores, recalculateRfm } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, RefreshCw, BarChart3, Users, DollarSign, TrendingUp } from 'lucide-react'

const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const segmentColors: Record<string, string> = {
    champions: 'bg-green-100 text-green-800', loyal: 'bg-emerald-100 text-emerald-800', potential_loyal: 'bg-teal-100 text-teal-800',
    new_customers: 'bg-blue-100 text-blue-800', promising: 'bg-cyan-100 text-cyan-800', needs_attention: 'bg-amber-100 text-amber-800',
    about_to_sleep: 'bg-orange-100 text-orange-800', at_risk: 'bg-red-100 text-red-800', cant_lose: 'bg-rose-100 text-rose-800',
    hibernating: 'bg-gray-100 text-gray-600', lost: 'bg-gray-200 text-gray-500',
}

export function CrmRfmPage() {
    const qc = useQueryClient()
    const { data, isLoading } = useQuery({ queryKey: ['rfm-scores'], queryFn: getRfmScores })
    const recalcMut = useMutation({ mutationFn: recalculateRfm, onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['rfm-scores'] }); toast.success(d.message) } })

    const scores = data?.scores ?? []
    const bySegment = data?.by_segment ?? {}
    const segments = data?.segments ?? {}

    return (
        <div className="space-y-6">
            <PageHeader title="Classificação RFM" description="Recência, Frequência e Valor Monetário dos clientes" />
            <div className="flex justify-end"><Button onClick={() => recalcMut.mutate()} disabled={recalcMut.isPending}>{recalcMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Recalcular</Button></div>

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(bySegment).map(([seg, info]: [string, unknown]) => {
                            const s = info as { count: number; total_revenue: number }
                            return (
                                <Card key={seg}>
                                    <CardContent className="py-3 text-center">
                                        <Badge className={segmentColors[seg] ?? 'bg-gray-100'}>{(segments as Record<string, string>)[seg] ?? seg}</Badge>
                                        <p className="text-xl font-bold mt-1">{s.count}</p>
                                        <p className="text-xs text-muted-foreground">{fmtMoney(s.total_revenue)}</p>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>

                    <Card><CardHeader><CardTitle className="text-base">Detalhes por Cliente</CardTitle></CardHeader><CardContent>
                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b"><th className="text-left py-2">Cliente</th><th className="text-center">R</th><th className="text-center">F</th><th className="text-center">M</th><th className="text-center">Total</th><th className="text-center">Segmento</th><th className="text-right">Receita</th></tr></thead>
                                <tbody>
                                    {scores.map((s: Record<string, unknown>) => (
                                        <tr key={s.id as number} className="border-b hover:bg-muted/50">
                                            <td className="py-2">{(s.customer as Record<string, unknown>)?.name as string}</td>
                                            <td className="text-center"><Badge variant="outline">{s.recency_score as number}</Badge></td>
                                            <td className="text-center"><Badge variant="outline">{s.frequency_score as number}</Badge></td>
                                            <td className="text-center"><Badge variant="outline">{s.monetary_score as number}</Badge></td>
                                            <td className="text-center font-bold">{s.total_score as number}</td>
                                            <td className="text-center"><Badge className={segmentColors[s.rfm_segment as string] ?? 'bg-gray-100'}>{(segments as Record<string, string>)[s.rfm_segment as string] ?? s.rfm_segment}</Badge></td>
                                            <td className="text-right">{fmtMoney(s.total_revenue as number)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent></Card>
                </>
            )}
        </div>
    )
}
