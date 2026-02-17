import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccountPlans, createAccountPlan, updateAccountPlan, updateAccountPlanAction } from '@/lib/crm-field-api'
import type { AccountPlan } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Target, Plus, Loader2, ChevronDown, ChevronUp, CheckCircle2, Calendar } from 'lucide-react'
import api from '@/lib/api'

const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'
const fmtMoney = (v: number | null) => v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '-'
const statusColors: Record<string, string> = { active: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300', completed: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300', paused: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300', cancelled: 'bg-surface-100 text-surface-600' }

export function CrmAccountPlansPage() {
    const qc = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [expanded, setExpanded] = useState<number | null>(null)
    const [form, setForm] = useState({ customer_id: '', title: '', objective: '', target_date: '', revenue_target: '' })
    const [searchCustomer, setSearchCustomer] = useState('')

    const { data: plansRes, isLoading } = useQuery({ queryKey: ['account-plans'], queryFn: () => getAccountPlans() })
    const plans: AccountPlan[] = plansRes?.data ?? []

    const searchQ = useQuery({ queryKey: ['customers-plan-search', searchCustomer], queryFn: () => api.get('/api/v1/customers', { params: { search: searchCustomer, per_page: 8 } }).then(r => r.data?.data ?? []), enabled: searchCustomer.length >= 2 })

    const createMut = useMutation({ mutationFn: createAccountPlan, onSuccess: () => { qc.invalidateQueries({ queryKey: ['account-plans'] }); setShowDialog(false); toast.success('Plano criado!') }, onError: () => toast.error('Erro') })

    const actionMut = useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => updateAccountPlanAction(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['account-plans'] }); toast.success('Ação atualizada!') } })

    return (
        <div className="space-y-6">
            <PageHeader title="Plano de Ação por Cliente" description="Objetivos estratégicos e ações para clientes-chave" />
            <div className="flex justify-end"><Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Novo Plano</Button></div>

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : plans.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><Target className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhum plano de ação criado</p></CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {plans.map(p => {
                        const isExpanded = expanded === p.id
                        return (
                            <Card key={p.id}>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(isExpanded ? null : p.id)}>
                                        <div className="flex items-center gap-3">
                                            <Target className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{p.title}</p>
                                                <p className="text-sm text-muted-foreground">{p.customer?.name} · {p.owner?.name} · Meta: {fmtDate(p.target_date)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-32"><Progress value={p.progress_percent} className="h-2" /><p className="text-xs text-muted-foreground text-right mt-0.5">{p.progress_percent}%</p></div>
                                            {p.revenue_target && <span className="text-sm font-medium">{fmtMoney(p.revenue_current)} / {fmtMoney(p.revenue_target)}</span>}
                                            <Badge className={statusColors[p.status]}>{p.status === 'active' ? 'Ativo' : p.status === 'completed' ? 'Concluído' : p.status === 'paused' ? 'Pausado' : 'Cancelado'}</Badge>
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="mt-4 ml-8">
                                            {p.objective && <p className="text-sm mb-3 text-muted-foreground">{p.objective}</p>}
                                            {p.actions && p.actions.length > 0 && (
                                                <div className="space-y-2">
                                                    {p.actions.map(a => (
                                                        <div key={a.id} className={`flex items-center gap-2 p-2 rounded ${a.status === 'completed' ? 'bg-green-50' : 'bg-muted/50'}`}>
                                                            {a.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 cursor-pointer" onClick={() => actionMut.mutate({ id: a.id, data: { status: 'completed' } })} />}
                                                            <span className={`flex-1 text-sm ${a.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{a.title}</span>
                                                            {a.due_date && <span className="text-xs text-muted-foreground">{fmtDate(a.due_date)}</span>}
                                                            {a.assignee && <Badge variant="outline" className="text-xs">{a.assignee.name}</Badge>}
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
                <DialogContent>
                    <DialogHeader><DialogTitle>Novo Plano de Ação</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div><Label>Cliente *</Label><Input placeholder="Buscar..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} />
                            {(searchQ.data ?? []).length > 0 && searchCustomer.length >= 2 && (<div className="border rounded-md max-h-32 overflow-auto mt-1">{(searchQ.data ?? []).map((c: { id: number; name: string }) => (<button key={c.id} className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm" onClick={() => { setForm({ ...form, customer_id: String(c.id) }); setSearchCustomer(c.name) }}>{c.name}</button>))}</div>)}</div>
                        <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Expandir carteira de equipamentos" /></div>
                        <div><Label>Objetivo</Label><Textarea value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} rows={2} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Data Meta</Label><Input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} /></div>
                            <div><Label>Meta de Receita</Label><Input type="number" value={form.revenue_target} onChange={e => setForm({ ...form, revenue_target: e.target.value })} placeholder="R$" /></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                        <Button onClick={() => { if (!form.customer_id || !form.title) { toast.error('Preencha campos obrigatórios'); return }; createMut.mutate({ customer_id: Number(form.customer_id), title: form.title, objective: form.objective || undefined, target_date: form.target_date || undefined, revenue_target: form.revenue_target ? Number(form.revenue_target) : undefined }) }} disabled={createMut.isPending}>{createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Criar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
