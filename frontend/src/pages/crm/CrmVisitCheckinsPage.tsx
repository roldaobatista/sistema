import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCheckins, doCheckin, doCheckout } from '@/lib/crm-field-api'
import type { VisitCheckin } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { MapPin, Clock, LogIn, LogOut, Loader2, Navigation, UserCheck, AlertCircle, CheckCircle2, XCircle, Timer } from 'lucide-react'
import api from '@/lib/api'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtDuration = (min: number | null) => {
    if (!min) return '-'
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h ${m}min` : `${m}min`
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
    checked_in: { label: 'Em Visita', variant: 'default', icon: Timer },
    checked_out: { label: 'Finalizada', variant: 'secondary', icon: CheckCircle2 },
    cancelled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
}

export function CrmVisitCheckinsPage() {
    const qc = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [customerId, setCustomerId] = useState('')
    const [notes, setNotes] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [gettingLocation, setGettingLocation] = useState(false)
    const [customers, setCustomers] = useState<{ id: number; name: string }[]>([])
    const [searchCustomer, setSearchCustomer] = useState('')

    const params: Record<string, unknown> = { per_page: 50 }
    if (statusFilter !== 'all') params.status = statusFilter

    const { data: checkinsRes, isLoading } = useQuery({
        queryKey: ['visit-checkins', params],
        queryFn: () => getCheckins(params),
    })

    const checkins: VisitCheckin[] = checkinsRes?.data ?? []
    const activeCheckin = checkins.find(c => c.status === 'checked_in')

    const searchCustomersQuery = useQuery({
        queryKey: ['customers-search', searchCustomer],
        queryFn: () => api.get('/api/v1/customers', { params: { search: searchCustomer, per_page: 10, is_active: true } }).then(r => r.data?.data ?? []),
        enabled: searchCustomer.length >= 2,
    })

    const checkinMut = useMutation({
        mutationFn: doCheckin,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['visit-checkins'] }); setShowDialog(false); setCustomerId(''); setNotes(''); toast.success('Check-in realizado!') },
        onError: () => toast.error('Erro ao fazer check-in'),
    })

    const checkoutMut = useMutation({
        mutationFn: (id: number) => {
            return new Promise<unknown>((resolve, reject) => {
                setGettingLocation(true)
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        pos => { setGettingLocation(false); resolve(doCheckout(id, { checkout_lat: pos.coords.latitude, checkout_lng: pos.coords.longitude })) },
                        () => { setGettingLocation(false); resolve(doCheckout(id)) },
                        { timeout: 5000 }
                    )
                } else { setGettingLocation(false); resolve(doCheckout(id)) }
            })
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['visit-checkins'] }); toast.success('Check-out realizado!') },
        onError: () => toast.error('Erro ao fazer check-out'),
    })

    const handleStartCheckin = () => {
        if (!customerId) { toast.error('Selecione um cliente'); return }
        setGettingLocation(true)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => { setGettingLocation(false); checkinMut.mutate({ customer_id: Number(customerId), checkin_lat: pos.coords.latitude, checkin_lng: pos.coords.longitude, notes: notes || undefined }) },
                () => { setGettingLocation(false); checkinMut.mutate({ customer_id: Number(customerId), notes: notes || undefined }) },
                { timeout: 5000 }
            )
        } else { setGettingLocation(false); checkinMut.mutate({ customer_id: Number(customerId), notes: notes || undefined }) }
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Check-in de Visitas" description="Registre suas visitas em campo com localização GPS" />

            {activeCheckin && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Timer className="h-5 w-5 text-blue-600 animate-pulse" />
                                <CardTitle className="text-blue-800">Visita em Andamento</CardTitle>
                            </div>
                            <Button onClick={() => checkoutMut.mutate(activeCheckin.id)} disabled={checkoutMut.isPending || gettingLocation} variant="default">
                                {checkoutMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                                Fazer Check-out
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{activeCheckin.customer?.name}</p></div>
                            <div><span className="text-muted-foreground">Entrada:</span><p className="font-medium">{fmtDate(activeCheckin.checkin_at)}</p></div>
                            <div><span className="text-muted-foreground">Duração:</span><p className="font-medium">{fmtDuration(Math.floor((Date.now() - new Date(activeCheckin.checkin_at).getTime()) / 60000))}</p></div>
                            {activeCheckin.distance_from_client_meters != null && (
                                <div><span className="text-muted-foreground">Distância:</span><p className="font-medium">{activeCheckin.distance_from_client_meters > 1000 ? `${(activeCheckin.distance_from_client_meters / 1000).toFixed(1)} km` : `${Math.round(activeCheckin.distance_from_client_meters)} m`}</p></div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="checked_in">Em Visita</SelectItem>
                            <SelectItem value="checked_out">Finalizadas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => setShowDialog(true)} disabled={!!activeCheckin}>
                    <LogIn className="h-4 w-4 mr-2" /> Novo Check-in
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : checkins.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhum check-in encontrado</p></CardContent></Card>
            ) : (
                <div className="grid gap-3">
                    {checkins.filter(c => c.id !== activeCheckin?.id).map(checkin => {
                        const sc = statusConfig[checkin.status] ?? statusConfig.checked_out
                        const Icon = sc.icon
                        return (
                            <Card key={checkin.id} className="hover:shadow-sm transition-shadow">
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Icon className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{checkin.customer?.name}</p>
                                                <p className="text-sm text-muted-foreground">{fmtDate(checkin.checkin_at)} {checkin.checkout_at && `→ ${fmtDate(checkin.checkout_at)}`}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            {checkin.duration_minutes != null && <span className="text-muted-foreground"><Clock className="h-3.5 w-3.5 inline mr-1" />{fmtDuration(checkin.duration_minutes)}</span>}
                                            {checkin.distance_from_client_meters != null && <span className="text-muted-foreground"><Navigation className="h-3.5 w-3.5 inline mr-1" />{checkin.distance_from_client_meters > 1000 ? `${(checkin.distance_from_client_meters / 1000).toFixed(1)}km` : `${Math.round(checkin.distance_from_client_meters)}m`}</span>}
                                            <Badge variant={sc.variant}>{sc.label}</Badge>
                                        </div>
                                    </div>
                                    {checkin.notes && <p className="mt-2 text-sm text-muted-foreground pl-8">{checkin.notes}</p>}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Novo Check-in de Visita</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Cliente *</Label>
                            <Input placeholder="Buscar cliente..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} className="mb-2" />
                            {(searchCustomersQuery.data ?? []).length > 0 && (
                                <div className="border rounded-md max-h-40 overflow-auto">
                                    {(searchCustomersQuery.data ?? []).map((c: { id: number; name: string }) => (
                                        <button key={c.id} className={`w-full text-left px-3 py-2 hover:bg-accent text-sm ${String(c.id) === customerId ? 'bg-accent' : ''}`} onClick={() => { setCustomerId(String(c.id)); setSearchCustomer(c.name) }}>
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Objetivo da visita..." rows={3} /></div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Navigation className="h-4 w-4" /> Localização GPS será capturada automaticamente</div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                        <Button onClick={handleStartCheckin} disabled={checkinMut.isPending || gettingLocation}>
                            {(checkinMut.isPending || gettingLocation) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                            Fazer Check-in
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
