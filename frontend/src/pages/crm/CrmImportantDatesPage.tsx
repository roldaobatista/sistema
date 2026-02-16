import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getImportantDates, createImportantDate, deleteImportantDate } from '@/lib/crm-field-api'
import type { ImportantDate } from '@/lib/crm-field-api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CalendarHeart, Plus, Loader2, Cake, Building2, FileText, Star, Trash2 } from 'lucide-react'
import api from '@/lib/api'

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
const typeConfig: Record<string, { label: string; icon: React.ElementType }> = { birthday: { label: 'Aniversário', icon: Cake }, company_anniversary: { label: 'Aniv. Empresa', icon: Building2 }, contract_start: { label: 'Contrato', icon: FileText }, custom: { label: 'Personalizado', icon: Star } }

export function CrmImportantDatesPage() {
    const qc = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [form, setForm] = useState({ customer_id: '', title: '', type: 'birthday', date: '', contact_name: '', notes: '' })
    const [searchCustomer, setSearchCustomer] = useState('')

    const { data: dates = [], isLoading } = useQuery<ImportantDate[]>({ queryKey: ['important-dates'], queryFn: () => getImportantDates({ upcoming: 60 }) })

    const searchQ = useQuery({
        queryKey: ['customers-dates-search', searchCustomer],
        queryFn: () => api.get('/api/v1/customers', { params: { search: searchCustomer, per_page: 8, is_active: true } }).then(r => r.data?.data ?? []),
        enabled: searchCustomer.length >= 2,
    })

    const createMut = useMutation({
        mutationFn: createImportantDate,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['important-dates'] }); setShowDialog(false); toast.success('Data registrada!') },
        onError: () => toast.error('Erro ao registrar'),
    })

    const deleteMut = useMutation({ mutationFn: deleteImportantDate, onSuccess: () => { qc.invalidateQueries({ queryKey: ['important-dates'] }); toast.success('Data excluída!') } })

    return (
        <div className="space-y-6">
            <PageHeader title="Datas Importantes" description="Aniversários, marcos e datas comemorativas dos clientes" />
            <div className="flex justify-end"><Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Nova Data</Button></div>

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : dates.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><CalendarHeart className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhuma data importante nos próximos 60 dias</p></CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {dates.map(d => {
                        const tc = typeConfig[d.type] ?? typeConfig.custom
                        const Icon = tc.icon
                        const daysUntil = Math.ceil((new Date(d.date).getTime() - Date.now()) / 86400000)
                        return (
                            <Card key={d.id} className={`hover:shadow-sm transition-shadow ${daysUntil <= 7 ? 'border-amber-200 bg-amber-50/50' : ''}`}>
                                <CardContent className="py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Icon className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{d.title}</p>
                                                <p className="text-sm text-muted-foreground">{d.customer?.name} {d.contact_name && `· ${d.contact_name}`} · {fmtDate(d.date)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={daysUntil <= 0 ? 'default' : daysUntil <= 7 ? 'secondary' : 'outline'}>{daysUntil <= 0 ? 'Hoje!' : `Em ${daysUntil}d`}</Badge>
                                            <Badge variant="outline">{tc.label}</Badge>
                                            <Button size="sm" variant="ghost" onClick={() => { if (confirm('Excluir?')) deleteMut.mutate(d.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nova Data Importante</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div><Label>Cliente *</Label><Input placeholder="Buscar..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} />
                            {(searchQ.data ?? []).length > 0 && searchCustomer.length >= 2 && (<div className="border rounded-md max-h-32 overflow-auto mt-1">{(searchQ.data ?? []).map((c: { id: number; name: string }) => (<button key={c.id} className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm" onClick={() => { setForm({ ...form, customer_id: String(c.id) }); setSearchCustomer(c.name) }}>{c.name}</button>))}</div>)}</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Aniversário João" /></div>
                            <div><Label>Tipo</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="birthday">Aniversário</SelectItem><SelectItem value="company_anniversary">Aniv. Empresa</SelectItem><SelectItem value="contract_start">Contrato</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent></Select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Data *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                            <div><Label>Contato</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                        <Button onClick={() => { if (!form.customer_id || !form.title || !form.date) { toast.error('Preencha os campos obrigatórios'); return }; createMut.mutate({ customer_id: Number(form.customer_id), title: form.title, type: form.type, date: form.date, contact_name: form.contact_name || undefined }) }} disabled={createMut.isPending}>{createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Registrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
