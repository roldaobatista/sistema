import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi, type CrmLeadScoringRule, type CrmLeadScore } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogBody, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { TableSkeleton } from '@/components/ui/tableskeleton'
import { toast } from 'sonner'
import {
    Target, Plus, Trash2, Pencil, Calculator, Trophy,
    Search, Flame, Thermometer, Snowflake, CloudSnow,
} from 'lucide-react'

const GRADE_CONFIG: Record<string, { label: string; icon: typeof Flame; variant: 'danger' | 'warning' | 'info' | 'default'; color: string }> = {
    A: { label: 'Hot', icon: Flame, variant: 'danger', color: 'text-red-600' },
    B: { label: 'Warm', icon: Thermometer, variant: 'warning', color: 'text-orange-600' },
    C: { label: 'Cold', icon: Snowflake, variant: 'info', color: 'text-sky-600' },
    D: { label: 'Ice', icon: CloudSnow, variant: 'default', color: 'text-surface-500' },
}

const OPERATORS = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains']
const OPERATOR_LABELS: Record<string, string> = {
    equals: 'Igual a',
    not_equals: 'Diferente de',
    greater_than: 'Maior que',
    less_than: 'Menor que',
    contains: 'Contém',
    not_contains: 'Não contém',
}

const EMPTY_RULE: Partial<CrmLeadScoringRule> = {
    name: '', field: '', operator: 'equals', value: '', points: 10, category: 'demographic', is_active: true,
}

export function CrmScoringPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<Partial<CrmLeadScoringRule>>(EMPTY_RULE)
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    const { data: rules = [], isLoading: loadingRules, isError: errorRules, refetch: refetchRules } = useQuery({
        queryKey: ['scoring-rules'],
        queryFn: async () => (await crmFeaturesApi.getScoringRules()).data,
    })

    const { data: leaderboardData, isLoading: loadingLeaderboard, isError: errorLeaderboard, refetch: refetchLeaderboard } = useQuery({
        queryKey: ['scoring-leaderboard'],
        queryFn: async () => (await crmFeaturesApi.getLeaderboard()).data,
    })
    const leaderboard: CrmLeadScore[] = Array.isArray(leaderboardData)
        ? leaderboardData
        : (leaderboardData as { data?: CrmLeadScore[] })?.data ?? []

    const saveMutation = useMutation({
        mutationFn: (data: Partial<CrmLeadScoringRule>) =>
            data.id
                ? crmFeaturesApi.updateScoringRule(data.id, data)
                : crmFeaturesApi.createScoringRule(data),
        onSuccess: () => {
            toast.success(editingRule.id ? 'Regra atualizada com sucesso' : 'Regra criada com sucesso')
            qc.invalidateQueries({ queryKey: ['scoring-rules'] })
            closeRuleDialog()
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao salvar regra')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => crmFeaturesApi.deleteScoringRule(id),
        onSuccess: () => {
            toast.success('Regra excluída com sucesso')
            qc.invalidateQueries({ queryKey: ['scoring-rules'] })
            setDeleteTarget(null)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao excluir regra')
            setDeleteTarget(null)
        },
    })

    const calculateMutation = useMutation({
        mutationFn: () => crmFeaturesApi.calculateScores(),
        onSuccess: () => {
            toast.success('Scores recalculados com sucesso')
            qc.invalidateQueries({ queryKey: ['scoring-leaderboard'] })
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao calcular scores')
        },
    })

    function closeRuleDialog() {
        setRuleDialogOpen(false)
        setEditingRule(EMPTY_RULE)
    }

    function openEditRule(rule: CrmLeadScoringRule) {
        setEditingRule({ ...rule })
        setRuleDialogOpen(true)
    }

    function handleSaveRule() {
        if (!editingRule.name?.trim() || !editingRule.field?.trim()) {
            toast.error('Preencha nome e campo da regra')
            return
        }
        saveMutation.mutate(editingRule)
    }

    const filteredLeaderboard = leaderboard.filter(s =>
        !search || s.customer?.name?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <PageHeader
                title="Lead Scoring"
                subtitle="Regras de pontuação e ranking de clientes"
                icon={Target}
                actions={[
                    {
                        label: 'Calcular Scores',
                        onClick: () => calculateMutation.mutate(),
                        icon: <Calculator className="h-4 w-4" />,
                        variant: 'outline' as const,
                        disabled: calculateMutation.isPending,
                    },
                    {
                        label: 'Nova Regra',
                        onClick: () => { setEditingRule(EMPTY_RULE); setRuleDialogOpen(true) },
                        icon: <Plus className="h-4 w-4" />,
                    },
                ]}
            />

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Regras */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4 text-brand-600" />
                            Regras de Pontuação
                            <Badge variant="default" size="xs">{rules.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingRules && <TableSkeleton rows={4} cols={3} />}
                        {errorRules && (
                            <EmptyState
                                title="Erro ao carregar regras"
                                message="Não foi possível carregar as regras. Tente novamente."
                                action={{ label: 'Tentar novamente', onClick: () => refetchRules() }}
                            />
                        )}
                        {!loadingRules && !errorRules && rules.length === 0 && (
                            <EmptyState
                                title="Nenhuma regra cadastrada"
                                message="Crie sua primeira regra de pontuação para classificar leads."
                                action={{ label: 'Nova Regra', onClick: () => { setEditingRule(EMPTY_RULE); setRuleDialogOpen(true) } }}
                            />
                        )}
                        {!loadingRules && !errorRules && rules.length > 0 && (
                            <div className="space-y-2">
                                {rules.map(rule => (
                                    <div
                                        key={rule.id}
                                        className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2.5 hover:bg-surface-50 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-surface-900 truncate">{rule.name}</span>
                                                <Badge variant={rule.is_active ? 'success' : 'default'} size="xs">
                                                    {rule.is_active ? 'Ativa' : 'Inativa'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-surface-500 mt-0.5">
                                                {rule.field} {OPERATOR_LABELS[rule.operator] ?? rule.operator} "{rule.value}" → <span className="font-semibold text-brand-600">+{rule.points} pts</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 ml-2 shrink-0">
                                            <Button variant="ghost" size="sm" onClick={() => openEditRule(rule)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(rule.id)}>
                                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Leaderboard */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-amber-500" />
                                Ranking de Leads
                                <Badge variant="default" size="xs">{leaderboard.length}</Badge>
                            </CardTitle>
                        </div>
                        <div className="relative mt-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                            <Input
                                placeholder="Buscar cliente..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 h-8 text-sm"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingLeaderboard && <TableSkeleton rows={6} cols={3} />}
                        {errorLeaderboard && (
                            <EmptyState
                                title="Erro ao carregar ranking"
                                message="Não foi possível carregar o ranking. Tente novamente."
                                action={{ label: 'Tentar novamente', onClick: () => refetchLeaderboard() }}
                            />
                        )}
                        {!loadingLeaderboard && !errorLeaderboard && filteredLeaderboard.length === 0 && (
                            <EmptyState
                                title="Nenhum lead pontuado"
                                message={search ? 'Nenhum resultado para sua busca.' : 'Calcule os scores para gerar o ranking.'}
                            />
                        )}
                        {!loadingLeaderboard && !errorLeaderboard && filteredLeaderboard.length > 0 && (
                            <div className="space-y-1.5">
                                {filteredLeaderboard.map((score, idx) => {
                                    const grade = GRADE_CONFIG[score.grade] ?? GRADE_CONFIG.D
                                    const GradeIcon = grade.icon
                                    return (
                                        <div
                                            key={score.id}
                                            className="flex items-center gap-3 rounded-lg border border-subtle px-3 py-2.5 hover:bg-surface-50 transition-colors"
                                        >
                                            <span className="text-xs font-bold text-surface-400 w-6 text-right tabular-nums">
                                                #{idx + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-sm font-medium text-surface-900 truncate block">
                                                    {score.customer?.name ?? `Cliente #${score.customer_id}`}
                                                </span>
                                                {score.customer?.email && (
                                                    <span className="text-xs text-surface-500">{score.customer.email}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-sm font-bold tabular-nums text-surface-900">
                                                    {score.total_score} pts
                                                </span>
                                                <Badge variant={grade.variant} size="sm" dot>
                                                    <GradeIcon className={`h-3 w-3 ${grade.color}`} />
                                                    {score.grade} - {grade.label}
                                                </Badge>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Dialog: Criar/Editar Regra */}
            <Dialog open={ruleDialogOpen} onOpenChange={open => { if (!open) closeRuleDialog() }}>
                <DialogContent size="md">
                    <DialogHeader>
                        <DialogTitle>{editingRule.id ? 'Editar Regra' : 'Nova Regra de Pontuação'}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                        <Input
                            label="Nome da Regra *"
                            placeholder="Ex: Cliente com e-mail corporativo"
                            value={editingRule.name ?? ''}
                            onChange={e => setEditingRule(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Campo *"
                                placeholder="Ex: segment, email, city"
                                value={editingRule.field ?? ''}
                                onChange={e => setEditingRule(prev => ({ ...prev, field: e.target.value }))}
                            />
                            <div className="space-y-1.5">
                                <label className="block text-[13px] font-medium text-surface-700">Operador</label>
                                <Select
                                    value={editingRule.operator ?? 'equals'}
                                    onValueChange={val => setEditingRule(prev => ({ ...prev, operator: val }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {OPERATORS.map(op => (
                                            <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Valor *"
                                placeholder="Ex: premium, SP"
                                value={editingRule.value ?? ''}
                                onChange={e => setEditingRule(prev => ({ ...prev, value: e.target.value }))}
                            />
                            <Input
                                label="Pontos *"
                                type="number"
                                value={editingRule.points ?? 10}
                                onChange={e => setEditingRule(prev => ({ ...prev, points: Number(e.target.value) }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[13px] font-medium text-surface-700">Categoria</label>
                            <Select
                                value={editingRule.category ?? 'demographic'}
                                onValueChange={val => setEditingRule(prev => ({ ...prev, category: val }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="demographic">Demográfica</SelectItem>
                                    <SelectItem value="behavioral">Comportamental</SelectItem>
                                    <SelectItem value="engagement">Engajamento</SelectItem>
                                    <SelectItem value="firmographic">Firmográfica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeRuleDialog}>Cancelar</Button>
                        <Button onClick={handleSaveRule} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Confirmar Exclusão */}
            <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Excluir Regra</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <p className="text-sm text-surface-600">
                            Tem certeza que deseja excluir esta regra? Esta ação não pode ser desfeita.
                        </p>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
