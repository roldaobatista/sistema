import { useState } from 'react'
import { toast } from 'sonner'
import { useWebhooks, useWebhookEvents, useCreateWebhook, useUpdateWebhook, useDeleteWebhook } from '@/hooks/useInmetroAdvanced'
import type { InmetroWebhookConfig } from '@/hooks/useInmetroAdvanced'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Webhook, Plus, Trash2, Power, PowerOff, Edit } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

export default function InmetroWebhooksPage() {
  const { hasPermission } = useAuthStore()

    const { data: webhooks, isLoading } = useWebhooks()
    const { data: events } = useWebhookEvents()
    const createMut = useCreateWebhook()
    const updateMut = useUpdateWebhook()
    const deleteMut = useDeleteWebhook()
    const [form, setForm] = useState({ event_type: '', url: '', secret: '' })

  const [searchTerm, setSearchTerm] = useState('')
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Webhooks</h1>
                    <p className="text-muted-foreground">Integrações e notificações externas</p>
                </div>
                <Dialog>
                    <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo Webhook</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Criar Webhook</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                            <div><Label>Evento</Label>
                                <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Selecionar evento" /></SelectTrigger>
                                    <SelectContent>
                                        {events && Object.entries(events).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>URL</Label><Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com/webhook" /></div>
                            <div><Label>Secret (opcional)</Label><Input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="hmac-secret" /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.event_type || !form.url}>
                                {createMut.isPending ? 'Criando...' : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="w-5 h-5" /> Webhooks Configurados</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-32 w-full" /> : !webhooks?.length ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <Webhook className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Nenhum webhook configurado</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>URL</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Falhas</TableHead>
                                    <TableHead>Ãšltimo Disparo</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(webhooks as InmetroWebhookConfig[]).map(wh => (
                                    <TableRow key={wh.id}>
                                        <TableCell><Badge variant="outline">{wh.event_type}</Badge></TableCell>
                                        <TableCell className="font-mono text-xs max-w-xs truncate">{wh.url}</TableCell>
                                        <TableCell>
                                            <Badge className={wh.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                                {wh.is_active ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{wh.failure_count > 0 ? <Badge variant="destructive">{wh.failure_count}</Badge> : '0'}</TableCell>
                                        <TableCell className="text-sm">{wh.last_triggered_at ?? 'Nunca'}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button size="icon" variant="ghost" onClick={() => updateMut.mutate({ id: wh.id, data: { is_active: !wh.is_active } })} disabled={updateMut.isPending}>
                                                {wh.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-red-500"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Remover webhook?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteMut.mutate(wh.id)} className="bg-red-600 hover:bg-red-700">Remover</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}