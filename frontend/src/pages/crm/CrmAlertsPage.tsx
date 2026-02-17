import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmSmartAlert } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
    Bell, BellRing, Check, Eye, X, Zap, Loader2,
    AlertCircle, AlertTriangle, Info, ShieldAlert,
    RefreshCw, Filter,
} from 'lucide-react'

const priorityConfig: Record<string, { label: string; color: string; bgClass: string; textClass: string; borderClass: string; icon: React.ElementType }> = {
    critical: { label: 'Crítico', color: 'destructive', bgClass: 'bg-red-50', textClass: 'text-red-700', borderClass: 'border-red-200', icon: AlertCircle },
    high: { label: 'Alto', color: 'warning', bgClass: 'bg-orange-50', textClass: 'text-orange-700', borderClass: 'border-orange-200', icon: AlertTriangle },
    medium: { label: 'Médio', color: 'secondary', bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200', icon: Info },
    low: { label: 'Baixo', color: 'outline', bgClass: 'bg-surface-50', textClass: 'text-surface-600', borderClass: 'border-surface-200', icon: Info },
}

const statusLabels: Record<string, string> = {
    active: 'Ativo',
    acknowledged: 'Reconhecido',
    resolved: 'Resolvido',
    dismissed: 'Descartado',
}

const typeLabels: Record<string, string> = {
    stale_deal: 'Negócio parado',
    no_activity: 'Sem atividade',
    contract_expiring: 'Contrato vencendo',
    deal_at_risk: 'Negócio em risco',
    goal_behind: 'Meta atrasada',
    big_deal_stuck: 'Negócio grande parado',
    lead_cold: 'Lead esfriando',
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export function CrmAlertsPage() {
    const queryClient = useQueryClient()
    const [statusFilter, setStatusFilter] = useState('active')
    const [typeFilter, setTypeFilter] = useState('all')
    const [priorityFilter, setPriorityFilter] = useState('all')

    const params: Record<string, unknown> = {}
    if (statusFilter !== 'all') params.status = statusFilter
    if (typeFilter !== 'all') params.type = typeFilter
    if (priorityFilter !== 'all') params.priority = priorityFilter

    const { data: alertsRes, isLoading, isError } = useQuery({
        queryKey: ['crm-smart-alerts', params],
        queryFn: () => crmFeaturesApi.getSmartAlerts(params).then(r => r.data),
    })

    const alerts: CrmSmartAlert[] = Array.isArray(alertsRes) ? alertsRes : (alertsRes as { data?: CrmSmartAlert[] })?.data ?? []

    const acknowledgeMut = useMutation({
        mutationFn: (id: number) => crmFeaturesApi.acknowledgeAlert(id),
        onSuccess: () => { toast.success('Alerta reconhecido'); invalidate() },
        onError: () => toast.error('Erro ao reconhecer alerta'),
    })

    const resolveMut = useMutation({
        mutationFn: (id: number) => crmFeaturesApi.resolveAlert(id),
        onSuccess: () => { toast.success('Alerta resolvido'); invalidate() },
        onError: () => toast.error('Erro ao resolver alerta'),
    })

    const dismissMut = useMutation({
        mutationFn: (id: number) => crmFeaturesApi.dismissAlert(id),
        onSuccess: () => { toast.info('Alerta descartado'); invalidate() },
        onError: () => toast.error('Erro ao descartar alerta'),
    })

    const generateMut = useMutation({
        mutationFn: () => crmFeaturesApi.generateAlerts(),
        onSuccess: () => { toast.success('Alertas gerados com sucesso'); invalidate() },
        onError: () => toast.error('Erro ao gerar alertas'),
    })

    function invalidate() {
        queryClient.invalidateQueries({ queryKey: ['crm-smart-alerts'] })
    }

    const countByPriority = (p: string) => alerts.filter(a => a.priority === p).length

    return (
        <div className="space-y-6">
            <PageHeader
                title="Alertas Inteligentes"
                subtitle="Monitore negócios, atividades e contratos que precisam de atenção"
                icon={BellRing}
            >
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateMut.mutate()}
                    disabled={generateMut.isPending}
                    icon={generateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                >
                    Gerar Alertas
                </Button>
            </PageHeader>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['critical', 'high', 'medium', 'low'] as const).map(p => {
                    const cfg = priorityConfig[p]
                    const Icon = cfg.icon
                    return (
                        <Card key={p} className={`${cfg.bgClass} ${cfg.borderClass}`}>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <Icon className={`h-5 w-5 ${cfg.textClass}`} />
                                    <div>
                                        <p className="text-2xl font-bold">{countByPriority(p)}</p>
                                        <p className={`text-sm ${cfg.textClass}`}>{cfg.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Status</SelectItem>
                                <SelectItem value="active">Ativo</SelectItem>
                                <SelectItem value="acknowledged">Reconhecido</SelectItem>
                                <SelectItem value="resolved">Resolvido</SelectItem>
                                <SelectItem value="dismissed">Descartado</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Tipos</SelectItem>
                                {Object.entries(typeLabels).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Prioridade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="critical">Crítico</SelectItem>
                                <SelectItem value="high">Alto</SelectItem>
                                <SelectItem value="medium">Médio</SelectItem>
                                <SelectItem value="low">Baixo</SelectItem>
                            </SelectContent>
                        </Select>

                        {(statusFilter !== 'active' || typeFilter !== 'all' || priorityFilter !== 'all') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setStatusFilter('active'); setTypeFilter('all'); setPriorityFilter('all') }}
                            >
                                Limpar filtros
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Alerts List */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {isError && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <RefreshCw className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Erro ao carregar alertas.</p>
                            <Button variant="outline" size="sm" onClick={() => invalidate()}>
                                Tentar novamente
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && alerts.length === 0 && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                            <Bell className="h-10 w-10 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">Nenhum alerta encontrado com os filtros selecionados</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && alerts.length > 0 && (
                <div className="space-y-3">
                    {alerts.map(alert => {
                        const cfg = priorityConfig[alert.priority] ?? priorityConfig.low
                        const PriorityIcon = cfg.icon

                        return (
                            <Card key={alert.id} className={`${cfg.bgClass} ${cfg.borderClass} transition-colors`}>
                                <CardContent className="pt-5 pb-4">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-0.5 shrink-0">
                                            <PriorityIcon className={`h-5 w-5 ${cfg.textClass}`} />
                                        </div>

                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-medium leading-tight">{alert.title}</p>
                                                    {alert.description && (
                                                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                                            {alert.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Badge variant={cfg.color as any}>{cfg.label}</Badge>
                                                    <Badge variant="outline">
                                                        {typeLabels[alert.type] ?? alert.type}
                                                    </Badge>
                                                    <Badge variant="secondary">
                                                        {statusLabels[alert.status] ?? alert.status}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                {alert.customer && (
                                                    <span>Cliente: <strong>{alert.customer.name}</strong></span>
                                                )}
                                                {alert.deal && (
                                                    <span>Negócio: <strong>{alert.deal.title}</strong></span>
                                                )}
                                                {alert.assignee && (
                                                    <span>Responsável: <strong>{alert.assignee.name}</strong></span>
                                                )}
                                                <span>{fmtDate(alert.created_at)}</span>
                                            </div>

                                            {alert.status === 'active' && (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => acknowledgeMut.mutate(alert.id)}
                                                        disabled={acknowledgeMut.isPending}
                                                        icon={<Eye className="h-3.5 w-3.5" />}
                                                    >
                                                        Reconhecer
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => resolveMut.mutate(alert.id)}
                                                        disabled={resolveMut.isPending}
                                                        icon={<Check className="h-3.5 w-3.5" />}
                                                    >
                                                        Resolver
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => dismissMut.mutate(alert.id)}
                                                        disabled={dismissMut.isPending}
                                                        icon={<X className="h-3.5 w-3.5" />}
                                                    >
                                                        Descartar
                                                    </Button>
                                                </div>
                                            )}

                                            {alert.status === 'acknowledged' && (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => resolveMut.mutate(alert.id)}
                                                        disabled={resolveMut.isPending}
                                                        icon={<Check className="h-3.5 w-3.5" />}
                                                    >
                                                        Resolver
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => dismissMut.mutate(alert.id)}
                                                        disabled={dismissMut.isPending}
                                                        icon={<X className="h-3.5 w-3.5" />}
                                                    >
                                                        Descartar
                                                    </Button>
                                                </div>
                                            )}
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
