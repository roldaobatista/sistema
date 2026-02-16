import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmSalesGoal } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/ui/pageheader'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
    Target, Plus, RefreshCw, Trophy, TrendingUp, Users,
    Medal, Loader2, BarChart3, DollarSign,
} from 'lucide-react'

const fmtBRL = (v: number | string) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtPct = (target: number, achieved: number) =>
    target > 0 ? Math.min((achieved / target) * 100, 100).toFixed(1) : '0.0'

function getProgressColor(pct: number): string {
    if (pct >= 100) return 'bg-emerald-500'
    if (pct >= 75) return 'bg-blue-500'
    if (pct >= 50) return 'bg-amber-500'
    return 'bg-red-500'
}

function getRankBadge(index: number) {
    if (index === 0) return <Medal className="h-5 w-5 text-amber-500" />
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />
    if (index === 2) return <Medal className="h-5 w-5 text-amber-700" />
    return <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</span>
}

const periodLabels: Record<string, string> = {
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    semester: 'Semestral',
    yearly: 'Anual',
}

export function CrmGoalsPage() {
    const queryClient = useQueryClient()
    const [dialogOpen, setDialogOpen] = useState(false)

    const { data: dashRes, isLoading: dashLoading } = useQuery({
        queryKey: ['crm-goals-dashboard'],
        queryFn: () => crmFeaturesApi.getGoalsDashboard().then(r => r.data),
    })

    const { data: goalsRes, isLoading: goalsLoading } = useQuery({
        queryKey: ['crm-goals'],
        queryFn: () => crmFeaturesApi.getSalesGoals().then(r => r.data),
    })

    const recalcMut = useMutation({
        mutationFn: () => crmFeaturesApi.recalculateGoals(),
        onSuccess: () => {
            toast.success('Metas recalculadas com sucesso')
            queryClient.invalidateQueries({ queryKey: ['crm-goals'] })
            queryClient.invalidateQueries({ queryKey: ['crm-goals-dashboard'] })
        },
        onError: () => toast.error('Erro ao recalcular metas'),
    })

    const dashboard = dashRes?.data ?? dashRes ?? {}
    const goals: CrmSalesGoal[] = Array.isArray(goalsRes) ? goalsRes : (goalsRes as { data?: CrmSalesGoal[] })?.data ?? []
    const isLoading = dashLoading || goalsLoading

    const ranking = [...goals]
        .map(g => {
            const revPct = g.target_revenue > 0 ? (g.achieved_revenue / g.target_revenue) * 100 : 0
            const dealsPct = g.target_deals > 0 ? (g.achieved_deals / g.target_deals) * 100 : 0
            return { ...g, revPct, dealsPct, avgPct: (revPct + dealsPct) / 2 }
        })
        .sort((a, b) => b.avgPct - a.avgPct)

    const totalTargetRevenue = goals.reduce((s, g) => s + g.target_revenue, 0)
    const totalAchievedRevenue = goals.reduce((s, g) => s + g.achieved_revenue, 0)
    const totalTargetDeals = goals.reduce((s, g) => s + g.target_deals, 0)
    const totalAchievedDeals = goals.reduce((s, g) => s + g.achieved_deals, 0)

    return (
        <div className="space-y-6">
            <PageHeader
                title="Metas de Vendas"
                subtitle="Acompanhamento de metas e quotas da equipe comercial"
                icon={Target}
            >
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => recalcMut.mutate()}
                    disabled={recalcMut.isPending}
                    icon={recalcMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                >
                    Recalcular
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                            Nova Meta
                        </Button>
                    </DialogTrigger>
                    <CreateGoalDialog
                        onSuccess={() => {
                            setDialogOpen(false)
                            queryClient.invalidateQueries({ queryKey: ['crm-goals'] })
                            queryClient.invalidateQueries({ queryKey: ['crm-goals-dashboard'] })
                        }}
                    />
                </Dialog>
            </PageHeader>

            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {!isLoading && (
                <>
                    {/* KPI Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                        <DollarSign className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Receita Atingida</p>
                                        <p className="text-2xl font-bold">{fmtBRL(totalAchievedRevenue)}</p>
                                        <p className="text-xs text-muted-foreground">de {fmtBRL(totalTargetRevenue)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">% Receita</p>
                                        <p className="text-2xl font-bold">
                                            {fmtPct(totalTargetRevenue, totalAchievedRevenue)}%
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                                        <BarChart3 className="h-6 w-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Negócios Fechados</p>
                                        <p className="text-2xl font-bold">{totalAchievedDeals}</p>
                                        <p className="text-xs text-muted-foreground">de {totalTargetDeals}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                                        <Users className="h-6 w-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Vendedores c/ Meta</p>
                                        <p className="text-2xl font-bold">{goals.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Ranking Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-amber-500" />
                                Ranking de Vendedores
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {ranking.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Nenhuma meta cadastrada
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {ranking.map((g, i) => {
                                        const revPctNum = Number(fmtPct(g.target_revenue, g.achieved_revenue))
                                        const dealsPctNum = Number(fmtPct(g.target_deals, g.achieved_deals))
                                        return (
                                            <div key={g.id} className="rounded-lg border p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {getRankBadge(i)}
                                                        <div>
                                                            <p className="font-medium">
                                                                {g.user?.name ?? `Usuário #${g.user_id}`}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {periodLabels[g.period_type] ?? g.period_type}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant="secondary"
                                                        className={
                                                            g.avgPct >= 100
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : g.avgPct >= 50
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : 'bg-red-100 text-red-700'
                                                        }
                                                    >
                                                        {g.avgPct.toFixed(1)}% geral
                                                    </Badge>
                                                </div>

                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-muted-foreground">Receita</span>
                                                            <span className="font-medium">
                                                                {fmtBRL(g.achieved_revenue)} / {fmtBRL(g.target_revenue)}
                                                            </span>
                                                        </div>
                                                        <Progress
                                                            value={revPctNum}
                                                            className="h-2"
                                                            indicatorClassName={getProgressColor(revPctNum)}
                                                        />
                                                        <p className="text-xs text-right text-muted-foreground">{revPctNum}%</p>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-muted-foreground">Negócios</span>
                                                            <span className="font-medium">
                                                                {g.achieved_deals} / {g.target_deals}
                                                            </span>
                                                        </div>
                                                        <Progress
                                                            value={dealsPctNum}
                                                            className="h-2"
                                                            indicatorClassName={getProgressColor(dealsPctNum)}
                                                        />
                                                        <p className="text-xs text-right text-muted-foreground">{dealsPctNum}%</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}

function CreateGoalDialog({ onSuccess }: { onSuccess: () => void }) {
    const [form, setForm] = useState({
        user_id: '',
        period_type: 'monthly',
        period_start: '',
        period_end: '',
        target_revenue: '',
        target_deals: '',
        target_new_customers: '',
        target_activities: '',
    })

    const createMut = useMutation({
        mutationFn: () =>
            crmFeaturesApi.createSalesGoal({
                user_id: form.user_id ? Number(form.user_id) : null,
                period_type: form.period_type,
                period_start: form.period_start,
                period_end: form.period_end,
                target_revenue: Number(form.target_revenue) || 0,
                target_deals: Number(form.target_deals) || 0,
                target_new_customers: Number(form.target_new_customers) || 0,
                target_activities: Number(form.target_activities) || 0,
            }),
        onSuccess: () => {
            toast.success('Meta criada com sucesso')
            onSuccess()
        },
        onError: () => toast.error('Erro ao criar meta'),
    })

    const update = (field: string, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }))

    return (
        <DialogContent size="lg">
            <DialogHeader>
                <DialogTitle>Nova Meta de Vendas</DialogTitle>
                <DialogDescription>Defina as metas para o vendedor no período selecionado</DialogDescription>
            </DialogHeader>
            <DialogBody>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>ID do Usuário</Label>
                        <Input
                            type="number"
                            placeholder="ID do vendedor"
                            value={form.user_id}
                            onChange={e => update('user_id', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Período</Label>
                        <Select value={form.period_type} onValueChange={v => update('period_type', v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">Mensal</SelectItem>
                                <SelectItem value="quarterly">Trimestral</SelectItem>
                                <SelectItem value="semester">Semestral</SelectItem>
                                <SelectItem value="yearly">Anual</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Data Início</Label>
                        <Input type="date" value={form.period_start} onChange={e => update('period_start', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Data Fim</Label>
                        <Input type="date" value={form.period_end} onChange={e => update('period_end', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Meta de Receita (R$)</Label>
                        <Input
                            type="number"
                            placeholder="0,00"
                            value={form.target_revenue}
                            onChange={e => update('target_revenue', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Meta de Negócios</Label>
                        <Input
                            type="number"
                            placeholder="0"
                            value={form.target_deals}
                            onChange={e => update('target_deals', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Meta Novos Clientes</Label>
                        <Input
                            type="number"
                            placeholder="0"
                            value={form.target_new_customers}
                            onChange={e => update('target_new_customers', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Meta de Atividades</Label>
                        <Input
                            type="number"
                            placeholder="0"
                            value={form.target_activities}
                            onChange={e => update('target_activities', e.target.value)}
                        />
                    </div>
                </div>
            </DialogBody>
            <DialogFooter>
                <Button variant="outline" onClick={() => onSuccess()}>
                    Cancelar
                </Button>
                <Button
                    onClick={() => createMut.mutate()}
                    disabled={createMut.isPending || !form.period_start || !form.period_end}
                >
                    {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Criar Meta
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
