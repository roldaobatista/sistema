import { useState , useMemo } from 'react'
import {
    useContactQueue,
    useGenerateDailyQueue,
    useMarkQueueItem,
    useFollowUps,
    useRejectAlerts,
    useLogInteraction,
    useInteractionHistory,
    useChurnDetection,
} from '@/hooks/useInmetroAdvanced'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Phone,
    MessageSquare,
    Mail,
    MapPin,
    RefreshCw,
    AlertTriangle,
    UserCheck,
    Clock,
    TrendingDown,
    CheckCircle,
    XCircle,
    PhoneOff,
} from 'lucide-react'

const channelIcons: Record<string, React.ReactNode> = {
    phone: <Phone className="w-4 h-4" />,
    whatsapp: <MessageSquare className="w-4 h-4" />,
    email: <Mail className="w-4 h-4" />,
    visit: <MapPin className="w-4 h-4" />,
}

const resultColors: Record<string, string> = {
    interested: 'bg-green-100 text-green-800',
    not_interested: 'bg-red-100 text-red-800',
    no_answer: 'bg-surface-100 text-surface-800',
    callback: 'bg-amber-100 text-amber-800',
    converted: 'bg-blue-100 text-blue-800',
}

export default function InmetroProspectionPage() {

    const { data: queue, isLoading: loadingQueue } = useContactQueue()
    const { data: followUps, isLoading: loadingFollowUps } = useFollowUps()
    const { data: rejectAlerts } = useRejectAlerts()
    const { data: churn } = useChurnDetection()
    const generateQueue = useGenerateDailyQueue()
    const markItem = useMarkQueueItem()

    const [interactionOwnerId, setInteractionOwnerId] = useState<number | null>(null)
    const [interactionForm, setInteractionForm] = useState({ channel: 'phone', result: 'interested', notes: '' })
    const logInteraction = useLogInteraction()
    const { data: history } = useInteractionHistory(interactionOwnerId)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Prospecção Inteligente</h1>
                    <p className="text-muted-foreground">Fila de contatos, follow-ups e alertas</p>
                </div>
                <Button onClick={() => generateQueue.mutate()} disabled={generateQueue.isPending}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${generateQueue.isPending ? 'animate-spin' : ''}`} />
                    Gerar Fila do Dia
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <UserCheck className="w-8 h-8 text-blue-500" />
                            <div>
                                <p className="text-2xl font-bold">{queue?.total ?? 0}</p>
                                <p className="text-sm text-muted-foreground">Na fila hoje</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Clock className="w-8 h-8 text-amber-500" />
                            <div>
                                <p className="text-2xl font-bold">{followUps?.total ?? 0}</p>
                                <p className="text-sm text-muted-foreground">Follow-ups pendentes</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                            <div>
                                <p className="text-2xl font-bold">{rejectAlerts?.total_rejected ?? 0}</p>
                                <p className="text-sm text-muted-foreground">Instrumentos reprovados</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <TrendingDown className="w-8 h-8 text-orange-500" />
                            <div>
                                <p className="text-2xl font-bold">{churn?.total_at_risk ?? 0}</p>
                                <p className="text-sm text-muted-foreground">Risco de churn</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="queue">
                <TabsList>
                    <TabsTrigger value="queue">Fila de Contatos</TabsTrigger>
                    <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
                    <TabsTrigger value="rejected">Reprovados</TabsTrigger>
                    <TabsTrigger value="churn">Risco de Churn</TabsTrigger>
                </TabsList>

                <TabsContent value="queue">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fila de Contatos â€” {queue?.date}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingQueue ? (
                                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                            ) : !queue?.items?.length ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>Nenhum contato na fila. Clique em "Gerar Fila do Dia".</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Lead</TableHead>
                                            <TableHead>Motivo</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {queue.items.map((item: any, idx: number) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{idx + 1}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{item.owner_name ?? `Lead #${item.owner_id}`}</p>
                                                        <p className="text-xs text-muted-foreground">{item.reason}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{item.reason}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={item.status === 'contacted' ? resultColors.interested : item.status === 'skipped' ? resultColors.not_interested : 'bg-surface-100 text-surface-800'}>
                                                        {item.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    {item.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => markItem.mutate({ queueId: item.id, status: 'contacted' })}
                                                                disabled={markItem.isPending}
                                                            >
                                                                <CheckCircle className="w-4 h-4 mr-1" /> Contatado
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => markItem.mutate({ queueId: item.id, status: 'skipped' })}
                                                                disabled={markItem.isPending}
                                                            >
                                                                <XCircle className="w-4 h-4 mr-1" /> Pular
                                                            </Button>
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button size="sm" variant="default" onClick={() => setInteractionOwnerId(item.owner_id)}>
                                                                        <MessageSquare className="w-4 h-4 mr-1" /> Registrar
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>Registrar Interação</DialogTitle>
                                                                    </DialogHeader>
                                                                    <div className="space-y-4">
                                                                        <Select value={interactionForm.channel} onValueChange={v => setInteractionForm(f => ({ ...f, channel: v }))}>
                                                                            <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="phone">Telefone</SelectItem>
                                                                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                                                                <SelectItem value="email">E-mail</SelectItem>
                                                                                <SelectItem value="visit">Visita</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <Select value={interactionForm.result} onValueChange={v => setInteractionForm(f => ({ ...f, result: v }))}>
                                                                            <SelectTrigger><SelectValue placeholder="Resultado" /></SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="interested">Interessado</SelectItem>
                                                                                <SelectItem value="not_interested">Sem Interesse</SelectItem>
                                                                                <SelectItem value="no_answer">Sem Resposta</SelectItem>
                                                                                <SelectItem value="callback">Retornar Later</SelectItem>
                                                                                <SelectItem value="converted">Convertido</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <Textarea placeholder="Notas..." value={interactionForm.notes} onChange={e => setInteractionForm(f => ({ ...f, notes: e.target.value }))} />
                                                                    </div>
                                                                    <DialogFooter>
                                                                        <DialogClose asChild>
                                                                            <Button variant="outline">Cancelar</Button>
                                                                        </DialogClose>
                                                                        <Button
                                                                            onClick={() => {
                                                                                if (interactionOwnerId) {
                                                                                    logInteraction.mutate({ owner_id: interactionOwnerId, ...interactionForm })
                                                                                    markItem.mutate({ queueId: item.id, status: 'contacted' })
                                                                                }
                                                                            }}
                                                                            disabled={logInteraction.isPending}
                                                                        >
                                                                            {logInteraction.isPending ? 'Salvando...' : 'Salvar'}
                                                                        </Button>
                                                                    </DialogFooter>
                                                                </DialogContent>
                                                            </Dialog>
                                                        </>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="follow-ups">
                    <Card>
                        <CardHeader><CardTitle>Follow-ups Agendados</CardTitle></CardHeader>
                        <CardContent>
                            {loadingFollowUps ? (
                                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                            ) : !followUps?.follow_ups?.length ? (
                                <p className="text-center py-8 text-muted-foreground">Nenhum follow-up pendente</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Lead</TableHead>
                                            <TableHead>Data Agendada</TableHead>
                                            <TableHead>Canal</TableHead>
                                            <TableHead>Ãšltimo Resultado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {followUps.follow_ups.map((fu: any) => (
                                            <TableRow key={fu.id}>
                                                <TableCell className="font-medium">{fu.owner_name ?? `Lead #${fu.owner_id}`}</TableCell>
                                                <TableCell>{fu.scheduled_follow_up}</TableCell>
                                                <TableCell className="flex items-center gap-2">{channelIcons[fu.channel]} {fu.channel}</TableCell>
                                                <TableCell><Badge className={resultColors[fu.result] || ''}>{fu.result}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rejected">
                    <Card>
                        <CardHeader><CardTitle>Instrumentos Reprovados â€” Ação Imediata</CardTitle></CardHeader>
                        <CardContent>
                            {!rejectAlerts?.alerts?.length ? (
                                <p className="text-center py-8 text-muted-foreground">Nenhum instrumento reprovado recente</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>NÂº INMETRO</TableHead>
                                            <TableHead>Proprietário</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Data Reprovação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rejectAlerts.alerts.map((alert: any) => (
                                            <TableRow key={alert.instrument_id}>
                                                <TableCell className="font-mono">{alert.inmetro_number}</TableCell>
                                                <TableCell>{alert.owner_name}</TableCell>
                                                <TableCell>{alert.instrument_type}</TableCell>
                                                <TableCell>{alert.last_verification_at}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="churn">
                    <Card>
                        <CardHeader><CardTitle>Risco de Churn</CardTitle></CardHeader>
                        <CardContent>
                            {!churn?.customers?.length ? (
                                <p className="text-center py-8 text-muted-foreground">Nenhum cliente com risco de churn</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Ãšltima Calibração</TableHead>
                                            <TableHead>Instrumentos</TableHead>
                                            <TableHead>Risco</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {churn.customers.map((c: any) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-medium">{c.name}</TableCell>
                                                <TableCell>{c.last_verification_at ?? 'Nunca'}</TableCell>
                                                <TableCell>{c.total_instruments}</TableCell>
                                                <TableCell>
                                                    <Badge variant="destructive">Alto</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}