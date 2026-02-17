import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ArrowUpDown,
    Beaker,
    Check,
    Edit,
    Loader2,
    Plus,
    Power,
    PowerOff,
    Search,
    Trash2,
    X,
    Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { useAuthStore } from '@/stores/auth-store'

interface ReconciliationRule {
    id: number
    name: string
    match_field: string
    match_operator: string
    match_value: string | null
    match_amount_min: number | null
    match_amount_max: number | null
    action: string
    category: string | null
    priority: number
    is_active: boolean
    times_applied: number
    customer?: { id: number; name: string } | null
    supplier?: { id: number; name: string } | null
    created_at: string
}

interface TestResult {
    total_tested: number
    total_matched: number
    sample: Array<{
        id: number
        date: string
        description: string
        amount: number
        type: string
    }>
}

const MATCH_FIELDS = [
    { value: 'description', label: 'Descrição' },
    { value: 'amount', label: 'Valor' },
    { value: 'cnpj', label: 'CNPJ' },
    { value: 'combined', label: 'Combinado (Desc + Valor)' },
]

const MATCH_OPERATORS = [
    { value: 'contains', label: 'Contém' },
    { value: 'equals', label: 'Igual a' },
    { value: 'regex', label: 'Regex' },
    { value: 'between', label: 'Entre (valores)' },
]

const ACTIONS = [
    { value: 'match_receivable', label: 'Conciliar com A/R', color: 'text-green-600 dark:text-green-400' },
    { value: 'match_payable', label: 'Conciliar com A/P', color: 'text-blue-600 dark:text-blue-400' },
    { value: 'ignore', label: 'Ignorar', color: 'text-yellow-600 dark:text-yellow-400' },
    { value: 'categorize', label: 'Categorizar', color: 'text-purple-600 dark:text-purple-400' },
]

const emptyForm = {
    name: '',
    match_field: 'description',
    match_operator: 'contains',
    match_value: '',
    match_amount_min: '',
    match_amount_max: '',
    action: 'categorize',
    category: '',
    priority: '50',
    is_active: true,
}

export function ReconciliationRulesPage() {
    const { hasPermission } = useAuthStore()

    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [testResult, setTestResult] = useState<TestResult | null>(null)
    const [showTestPanel, setShowTestPanel] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<ReconciliationRule | null>(null)

    const { data: rulesData, isLoading } = useQuery({
        queryKey: ['reconciliation-rules', search],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            const res = await api.get(`/reconciliation-rules?${params}`)
            return res.data
        },
    })

    const rules: ReconciliationRule[] = rulesData?.data?.data || rulesData?.data || []

    const storeMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) => api.post('/reconciliation-rules', data),
        onSuccess: () => {
            toast.success(editingId ? 'Regra atualizada' : 'Regra criada')
            queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] })
            resetForm()
        },
        onError: (err: any) => {
            if (err.response?.status === 422) {
                toast.error('Dados inválidos. Verifique os campos.')
            } else {
                toast.error(err.response?.data?.message || 'Erro ao salvar regra')
            }
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
            api.put(`/reconciliation-rules/${id}`, data),
        onSuccess: () => {
            toast.success('Regra atualizada')
            queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] })
            resetForm()
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao atualizar'),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/reconciliation-rules/${id}`),
        onSuccess: () => {
            toast.success('Regra excluída')
            queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] })
            setDeleteTarget(null)
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao excluir'),
    })

    const toggleMutation = useMutation({
        mutationFn: (id: number) => api.post(`/reconciliation-rules/${id}/toggle`),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Status alterado')
            queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao alternar'),
    })

    const testMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) => api.post('/reconciliation-rules/test', data),
        onSuccess: (res) => {
            setTestResult(res.data?.data)
            setShowTestPanel(true)
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao testar regra'),
    })

    function resetForm() {
        setForm(emptyForm)
        setEditingId(null)
        setShowForm(false)
        setTestResult(null)
        setShowTestPanel(false)
    }

    function startEdit(rule: ReconciliationRule) {
        setForm({
            name: rule.name,
            match_field: rule.match_field,
            match_operator: rule.match_operator,
            match_value: rule.match_value || '',
            match_amount_min: rule.match_amount_min?.toString() || '',
            match_amount_max: rule.match_amount_max?.toString() || '',
            action: rule.action,
            category: rule.category || '',
            priority: rule.priority.toString(),
            is_active: rule.is_active,
        })
        setEditingId(rule.id)
        setShowForm(true)
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const payload: Record<string, unknown> = {
            name: form.name,
            match_field: form.match_field,
            match_operator: form.match_operator,
            match_value: form.match_value || null,
            action: form.action,
            category: form.category || null,
            priority: parseInt(form.priority) || 50,
            is_active: form.is_active,
        }
        if (form.match_amount_min) payload.match_amount_min = parseFloat(form.match_amount_min)
        if (form.match_amount_max) payload.match_amount_max = parseFloat(form.match_amount_max)

        if (editingId) {
            updateMutation.mutate({ id: editingId, data: payload })
        } else {
            storeMutation.mutate(payload)
        }
    }

    function handleTestRule() {
        testMutation.mutate({
            match_field: form.match_field,
            match_operator: form.match_operator,
            match_value: form.match_value || null,
            match_amount_min: form.match_amount_min ? parseFloat(form.match_amount_min) : null,
            match_amount_max: form.match_amount_max ? parseFloat(form.match_amount_max) : null,
        })
    }

    const isSaving = storeMutation.isPending || updateMutation.isPending

    const inputClasses = 'w-full px-3 py-2 bg-surface-0 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50'
    const selectClasses = inputClasses
    const labelClasses = 'block text-sm font-medium text-content-primary mb-1'

    return (
        <div className="space-y-6">
            <PageHeader
                title="Regras de Conciliação Automática"
                subtitle="Configure regras para conciliar e categorizar lançamentos automaticamente"
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-secondary" />
                    <Input
                        type="text"
                        placeholder="Buscar regras..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Button
                    onClick={() => { resetForm(); setShowForm(true) }}
                    className="flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Nova Regra
                </Button>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">
                            {editingId ? 'Editar Regra' : 'Nova Regra'}
                        </h3>
                        <button onClick={resetForm} className="text-content-secondary hover:text-content-primary">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Name */}
                        <div className="lg:col-span-2">
                            <label className={labelClasses}>Nome da Regra *</label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Ex: PIX Recebidos - Cliente XYZ"
                                className={inputClasses}
                            />
                        </div>

                        {/* Priority */}
                        <div>
                            <label className={labelClasses}>Prioridade (1-100)</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={form.priority}
                                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                className={inputClasses}
                            />
                        </div>

                        {/* Match Field */}
                        <div>
                            <label className={labelClasses}>Campo de Matching *</label>
                            <select
                                value={form.match_field}
                                onChange={(e) => setForm({ ...form, match_field: e.target.value })}
                                className={selectClasses}
                            >
                                {MATCH_FIELDS.map((f) => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Match Operator */}
                        <div>
                            <label className={labelClasses}>Operador *</label>
                            <select
                                value={form.match_operator}
                                onChange={(e) => setForm({ ...form, match_operator: e.target.value })}
                                className={selectClasses}
                            >
                                {MATCH_OPERATORS.map((op) => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Match Value */}
                        <div>
                            <label className={labelClasses}>Valor/Padrão</label>
                            <input
                                type="text"
                                value={form.match_value}
                                onChange={(e) => setForm({ ...form, match_value: e.target.value })}
                                placeholder={form.match_operator === 'regex' ? '^PIX.*RECEBIDO' : 'texto para buscar'}
                                className={inputClasses}
                            />
                        </div>

                        {/* Amount Range (conditional) */}
                        {(form.match_field === 'amount' || form.match_field === 'combined') && (
                            <>
                                <div>
                                    <label className={labelClasses}>Valor Mínimo</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.match_amount_min}
                                        onChange={(e) => setForm({ ...form, match_amount_min: e.target.value })}
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Valor Máximo</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.match_amount_max}
                                        onChange={(e) => setForm({ ...form, match_amount_max: e.target.value })}
                                        className={inputClasses}
                                    />
                                </div>
                            </>
                        )}

                        {/* Action */}
                        <div>
                            <label className={labelClasses}>Ação *</label>
                            <select
                                value={form.action}
                                onChange={(e) => setForm({ ...form, action: e.target.value })}
                                className={selectClasses}
                            >
                                {ACTIONS.map((a) => (
                                    <option key={a.value} value={a.value}>{a.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Category */}
                        <div>
                            <label className={labelClasses}>Categoria</label>
                            <input
                                type="text"
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                placeholder="Ex: Receita PIX, Tarifa Bancária"
                                className={inputClasses}
                            />
                        </div>

                        {/* Active toggle */}
                        <div className="flex items-center gap-3 pt-6">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-surface-300 peer-checked:bg-green-500 rounded-full
                                                transition-colors after:content-[''] after:absolute after:top-[2px]
                                                after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4
                                                after:transition-all peer-checked:after:translate-x-full" />
                            </label>
                            <span className="text-sm text-content-secondary">
                                {form.is_active ? 'Ativa' : 'Inativa'}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="lg:col-span-3 flex items-center gap-3 pt-4 border-t border-default">
                            <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                                {editingId ? 'Atualizar' : 'Criar'} Regra
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleTestRule}
                                disabled={testMutation.isPending}
                                className="flex items-center gap-2"
                            >
                                {testMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Beaker className="h-4 w-4" />
                                )}
                                Testar Regra
                            </Button>

                            <Button type="button" variant="ghost" onClick={resetForm}>
                                Cancelar
                            </Button>
                        </div>
                    </form>

                    {/* Test Results */}
                    {showTestPanel && testResult && (
                        <div className="mt-4 p-4 bg-surface-50 border border-default rounded-lg">
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Beaker className="h-4 w-4 text-brand-500" />
                                Resultado do Teste
                            </h4>
                            <div className="grid grid-cols-2 gap-4 mb-3">
                                <div className="text-center p-3 bg-surface-0 rounded-lg border border-default">
                                    <p className="text-2xl font-bold">{testResult.total_tested}</p>
                                    <p className="text-xs text-content-secondary">Testados</p>
                                </div>
                                <div className="text-center p-3 bg-surface-0 rounded-lg border border-default">
                                    <p className={cn(
                                        'text-2xl font-bold',
                                        testResult.total_matched > 0 ? 'text-green-600 dark:text-green-400' : 'text-content-secondary'
                                    )}>
                                        {testResult.total_matched}
                                    </p>
                                    <p className="text-xs text-content-secondary">Correspondem</p>
                                </div>
                            </div>
                            {testResult.sample.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-content-secondary mb-1">Exemplos de correspondência:</p>
                                    {testResult.sample.map((s) => (
                                        <div key={s.id} className="flex items-center gap-3 text-xs bg-surface-0
                                                                    px-3 py-1.5 rounded border border-default">
                                            <span className={cn(
                                                'font-mono',
                                                s.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                            )}>
                                                R$ {s.amount.toFixed(2)}
                                            </span>
                                            <span className="truncate flex-1">{s.description}</span>
                                            <span className="text-content-secondary">{s.date}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Rules Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
                </div>
            ) : rules.length === 0 ? (
                <EmptyState
                    icon={Zap}
                    title="Nenhuma regra configurada"
                    description="Crie regras para automatizar a conciliação de lançamentos bancários"
                    action={
                        <Button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Criar Primeira Regra
                        </Button>
                    }
                />
            ) : (
                <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-default">
                                <th className="text-left px-4 py-3 text-xs font-medium text-content-secondary uppercase">
                                    Status
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-content-secondary uppercase">
                                    <span className="flex items-center gap-1">
                                        <ArrowUpDown className="h-3 w-3" /> Pri
                                    </span>
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-content-secondary uppercase">
                                    Nome
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-content-secondary uppercase">
                                    Matching
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-content-secondary uppercase">
                                    Ação
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-content-secondary uppercase">
                                    Usos
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-content-secondary uppercase">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-default">
                            {rules.map((rule) => {
                                const actionMeta = ACTIONS.find((a) => a.value === rule.action)
                                const fieldMeta = MATCH_FIELDS.find((f) => f.value === rule.match_field)
                                const operatorMeta = MATCH_OPERATORS.find((o) => o.value === rule.match_operator)

                                return (
                                    <tr key={rule.id} className={cn(
                                        'hover:bg-surface-50 transition-colors',
                                        !rule.is_active && 'opacity-50'
                                    )}>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleMutation.mutate(rule.id)}
                                                className={cn(
                                                    'p-1.5 rounded-lg transition-colors',
                                                    rule.is_active
                                                        ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/30'
                                                        : 'bg-surface-100 text-content-secondary hover:bg-surface-200'
                                                )}
                                                title={rule.is_active ? 'Desativar' : 'Ativar'}
                                            >
                                                {rule.is_active ? (
                                                    <Power className="h-4 w-4" />
                                                ) : (
                                                    <PowerOff className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-mono">{rule.priority}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium">{rule.name}</p>
                                                {rule.category && (
                                                    <span className="inline-flex mt-1 text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20
                                                                     text-purple-700 dark:text-purple-300 rounded-full">
                                                        {rule.category}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs text-content-secondary space-y-0.5">
                                                <p>{fieldMeta?.label} {operatorMeta?.label}</p>
                                                {rule.match_value && (
                                                    <p className="font-mono truncate max-w-[200px]">
                                                        &ldquo;{rule.match_value}&rdquo;
                                                    </p>
                                                )}
                                                {rule.match_amount_min != null && rule.match_amount_max != null && (
                                                    <p className="font-mono">
                                                        R$ {rule.match_amount_min} ~ R$ {rule.match_amount_max}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('text-sm font-medium', actionMeta?.color)}>
                                                {actionMeta?.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm">{rule.times_applied}×</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => startEdit(rule)}
                                                    className="p-1.5 text-content-secondary hover:text-brand-500 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(rule)}
                                                    className="p-1.5 text-content-secondary hover:text-red-500 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir Regra" size="sm">
                <p className="text-sm text-content-secondary">
                    Tem certeza que deseja excluir a regra <strong>{deleteTarget?.name}</strong>?
                    Esta ação não pode ser desfeita.
                </p>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                    <Button
                        className="bg-red-600 hover:bg-red-700 text-white"
                        loading={deleteMutation.isPending}
                        onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                    >
                        Excluir
                    </Button>
                </div>
            </Modal>
        </div>
    )
}

export default ReconciliationRulesPage
