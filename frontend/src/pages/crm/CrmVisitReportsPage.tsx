import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getReports, createReport } from '@/lib/crm-field-api'
import type { VisitReport } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { FileText, Plus, Loader2, SmilePlus, Meh, Frown, Calendar, User, ChevronDown, ChevronUp, Handshake } from 'lucide-react'
import api from '@/lib/api'

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
const sentimentConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    positive: { label: 'Positivo', icon: SmilePlus, className: 'text-green-600' },
    neutral: { label: 'Neutro', icon: Meh, className: 'text-amber-600' },
    negative: { label: 'Negativo', icon: Frown, className: 'text-red-600' },
}

export function CrmVisitReportsPage() {
    const qc = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [expanded, setExpanded] = useState<number | null>(null)
    const [form, setForm] = useState({ customer_id: '', visit_date: new Date().toISOString().split('T')[0], summary: '', decisions: '', next_steps: '', overall_sentiment: 'neutral', contact_name: '', contact_role: '', next_contact_at: '', next_contact_type: 'visita', follow_up_scheduled: false })
    const [searchCustomer, setSearchCustomer] = useState('')
    const [commitments, setCommitments] = useState<{ title: string; responsible_type: string; due_date: string }[]>([])

    const { data: reportsRes, isLoading } = useQuery({ queryKey: ['visit-reports'], queryFn: () => getReports() })
    const reports: VisitReport[] = reportsRes?.data ?? []

    const searchQ = useQuery({
        queryKey: ['customers-report-search', searchCustomer],
        queryFn: () => api.get('/api/v1/customers', { params: { search: searchCustomer, per_page: 8, is_active: true } }).then(r => r.data?.data ?? []),
        enabled: searchCustomer.length >= 2,
    })

    const createMut = useMutation({
        mutationFn: createReport,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['visit-reports'] }); setShowDialog(false); toast.success('Ata registrada!') },
        onError: () => toast.error('Erro ao registrar ata'),
    })

    const handleSubmit = () => {
        if (!form.customer_id || !form.summary) { toast.error('Preencha cliente e resumo'); return }
        createMut.mutate({ ...form, customer_id: Number(form.customer_id), follow_up_scheduled: !!form.next_contact_at, commitments: commitments.length > 0 ? commitments : undefined })
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Atas de Visita" description="Registros estruturados de visitas e reuniões com clientes" />
            <div className="flex justify-end"><Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Nova Ata</Button></div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : reports.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhuma ata registrada</p></CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {reports.map(r => {
                        const sc = r.overall_sentiment ? sentimentConfig[r.overall_sentiment] : null
                        const isExpanded = expanded === r.id
                        return (
                            <Card key={r.id} className="hover:shadow-sm transition-shadow">
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(isExpanded ? null : r.id)}>
                                        <div className="flex items-center gap-3">
                                            <FileText className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{r.customer?.name}</p>
                                                <p className="text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5 inline mr-1" />{fmtDate(r.visit_date)} · <User className="h-3.5 w-3.5 inline mr-1" />{r.user?.name} {r.contact_name && `· ${r.contact_name}`}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {sc && <Badge variant="outline" className={sc.className}><sc.icon className="h-3.5 w-3.5 mr-1" />{sc.label}</Badge>}
                                            {r.follow_up_scheduled && <Badge variant="secondary">Follow-up agendado</Badge>}
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="mt-4 ml-8 space-y-3">
                                            <div><p className="text-sm font-medium text-muted-foreground">Resumo</p><p className="text-sm">{r.summary}</p></div>
                                            {r.decisions && <div><p className="text-sm font-medium text-muted-foreground">Decisões</p><p className="text-sm">{r.decisions}</p></div>}
                                            {r.next_steps && <div><p className="text-sm font-medium text-muted-foreground">Próximos Passos</p><p className="text-sm">{r.next_steps}</p></div>}
                                            {r.commitments && r.commitments.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground mb-1"><Handshake className="h-3.5 w-3.5 inline mr-1" />Compromissos</p>
                                                    {r.commitments.map(c => (
                                                        <div key={c.id} className="flex items-center gap-2 text-sm p-1.5 bg-muted/50 rounded mb-1">
                                                            <Badge variant={c.status === 'completed' ? 'secondary' : c.status === 'overdue' ? 'destructive' : 'outline'} className="text-xs">{c.status === 'completed' ? 'Cumprido' : c.status === 'overdue' ? 'Atrasado' : 'Pendente'}</Badge>
                                                            <span>{c.title}</span>
                                                            {c.due_date && <span className="text-muted-foreground ml-auto">{fmtDate(c.due_date)}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Nova Ata de Visita</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Cliente *</Label>
                                <Input placeholder="Buscar..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} />
                                {(searchQ.data ?? []).length > 0 && searchCustomer.length >= 2 && (
                                    <div className="border rounded-md max-h-32 overflow-auto mt-1">{(searchQ.data ?? []).map((c: { id: number; name: string }) => (
                                        <button key={c.id} className={`w-full text-left px-3 py-1.5 hover:bg-accent text-sm ${String(c.id) === form.customer_id ? 'bg-accent' : ''}`} onClick={() => { setForm({ ...form, customer_id: String(c.id) }); setSearchCustomer(c.name) }}>{c.name}</button>
                                    ))}</div>
                                )}
                            </div>
                            <div><Label>Data *</Label><Input type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div><Label>Contato</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Nome" /></div>
                            <div><Label>Cargo</Label><Input value={form.contact_role} onChange={e => setForm({ ...form, contact_role: e.target.value })} placeholder="Cargo" /></div>
                            <div><Label>Sentimento</Label>
                                <Select value={form.overall_sentiment} onValueChange={v => setForm({ ...form, overall_sentiment: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="positive">Positivo</SelectItem><SelectItem value="neutral">Neutro</SelectItem><SelectItem value="negative">Negativo</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div><Label>Resumo *</Label><Textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} rows={3} placeholder="Principais pontos discutidos..." /></div>
                        <div><Label>Decisões</Label><Textarea value={form.decisions} onChange={e => setForm({ ...form, decisions: e.target.value })} rows={2} placeholder="O que foi decidido..." /></div>
                        <div><Label>Próximos Passos</Label><Textarea value={form.next_steps} onChange={e => setForm({ ...form, next_steps: e.target.value })} rows={2} placeholder="Ações necessárias..." /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Próximo Contato</Label><Input type="datetime-local" value={form.next_contact_at} onChange={e => setForm({ ...form, next_contact_at: e.target.value })} /></div>
                            <div><Label>Tipo</Label>
                                <Select value={form.next_contact_type} onValueChange={v => setForm({ ...form, next_contact_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="visita">Visita</SelectItem><SelectItem value="ligacao">Ligação</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2"><Label>Compromissos</Label><Button size="sm" variant="outline" onClick={() => setCommitments([...commitments, { title: '', responsible_type: 'us', due_date: '' }])}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button></div>
                            {commitments.map((c, i) => (
                                <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                                    <Input className="col-span-2" value={c.title} onChange={e => { const nc = [...commitments]; nc[i].title = e.target.value; setCommitments(nc) }} placeholder="Compromisso" />
                                    <Select value={c.responsible_type} onValueChange={v => { const nc = [...commitments]; nc[i].responsible_type = v; setCommitments(nc) }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="us">Nós</SelectItem><SelectItem value="client">Cliente</SelectItem><SelectItem value="both">Ambos</SelectItem></SelectContent>
                                    </Select>
                                    <Input type="date" value={c.due_date} onChange={e => { const nc = [...commitments]; nc[i].due_date = e.target.value; setCommitments(nc) }} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={createMut.isPending}>{createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Registrar Ata</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
