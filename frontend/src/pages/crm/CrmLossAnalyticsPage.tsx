import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi, type CrmLossReason, type CrmLossAnalytics } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogBody, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { TableSkeleton } from '@/components/ui/tableskeleton'
import { toast } from 'sonner'
import {
    TrendingDown, Plus, Pencil, Trash2,
    BarChart3, Users, Calendar, Swords,
} from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
    price: 'Preço', product: 'Produto', service: 'Serviço',
    competitor: 'Concorrência', timing: 'Timing', other: 'Outro',
}

const CATEGORY_COLORS: Record<string, string> = {
    price: 'bg-red-500', product: 'bg-amber-500', service: 'bg-sky-500',
    competitor: 'bg-purple-500', timing: 'bg-emerald-500', other: 'bg-surface-400',
}

const fmtBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const EMPTY_REASON: Partial<CrmLossReason> = { name: '', category: 'other', is_active: true }

export function CrmLossAnalyticsPage() {
    const qc = useQueryClient()
    const [months, setMonths] = useState(6)
    const [tab, setTab] = useState('reasons')
    const [reasonDialogOpen, setReasonDialogOpen] = useState(false)
    const [editingReason, setEditingReason] = useState<Partial<CrmLossReason>>(EMPTY_REASON)
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    const { data: reasons = [], isLoading: loadingReasons, isError: errorReasons, refetch: refetchReasons } = useQuery({
        queryKey: ['loss-reasons'],
        queryFn: async () => (await crmFeaturesApi.getLossReasons()).data,
    })

    const { data: analytics, isLoading: loadingAnalytics, isError: errorAnalytics, refetch: refetchAnalytics } = useQuery({
        queryKey: ['loss-analytics', months],
        queryFn: async () => (await crmFeaturesApi.getLossAnalytics({ months })).data as CrmLossAnalytics,
    })

    const saveMutation = useMutation({
        mutationFn: (data: Partial<CrmLossReason>) =>
            data.id
                ? crmFeaturesApi.updateLossReason(data.id, data)
                : crmFeaturesApi.createLossReason(data),
        onSuccess: () => {
            toast.success(editingReason.id ? 'Motivo atualizado com sucesso' : 'Motivo criado com sucesso')
            qc.invalidateQueries({ queryKey: ['loss-reasons'] })
            closeReasonDialog()
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao salvar motivo')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => crmFeaturesApi.updateLossReason(id, { is_active: false }),
        onSuccess: () => {
            toast.success('Motivo desativado com sucesso')
            qc.invalidateQueries({ queryKey: ['loss-reasons'] })
            setDeleteTarget(null)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao desativar motivo')
            setDeleteTarget(null)
        },
    })

    function closeReasonDialog() {
        setReasonDialogOpen(false)
        setEditingReason(EMPTY_REASON)
    }

    function handleSaveReason() {
        if (!editingReason.name?.trim()) {
            toast.error('Informe o nome do motivo')
            return
        }
        saveMutation.mutate(editingReason)
    }

    const maxByReasonCount = Math.max(...(analytics?.by_reason?.map(r => r.count) ?? [1]), 1)
    const maxByCompetitorCount = Math.max(...(analytics?.by_competitor?.map(c => c.count) ?? [1]), 1)
    const maxByUserCount = Math.max(...(analytics?.by_user?.map(u => u.count) ?? [1]), 1)
    const maxTrendCount = Math.max(...(analytics?.monthly_trend?.map(t => t.count) ?? [1]), 1)

    const totalLosses = analytics?.by_reason?.reduce((acc, r) => acc + r.count, 0) ?? 0
    const totalValue = analytics?.by_reason?.reduce((acc, r) => acc + r.total_value, 0) ?? 0

    return (
        <div className="space-y-6">
            <PageHeader
                title="Análise de Perdas"
                subtitle="Motivos de perda e analytics de negócios perdidos"
                icon={TrendingDown}
                actions={[{
                    label: 'Novo Motivo',
                    onClick: () => { setEditingReason(EMPTY_REASON); setReasonDialogOpen(true) },
                    icon: <Plus className="h-4 w-4" />,
                }]}
            />

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-xs text-surface-500 mb-1">Total de Perdas</p>
                        <p className="text-2xl font-bold text-surface-900">{totalLosses}</p>
                        <p className="text-xs text-surface-400 mt-0.5">últimos {months} meses</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-xs text-surface-500 mb-1">Valor Total Perdido</p>
                        <p className="text-2xl font-bold text-red-600">{fmtBRL(totalValue)}</p>
                        <p className="text-xs text-surface-400 mt-0.5">últimos {months} meses</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-xs text-surface-500 mb-1">Motivos Cadastrados</p>
                        <p className="text-2xl font-bold text-surface-900">{reasons.length}</p>
                        <p className="text-xs text-surface-400 mt-0.5">{reasons.filter(r => r.is_active).length} ativos</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-xs text-surface-500 mb-1">Concorrentes</p>
                        <p className="text-2xl font-bold text-surface-900">{analytics?.by_competitor?.length ?? 0}</p>
                        <p className="text-xs text-surface-400 mt-0.5">identificados</p>
                    </CardContent>
                </Card>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-surface-600">Período:</span>
                {[3, 6, 12].map(m => (
                    <Button
                        key={m}
                        variant={months === m ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setMonths(m)}
                    >
                        {m} meses
                    </Button>
                ))}
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="reasons">
                        <BarChart3 className="h-3.5 w-3.5 mr-1" /> Por Motivo
                    </TabsTrigger>
                    <TabsTrigger value="competitors">
                        <Swords className="h-3.5 w-3.5 mr-1" /> Por Concorrente
                    </TabsTrigger>
                    <TabsTrigger value="sellers">
                        <Users className="h-3.5 w-3.5 mr-1" /> Por Vendedor
                    </TabsTrigger>
                    <TabsTrigger value="trend">
                        <Calendar className="h-3.5 w-3.5 mr-1" /> Tendência Mensal
                    </TabsTrigger>
                    <TabsTrigger value="manage">Gerenciar Motivos</TabsTrigger>
                </TabsList>

                {/* By Reason */}
                <TabsContent value="reasons" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Perdas por Motivo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingAnalytics && <TableSkeleton rows={5} cols={3} />}
                            {errorAnalytics && (
                                <EmptyState
                                    title="Erro ao carregar dados"
                                    message="Não foi possível carregar a análise."
                                    action={{ label: 'Tentar novamente', onClick: () => refetchAnalytics() }}
                                />
                            )}
                            {!loadingAnalytics && !errorAnalytics && (!analytics?.by_reason?.length) && (
                                <EmptyState title="Sem dados" message="Nenhuma perda registrada no período." />
                            )}
                            {!loadingAnalytics && !errorAnalytics && analytics?.by_reason && analytics.by_reason.length > 0 && (
                                <div className="space-y-3">
                                    {analytics.by_reason.map(reason => (
                                        <div key={reason.name} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-surface-900">{reason.name}</span>
                                                    <Badge variant="default" size="xs">
                                                        {CATEGORY_LABELS[reason.category] ?? reason.category}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-surface-500">{reason.count} perdas</span>
                                                    <span className="font-semibold text-red-600">{fmtBRL(reason.total_value)}</span>
                                                </div>
                                            </div>
                                            <div className="h-5 bg-surface-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${CATEGORY_COLORS[reason.category] ?? 'bg-surface-400'}`}
                                                    style={{ width: `${(reason.count / maxByReasonCount) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* By Competitor */}
                <TabsContent value="competitors" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Perdas por Concorrente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingAnalytics && <TableSkeleton rows={4} cols={3} />}
                            {!loadingAnalytics && (!analytics?.by_competitor?.length) && (
                                <EmptyState title="Sem dados" message="Nenhum concorrente identificado no período." />
                            )}
                            {!loadingAnalytics && analytics?.by_competitor && analytics.by_competitor.length > 0 && (
                                <div className="space-y-3">
                                    {analytics.by_competitor.map(comp => (
                                        <div key={comp.competitor_name} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-surface-900">{comp.competitor_name}</span>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-surface-500">{comp.count} perdas</span>
                                                    <span className="font-semibold text-red-600">{fmtBRL(comp.total_value)}</span>
                                                    {comp.avg_competitor_price > 0 && (
                                                        <span className="text-surface-400">Preço médio: {fmtBRL(comp.avg_competitor_price)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="h-5 bg-surface-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                                                    style={{ width: `${(comp.count / maxByCompetitorCount) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* By Seller */}
                <TabsContent value="sellers" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Perdas por Vendedor</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingAnalytics && <TableSkeleton rows={4} cols={3} />}
                            {!loadingAnalytics && (!analytics?.by_user?.length) && (
                                <EmptyState title="Sem dados" message="Nenhuma perda registrada por vendedor no período." />
                            )}
                            {!loadingAnalytics && analytics?.by_user && analytics.by_user.length > 0 && (
                                <div className="space-y-3">
                                    {analytics.by_user.map(user => (
                                        <div key={user.name} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-surface-900">{user.name}</span>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-surface-500">{user.count} perdas</span>
                                                    <span className="font-semibold text-red-600">{fmtBRL(user.total_value)}</span>
                                                </div>
                                            </div>
                                            <div className="h-5 bg-surface-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-sky-500 transition-all duration-500"
                                                    style={{ width: `${(user.count / maxByUserCount) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Monthly Trend */}
                <TabsContent value="trend" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Tendência Mensal de Perdas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingAnalytics && <TableSkeleton rows={4} cols={3} />}
                            {!loadingAnalytics && (!analytics?.monthly_trend?.length) && (
                                <EmptyState title="Sem dados" message="Nenhuma tendência disponível no período." />
                            )}
                            {!loadingAnalytics && analytics?.monthly_trend && analytics.monthly_trend.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-end gap-1.5" style={{ height: 200 }}>
                                        {analytics.monthly_trend.map(month => (
                                            <div key={month.month} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                                                <span className="text-[10px] font-semibold text-surface-600 tabular-nums">
                                                    {month.count}
                                                </span>
                                                <div
                                                    className="w-full bg-red-400 rounded-t hover:bg-red-500 transition-colors min-h-[4px]"
                                                    style={{ height: `${(month.count / maxTrendCount) * 100}%` }}
                                                />
                                                <span className="text-[10px] text-surface-400 whitespace-nowrap">
                                                    {month.month}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-subtle pt-2 mt-2">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {analytics.monthly_trend.slice(-4).map(m => (
                                                <div key={m.month} className="text-center">
                                                    <p className="text-xs text-surface-400">{m.month}</p>
                                                    <p className="text-sm font-semibold text-surface-900">{m.count} perdas</p>
                                                    <p className="text-xs text-red-600">{fmtBRL(m.total_value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Manage Reasons */}
                <TabsContent value="manage" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Motivos de Perda</CardTitle>
                                <Button variant="outline" size="sm" onClick={() => { setEditingReason(EMPTY_REASON); setReasonDialogOpen(true) }}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Novo Motivo
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingReasons && <TableSkeleton rows={5} cols={3} />}
                            {errorReasons && (
                                <EmptyState
                                    title="Erro ao carregar motivos"
                                    message="Não foi possível carregar os motivos."
                                    action={{ label: 'Tentar novamente', onClick: () => refetchReasons() }}
                                />
                            )}
                            {!loadingReasons && !errorReasons && reasons.length === 0 && (
                                <EmptyState
                                    title="Nenhum motivo cadastrado"
                                    message="Cadastre motivos de perda para análise."
                                    action={{ label: 'Novo Motivo', onClick: () => { setEditingReason(EMPTY_REASON); setReasonDialogOpen(true) } }}
                                />
                            )}
                            {!loadingReasons && !errorReasons && reasons.length > 0 && (
                                <div className="space-y-2">
                                    {reasons.map(reason => (
                                        <div
                                            key={reason.id}
                                            className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2.5 hover:bg-surface-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[reason.category] ?? 'bg-surface-400'}`} />
                                                <span className="text-sm font-medium text-surface-900">{reason.name}</span>
                                                <Badge variant="default" size="xs">
                                                    {CATEGORY_LABELS[reason.category] ?? reason.category}
                                                </Badge>
                                                <Badge variant={reason.is_active ? 'success' : 'default'} size="xs">
                                                    {reason.is_active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost" size="sm"
                                                    onClick={() => { setEditingReason({ ...reason }); setReasonDialogOpen(true) }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(reason.id)}>
                                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Reason Dialog */}
            <Dialog open={reasonDialogOpen} onOpenChange={open => { if (!open) closeReasonDialog() }}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>{editingReason.id ? 'Editar Motivo' : 'Novo Motivo de Perda'}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                        <Input
                            label="Nome *"
                            placeholder="Ex: Preço alto"
                            value={editingReason.name ?? ''}
                            onChange={e => setEditingReason(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <div className="space-y-1.5">
                            <label className="block text-[13px] font-medium text-surface-700">Categoria</label>
                            <Select
                                value={editingReason.category ?? 'other'}
                                onValueChange={val => setEditingReason(prev => ({ ...prev, category: val }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeReasonDialog}>Cancelar</Button>
                        <Button onClick={handleSaveReason} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Desativar Motivo</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <p className="text-sm text-surface-600">
                            Tem certeza que deseja desativar este motivo? Ele não aparecerá mais como opção para novos registros.
                        </p>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Desativando...' : 'Desativar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
