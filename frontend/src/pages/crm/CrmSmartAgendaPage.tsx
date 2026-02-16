import { useQuery } from '@tanstack/react-query'
import { getSmartAgenda } from '@/lib/crm-field-api'
import type { SmartAgendaSuggestion } from '@/lib/crm-field-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Loader2, Lightbulb, Calendar, Phone, Clock, AlertCircle, Wrench, FileText, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function CrmSmartAgendaPage() {
    const navigate = useNavigate()
    const { data: suggestions = [], isLoading } = useQuery<SmartAgendaSuggestion[]>({ queryKey: ['smart-agenda'], queryFn: () => getSmartAgenda() })

    return (
        <div className="space-y-6">
            <PageHeader title="Agenda Inteligente" description="Sugestões priorizadas de clientes para contatar esta semana" />

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : suggestions.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhuma sugestão no momento - todos os clientes estão em dia!</p></CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {suggestions.map((s, i) => (
                        <Card key={s.id} className={`hover:shadow-sm transition-shadow ${s.days_until_due <= 0 ? 'border-red-200 bg-red-50/50' : s.days_until_due <= 7 ? 'border-amber-200 bg-amber-50/50' : ''}`}>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">{i + 1}</div>
                                        <div>
                                            <p className="font-medium">{s.name}</p>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                                                <span><Clock className="h-3.5 w-3.5 inline mr-1" />{s.days_since_contact < 999 ? `${s.days_since_contact}d sem contato` : 'Nunca'}</span>
                                                <span>Máx: {s.max_days_allowed}d</span>
                                                {s.has_calibration_expiring && <span className="text-orange-600"><Wrench className="h-3.5 w-3.5 inline mr-1" />Calibração vencendo</span>}
                                                {s.has_pending_quote && <span className="text-blue-600"><FileText className="h-3.5 w-3.5 inline mr-1" />Orçamento pendente</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {s.rating && <Badge variant="outline">{s.rating}</Badge>}
                                        <Badge variant={s.days_until_due <= 0 ? 'destructive' : s.days_until_due <= 7 ? 'default' : 'secondary'}>{s.suggested_action}</Badge>
                                        <Badge variant="outline" className="font-mono">{s.priority_score}pts</Badge>
                                        <Button size="sm" variant="outline" onClick={() => navigate(`/crm/clientes/${s.id}`)}><ArrowRight className="h-3.5 w-3.5" /></Button>
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
