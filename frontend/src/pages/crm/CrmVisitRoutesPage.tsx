import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRoutes, createRoute, updateRoute } from '@/lib/crm-field-api'
import type { VisitRoute } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Route as RouteIcon, MapPin, Plus, Loader2, Calendar, ChevronDown, ChevronUp, Play, CheckCircle2, Clock, Trash2 } from 'lucide-react'
import api from '@/lib/api'

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    planned: { label: 'Planejado', variant: 'outline' },
    in_progress: { label: 'Em Andamento', variant: 'default' },
    completed: { label: 'Concluído', variant: 'secondary' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
}

export function CrmVisitRoutesPage() {
    const qc = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0])
    const [routeName, setRouteName] = useState('')
    const [stops, setStops] = useState<{ customer_id: number; customer_name: string; objective: string }[]>([])
    const [searchCustomer, setSearchCustomer] = useState('')
    const [expandedRoute, setExpandedRoute] = useState<number | null>(null)

    const { data: routesRes, isLoading } = useQuery({
        queryKey: ['visit-routes'],
        queryFn: () => getRoutes(),
    })
    const routes: VisitRoute[] = routesRes?.data ?? []

    const searchQ = useQuery({
        queryKey: ['customers-route-search', searchCustomer],
        queryFn: () => api.get('/customers', { params: { search: searchCustomer, per_page: 8, is_active: true } }).then(r => r.data?.data ?? []),
        enabled: searchCustomer.length >= 2,
    })

    const createMut = useMutation({
        mutationFn: createRoute,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['visit-routes'] }); setShowDialog(false); setStops([]); setRouteName(''); toast.success('Rota criada!') },
        onError: () => toast.error('Erro ao criar rota'),
    })

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => updateRoute(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['visit-routes'] }); toast.success('Rota atualizada!') },
    })

    const addStop = (c: { id: number; name: string }) => {
        if (stops.find(s => s.customer_id === c.id)) { toast.error('Cliente já adicionado'); return }
        setStops([...stops, { customer_id: c.id, customer_name: c.name, objective: '' }])
        setSearchCustomer('')
    }

    const removeStop = (idx: number) => setStops(stops.filter((_, i) => i !== idx))

    return (
        <div className="space-y-6">
            <PageHeader title="Roteiro de Visitas" description="Planeje rotas otimizadas para visitas em campo" />

            <div className="flex justify-end">
                <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Nova Rota</Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : routes.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><RouteIcon className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhuma rota criada ainda</p></CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {routes.map(route => {
                        const sc = statusConfig[route.status] ?? statusConfig.planned
                        const expanded = expandedRoute === route.id
                        return (
                            <Card key={route.id}>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedRoute(expanded ? null : route.id)}>
                                        <div className="flex items-center gap-3">
                                            <RouteIcon className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{route.name || `Rota ${fmtDate(route.route_date)}`}</p>
                                                <p className="text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5 inline mr-1" />{fmtDate(route.route_date)} · {route.total_stops} paradas · {route.completed_stops} visitadas</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={sc.variant}>{sc.label}</Badge>
                                            {route.status === 'planned' && <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); updateMut.mutate({ id: route.id, data: { status: 'in_progress' } }) }}><Play className="h-3.5 w-3.5" /></Button>}
                                            {route.status === 'in_progress' && <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); updateMut.mutate({ id: route.id, data: { status: 'completed' } }) }}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}
                                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </div>
                                    </div>
                                    {expanded && route.stops && (
                                        <div className="mt-4 ml-8 space-y-2">
                                            {route.stops.map((stop, i) => (
                                                <div key={stop.id} className={`flex items-center gap-3 p-2 rounded ${stop.status === 'visited' ? 'bg-green-50 dark:bg-green-900/30' : stop.status === 'skipped' ? 'bg-surface-50' : 'bg-surface-0'}`}>
                                                    <span className="text-sm font-mono text-muted-foreground w-6">{i + 1}.</span>
                                                    <MapPin className={`h-4 w-4 ${stop.status === 'visited' ? 'text-green-600' : 'text-muted-foreground'}`} />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{stop.customer?.name}</p>
                                                        {stop.customer?.address_city && <p className="text-xs text-muted-foreground">{stop.customer.address_city}</p>}
                                                    </div>
                                                    {stop.objective && <span className="text-xs text-muted-foreground">{stop.objective}</span>}
                                                    <Badge variant={stop.status === 'visited' ? 'secondary' : stop.status === 'skipped' ? 'destructive' : 'outline'} className="text-xs">{stop.status === 'visited' ? 'Visitado' : stop.status === 'skipped' ? 'Pulado' : 'Pendente'}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Nova Rota de Visitas</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Data *</Label><Input type="date" value={routeDate} onChange={e => setRouteDate(e.target.value)} /></div>
                            <div><Label>Nome</Label><Input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Ex: Rota Zona Sul" /></div>
                        </div>
                        <div>
                            <Label>Adicionar Paradas</Label>
                            <Input placeholder="Buscar cliente..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} className="mb-2" />
                            {(searchQ.data ?? []).length > 0 && searchCustomer.length >= 2 && (
                                <div className="border rounded-md max-h-32 overflow-auto mb-2">
                                    {(searchQ.data ?? []).map((c: { id: number; name: string }) => (
                                        <button key={c.id} className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm" onClick={() => addStop(c)}>{c.name}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {stops.length > 0 && (
                            <div className="space-y-2">
                                <Label>Paradas ({stops.length})</Label>
                                {stops.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2 border rounded">
                                        <span className="text-sm font-mono w-6">{i + 1}.</span>
                                        <span className="flex-1 text-sm">{s.customer_name}</span>
                                        <Button size="sm" variant="ghost" onClick={() => removeStop(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                        <Button onClick={() => createMut.mutate({ route_date: routeDate, name: routeName || undefined, stops: stops.map(s => ({ customer_id: s.customer_id })) })} disabled={createMut.isPending || stops.length === 0}>
                            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Criar Rota
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
