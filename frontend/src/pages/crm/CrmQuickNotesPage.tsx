import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQuickNotes, createQuickNote, updateQuickNote, deleteQuickNote } from '@/lib/crm-field-api'
import type { QuickNote } from '@/lib/crm-field-api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { StickyNote, Plus, Loader2, Pin, SmilePlus, Meh, Frown, Phone, Monitor, MessageCircle, Mail, Trash2 } from 'lucide-react'
import api from '@/lib/api'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const channelIcons: Record<string, React.ElementType> = { telefone: Phone, presencial: Monitor, whatsapp: MessageCircle, email: Mail }
const sentimentIcons: Record<string, { icon: React.ElementType; color: string }> = { positive: { icon: SmilePlus, color: 'text-green-600' }, neutral: { icon: Meh, color: 'text-amber-600' }, negative: { icon: Frown, color: 'text-red-600' } }

export function CrmQuickNotesPage() {
    const qc = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [form, setForm] = useState({ customer_id: '', channel: 'telefone', sentiment: 'neutral', content: '' })
    const [searchCustomer, setSearchCustomer] = useState('')

    const { data: notesRes, isLoading } = useQuery({ queryKey: ['quick-notes'], queryFn: () => getQuickNotes() })
    const notes: QuickNote[] = notesRes?.data ?? []

    const searchQ = useQuery({
        queryKey: ['customers-qn-search', searchCustomer],
        queryFn: () => api.get('/customers', { params: { search: searchCustomer, per_page: 8, is_active: true } }).then(r => r.data?.data ?? []),
        enabled: searchCustomer.length >= 2,
    })

    const createMut = useMutation({
        mutationFn: createQuickNote,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['quick-notes'] }); setShowDialog(false); setForm({ customer_id: '', channel: 'telefone', sentiment: 'neutral', content: '' }); setSearchCustomer(''); toast.success('Nota registrada!') },
        onError: () => toast.error('Erro ao registrar nota'),
    })

    const deleteMut = useMutation({
        mutationFn: deleteQuickNote,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['quick-notes'] }); toast.success('Nota excluída!') },
    })

    const pinMut = useMutation({
        mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) => updateQuickNote(id, { is_pinned: pinned }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-notes'] }),
    })

    return (
        <div className="space-y-6">
            <PageHeader title="Notas Rápidas" description="Registre conversas e interações informais em segundos" />
            <div className="flex justify-end"><Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Nova Nota</Button></div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : notes.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><StickyNote className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhuma nota ainda</p></CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {notes.map(note => {
                        const ChIcon = note.channel ? channelIcons[note.channel] ?? StickyNote : StickyNote
                        const si = note.sentiment ? sentimentIcons[note.sentiment] : null
                        return (
                            <Card key={note.id} className={`hover:shadow-sm transition-shadow ${note.is_pinned ? 'border-amber-300 bg-amber-50/30' : ''}`}>
                                <CardContent className="py-3">
                                    <div className="flex items-start gap-3">
                                        <ChIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm">{note.customer?.name}</span>
                                                <span className="text-xs text-muted-foreground">{fmtDate(note.created_at)}</span>
                                                <span className="text-xs text-muted-foreground">por {note.user?.name}</span>
                                                {si && (() => { const SentimentIcon = si.icon; return <SentimentIcon className={`h-3.5 w-3.5 ${si.color}`} /> })()}
                                                {note.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-600" />}
                                            </div>
                                            <p className="text-sm">{note.content}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="ghost" onClick={() => pinMut.mutate({ id: note.id, pinned: !note.is_pinned })}><Pin className={`h-3.5 w-3.5 ${note.is_pinned ? 'text-amber-600' : ''}`} /></Button>
                                            <Button size="sm" variant="ghost" onClick={() => { if (confirm('Excluir nota?')) deleteMut.mutate(note.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
                    <DialogHeader><DialogTitle>Nota Rápida</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Cliente *</Label>
                            <Input placeholder="Buscar..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} />
                            {(searchQ.data ?? []).length > 0 && searchCustomer.length >= 2 && (
                                <div className="border rounded-md max-h-32 overflow-auto mt-1">{(searchQ.data ?? []).map((c: { id: number; name: string }) => (
                                    <button key={c.id} className={`w-full text-left px-3 py-1.5 hover:bg-accent text-sm ${String(c.id) === form.customer_id ? 'bg-accent' : ''}`} onClick={() => { setForm({ ...form, customer_id: String(c.id) }); setSearchCustomer(c.name) }}>{c.name}</button>
                                ))}</div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Canal</Label>
                                <Select value={form.channel} onValueChange={v => setForm({ ...form, channel: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="telefone">Telefone</SelectItem><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">E-mail</SelectItem></SelectContent></Select>
                            </div>
                            <div><Label>Sentimento</Label>
                                <Select value={form.sentiment} onValueChange={v => setForm({ ...form, sentiment: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="positive">Positivo</SelectItem><SelectItem value="neutral">Neutro</SelectItem><SelectItem value="negative">Negativo</SelectItem></SelectContent></Select>
                            </div>
                        </div>
                        <div><Label>Conteúdo *</Label><Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={3} placeholder="O que foi conversado..." /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                        <Button onClick={() => { if (!form.customer_id || !form.content) { toast.error('Preencha cliente e conteúdo'); return }; createMut.mutate({ customer_id: Number(form.customer_id), channel: form.channel, sentiment: form.sentiment, content: form.content }) }} disabled={createMut.isPending}>{createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Registrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
