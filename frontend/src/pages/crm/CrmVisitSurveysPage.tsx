import { useQuery } from '@tanstack/react-query'
import { getSurveys } from '@/lib/crm-field-api'
import type { VisitSurvey } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Loader2, Star, Clock, CheckCircle2, XCircle } from 'lucide-react'

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = { pending: { label: 'Pendente', variant: 'default' }, answered: { label: 'Respondida', variant: 'secondary' }, expired: { label: 'Expirada', variant: 'destructive' } }

export function CrmVisitSurveysPage() {
    const { data: surveysRes, isLoading } = useQuery({ queryKey: ['visit-surveys'], queryFn: () => getSurveys() })
    const surveys: VisitSurvey[] = surveysRes?.data ?? []
    const answered = surveys.filter(s => s.status === 'answered')
    const avgRating = answered.length > 0 ? (answered.reduce((sum, s) => sum + (s.rating ?? 0), 0) / answered.length).toFixed(1) : '-'

    return (
        <div className="space-y-6">
            <PageHeader title="Pesquisas Pós-Visita" description="CSAT das visitas realizadas aos clientes" />
            <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="py-4 text-center"><p className="text-2xl font-bold">{surveys.length}</p><p className="text-xs text-muted-foreground">Total Enviadas</p></CardContent></Card>
                <Card><CardContent className="py-4 text-center"><p className="text-2xl font-bold">{answered.length}</p><p className="text-xs text-muted-foreground">Respondidas</p></CardContent></Card>
                <Card className="bg-amber-50"><CardContent className="py-4 text-center"><Star className="h-5 w-5 mx-auto mb-1 text-amber-600" /><p className="text-2xl font-bold">{avgRating}</p><p className="text-xs text-muted-foreground">Nota Média</p></CardContent></Card>
            </div>

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : (
                <div className="space-y-2">
                    {surveys.map(s => {
                        const sc = statusConfig[s.status] ?? statusConfig.pending
                        return (
                            <Card key={s.id}>
                                <CardContent className="py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Star className={`h-5 w-5 ${s.rating && s.rating >= 4 ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                                            <div>
                                                <p className="font-medium">{s.customer?.name}</p>
                                                <p className="text-sm text-muted-foreground">Vendedor: {s.user?.name} · Enviada: {fmtDate(s.sent_at)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {s.rating && <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(n => <Star key={n} className={`h-4 w-4 ${n <= s.rating! ? 'text-amber-500 fill-amber-500' : 'text-surface-300'}`} />)}</div>}
                                            <Badge variant={sc.variant}>{sc.label}</Badge>
                                        </div>
                                    </div>
                                    {s.comment && <p className="mt-2 text-sm text-muted-foreground pl-8">"{s.comment}"</p>}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
