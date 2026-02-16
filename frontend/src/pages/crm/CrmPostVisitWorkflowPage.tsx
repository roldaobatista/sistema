import { useQuery } from '@tanstack/react-query'
import { getCheckins } from '@/lib/crm-field-api'
import type { VisitCheckin } from '@/lib/crm-field-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, FileText, Calendar, AlertTriangle, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function CrmPostVisitWorkflowPage() {
    const navigate = useNavigate()
    const { data: checkinsRes, isLoading } = useQuery({ queryKey: ['visit-checkins-pending-report', { status: 'checked_out', per_page: 50 }], queryFn: () => getCheckins({ status: 'checked_out', per_page: 50 }) })
    const checkins: VisitCheckin[] = (checkinsRes?.data ?? []).filter((c: VisitCheckin) => !c.notes?.includes('[REPORT_DONE]'))

    return (
        <div className="space-y-6">
            <PageHeader title="Workflow Pós-Visita" description="Visitas que precisam de ata e agendamento do próximo contato" />

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : checkins.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" /><p className="text-lg font-medium">Tudo em dia!</p><p>Todas as visitas têm ata registrada</p></CardContent></Card>
            ) : (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{checkins.length} visita(s) aguardando ata e agendamento</p>
                    {checkins.map(c => (
                        <Card key={c.id} className="border-amber-200 bg-amber-50/50 hover:shadow-sm transition-shadow">
                            <CardContent className="py-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                                        <div>
                                            <p className="font-medium">{c.customer?.name}</p>
                                            <p className="text-sm text-muted-foreground">Visita em {fmtDate(c.checkin_at)} · Duração: {c.duration_minutes ? `${c.duration_minutes}min` : '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline"><FileText className="h-3.5 w-3.5 mr-1" />Ata pendente</Badge>
                                        <Badge variant="outline"><Calendar className="h-3.5 w-3.5 mr-1" />Agendamento pendente</Badge>
                                        <Button size="sm" onClick={() => navigate('/crm/visit-reports')}><ArrowRight className="h-3.5 w-3.5 mr-1" />Registrar</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
