import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPolicies, createPolicy, updatePolicy, deletePolicy } from '@/lib/crm-field-api'
import type { ContactPolicy } from '@/lib/crm-field-api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { ShieldCheck, Plus, Loader2, Pencil, Trash2, Clock } from 'lucide-react'

export function CrmContactPoliciesPage() {
    const qc = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [editing, setEditing] = useState<ContactPolicy | null>(null)
    const [form, setForm] = useState({ name: '', target_type: 'all', target_value: '', max_days_without_contact: 30, warning_days_before: 7, preferred_contact_type: '', is_active: true, priority: 0 })

    const { data: policies = [], isLoading } = useQuery<ContactPolicy[]>({ queryKey: ['contact-policies'], queryFn: getPolicies })

    const createMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => editing ? updatePolicy(editing.id, data) : createPolicy(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact-policies'] }); setShowDialog(false); setEditing(null); toast.success(editing ? 'Política atualizada!' : 'Política criada!') },
        onError: () => toast.error('Erro ao salvar política'),
    })

    const deleteMut = useMutation({
        mutationFn: deletePolicy,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact-policies'] }); toast.success('Política excluída!') },
    })

    const openEdit = (p: ContactPolicy) => {
        setEditing(p)
        setForm({ name: p.name, target_type: p.target_type, target_value: p.target_value ?? '', max_days_without_contact: p.max_days_without_contact, warning_days_before: p.warning_days_before, preferred_contact_type: p.preferred_contact_type ?? '', is_active: p.is_active, priority: p.priority })
        setShowDialog(true)
    }

    const openCreate = () => {
        setEditing(null)
        setForm({ name: '', target_type: 'all', target_value: '', max_days_without_contact: 30, warning_days_before: 7, preferred_contact_type: '', is_active: true, priority: 0 })
        setShowDialog(true)
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Políticas de Contato" description="Configure a frequência mínima de contato por tipo de cliente" />
            <div className="flex justify-end"><Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova Política</Button></div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : policies.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhuma política configurada</p></CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {policies.map(p => (
                        <Card key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{p.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5 inline mr-1" />
                                                Máx. {p.max_days_without_contact} dias sem contato · Alerta {p.warning_days_before}d antes ·
                                                {p.target_type === 'all' ? ' Todos os clientes' : p.target_type === 'rating' ? ` Rating ${p.target_value}` : ` Segmento: ${p.target_value}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Ativa' : 'Inativa'}</Badge>
                                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                                        <Button size="sm" variant="ghost" onClick={() => { if (confirm('Excluir política?')) deleteMut.mutate(p.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editing ? 'Editar Política' : 'Nova Política'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Clientes A - Quinzenal" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Alvo</Label>
                                <Select value={form.target_type} onValueChange={v => setForm({ ...form, target_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="rating">Rating</SelectItem><SelectItem value="segment">Segmento</SelectItem></SelectContent>
                                </Select>
                            </div>
                            {form.target_type !== 'all' && <div><Label>Valor</Label><Input value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} placeholder={form.target_type === 'rating' ? 'A, B, C ou D' : 'supermercado, farmacia...'} /></div>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Máx. Dias sem Contato *</Label><Input type="number" value={form.max_days_without_contact} onChange={e => setForm({ ...form, max_days_without_contact: Number(e.target.value) })} /></div>
                            <div><Label>Alerta Dias Antes</Label><Input type="number" value={form.warning_days_before} onChange={e => setForm({ ...form, warning_days_before: Number(e.target.value) })} /></div>
                        </div>
                        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Ativa</Label></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                        <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>{createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{editing ? 'Salvar' : 'Criar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
