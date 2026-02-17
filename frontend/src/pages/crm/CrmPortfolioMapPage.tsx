import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPortfolioMap } from '@/lib/crm-field-api'
import type { PortfolioMapCustomer } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, MapPin, AlertCircle, AlertTriangle, CheckCircle2, Clock, ExternalLink } from 'lucide-react'

const alertConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    ok: { label: 'Em dia', color: 'text-green-600', icon: CheckCircle2 },
    attention: { label: 'Atenção', color: 'text-amber-600', icon: Clock },
    warning: { label: 'Alerta', color: 'text-orange-600', icon: AlertTriangle },
    critical: { label: 'Crítico', color: 'text-red-600', icon: AlertCircle },
}

const ratingColors: Record<string, string> = { A: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300', B: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300', C: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300', D: 'bg-surface-100 text-surface-600' }

export function CrmPortfolioMapPage() {
    const [ratingFilter, setRatingFilter] = useState('all')
    const [alertFilter, setAlertFilter] = useState('all')

    const params: Record<string, unknown> = {}
    if (ratingFilter !== 'all') params.rating = ratingFilter

    const { data: customers = [], isLoading } = useQuery<PortfolioMapCustomer[]>({
        queryKey: ['portfolio-map', params],
        queryFn: () => getPortfolioMap(params),
    })

    const filtered = customers.filter(c => alertFilter === 'all' || c.alert_level === alertFilter)
    const stats = { total: filtered.length, ok: filtered.filter(c => c.alert_level === 'ok').length, attention: filtered.filter(c => c.alert_level === 'attention').length, warning: filtered.filter(c => c.alert_level === 'warning').length, critical: filtered.filter(c => c.alert_level === 'critical').length }

    return (
        <div className="space-y-6">
            <PageHeader title="Mapa de Carteira" description="Visualização geográfica dos clientes com status de contato" />

            <div className="grid grid-cols-5 gap-3">
                {[
                    { key: 'total', label: 'Total', value: stats.total, className: 'bg-surface-0 dark:bg-surface-800' },
                    { key: 'ok', label: 'Em Dia', value: stats.ok, className: 'bg-green-50 border-green-200' },
                    { key: 'attention', label: 'Atenção', value: stats.attention, className: 'bg-amber-50 border-amber-200' },
                    { key: 'warning', label: 'Alerta', value: stats.warning, className: 'bg-orange-50 border-orange-200' },
                    { key: 'critical', label: 'Crítico', value: stats.critical, className: 'bg-red-50 border-red-200' },
                ].map(s => (
                    <Card key={s.key} className={s.className}><CardContent className="py-3 text-center"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Rating" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="A">Rating A</SelectItem><SelectItem value="B">Rating B</SelectItem><SelectItem value="C">Rating C</SelectItem><SelectItem value="D">Rating D</SelectItem></SelectContent>
                </Select>
                <Select value={alertFilter} onValueChange={setAlertFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="ok">Em Dia</SelectItem><SelectItem value="attention">Atenção</SelectItem><SelectItem value="warning">Alerta</SelectItem><SelectItem value="critical">Crítico</SelectItem></SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="grid gap-2">
                    {filtered.map(c => {
                        const ac = alertConfig[c.alert_level]
                        const Icon = ac.icon
                        return (
                            <Card key={c.id} className="hover:shadow-sm transition-shadow">
                                <CardContent className="py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Icon className={`h-5 w-5 ${ac.color}`} />
                                            <div>
                                                <p className="font-medium">{c.name}</p>
                                                <p className="text-sm text-muted-foreground">{c.address_city}{c.address_state ? `, ${c.address_state}` : ''} · {c.days_since_contact < 999 ? `${c.days_since_contact}d sem contato` : 'Nunca contatado'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {c.rating && <Badge className={ratingColors[c.rating]}>{c.rating}</Badge>}
                                            {c.health_score != null && <Badge variant="outline">HS: {c.health_score}</Badge>}
                                            <Button size="sm" variant="ghost" onClick={() => window.open(`https://www.google.com/maps?q=${c.latitude},${c.longitude}`, '_blank')}><ExternalLink className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
