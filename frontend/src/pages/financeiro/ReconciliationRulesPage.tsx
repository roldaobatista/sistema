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
    { value: 'match_receivable', label: 'Conciliar com A/R', color: 'text-green-400' },
    { value: 'match_payable', label: 'Conciliar com A/P', color: 'text-blue-400' },
    { value: 'ignore', label: 'Ignorar', color: 'text-yellow-400' },
    { value: 'categorize', label: 'Categorizar', color: 'text-purple-400' },
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

export default function ReconciliationRulesPage() {
  const { hasPermission } = useAuthStore()

    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [testResult, setTestResult] = useState<TestResult | null>(null)
    const [showTestPanel, setShowTestPanel] = useState(false)

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

    function handleDelete(id: number) {
        if (confirm('Tem certeza que deseja excluir esta regra?')) {
            deleteMutation.mutate(id)
        }
    }

    const isSaving = storeMutation.isPending || updateMutation.isPending

    return (
        <div className="space-y-6">
            <PageHeader
                title="Regras de Conciliação Automática"
                description="Configure regras para conciliar e categorizar lançamentos automaticamente"
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Buscar regras..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg
                                   text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none
                                   focus:ring-2 focus:ring-blue-500/50"
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
                <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-zinc-100">
                            {editingId ? 'Editar Regra' : 'Nova Regra'}
                        </h3>
                        <button onClick={resetForm} className="text-zinc-400 hover:text-zinc-200">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Name */}
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-zinc-300 mb-1">
                                Nome da Regra *
                            </label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Ex: PIX Recebidos - Cliente XYZ"
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                           text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">
                                Prioridade (1-100)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={form.priority}
                                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                           text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        {/* Match Field */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">
                                Campo de Matching *
                            </label>
                            <select
                                value={form.match_field}
                                onChange={(e) => setForm({ ...form, match_field: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                           text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                {MATCH_FIELDS.map((f) => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Match Operator */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">
                                Operador *
                            </label>
                            <select
                                value={form.match_operator}
                                onChange={(e) => setForm({ ...form, match_operator: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                           text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                {MATCH_OPERATORS.map((op) => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Match Value */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">
                                Valor/Padrão
                            </label>
                            <input
                                type="text"
                                value={form.match_value}
                                onChange={(e) => setForm({ ...form, match_value: e.target.value })}
                                placeholder={form.match_operator === 'regex' ? '^PIX.*RECEBIDO' : 'texto para buscar'}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                           text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        {/* Amount Range (conditional) */}
                        {(form.match_field === 'amount' || form.match_field === 'combined') && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                                        Valor Mínimo
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.match_amount_min}
                                        onChange={(e) => setForm({ ...form, match_amount_min: e.target.value })}
                                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                                   text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                                        Valor Máximo
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.match_amount_max}
                                        onChange={(e) => setForm({ ...form, match_amount_max: e.target.value })}
                                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                                   text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                            </>
                        )}

                        {/* Action */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">
                                Ação *
                            </label>
                            <select
                                value={form.action}
                                onChange={(e) => setForm({ ...form, action: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                           text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                {ACTIONS.map((a) => (
                                    <option key={a.value} value={a.value}>{a.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">
                                Categoria
                            </label>
                            <input
                                type="text"
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                placeholder="Ex: Receita PIX, Tarifa Bancária"
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg
                                           text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                                <div className="w-9 h-5 bg-zinc-600 peer-checked:bg-green-500 rounded-full
                                                transition-colors after:content-[''] after:absolute after:top-[2px]
                                                after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4
                                                after:transition-all peer-checked:after:translate-x-full" />
                            </label>
                            <span className="text-sm text-zinc-300">
                                {form.is_active ? 'Ativa' : 'Inativa'}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="lg:col-span-3 flex items-center gap-3 pt-4 border-t border-zinc-700">
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
                        <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-600 rounded-lg">
                            <h4 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
                                <Beaker className="h-4 w-4 text-blue-400" />
                                Resultado do Teste
                            </h4>
                            <div className="grid grid-cols-2 gap-4 mb-3">
                                <div className="text-center p-3 bg-zinc-800 rounded-lg">
                                    <p className="text-2xl font-bold text-zinc-100">{testResult.total_tested}</p>
                                    <p className="text-xs text-zinc-400">Testados</p>
                                </div>
                                <div className="text-center p-3 bg-zinc-800 rounded-lg">
                                    <p className={cn(
                                        'text-2xl font-bold',
                                        testResult.total_matched > 0 ? 'text-green-400' : 'text-zinc-400'
                                    )}>
                                        {testResult.total_matched}
                                    </p>
                                    <p className="text-xs text-zinc-400">Correspondem</p>
                                </div>
                            </div>
                            {testResult.sample.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-zinc-400 mb-1">Exemplos de correspondência:</p>
                                    {testResult.sample.map((s) => (
                                        <div key={s.id} className="flex items-center gap-3 text-xs text-zinc-300
                                                                    bg-zinc-800/50 px-3 py-1.5 rounded">
                                            <span className={cn(
                                                'font-mono',
                                                s.type === 'credit' ? 'text-green-400' : 'text-red-400'
                                            )}>
                                                R$ {s.amount.toFixed(2)}
                                            </span>
                                            <span className="truncate flex-1">{s.description}</span>
                                            <span className="text-zinc-500">{s.date}</span>
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
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
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
                <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-700">
                                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">
                                    Status
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">
                                    <span className="flex items-center gap-1">
                                        <ArrowUpDown className="h-3 w-3" /> Pri
                                    </span>
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">
                                    Nome
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">
                                    Matching
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">
                                    Ação
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">
                                    Usos
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-700/50">
                            {rules.map((rule) => {
                                const actionMeta = ACTIONS.find((a) => a.value === rule.action)
                                const fieldMeta = MATCH_FIELDS.find((f) => f.value === rule.match_field)
                                const operatorMeta = MATCH_OPERATORS.find((o) => o.value === rule.match_operator)

                                return (
                                    <tr key={rule.id} className={cn(
                                        'hover:bg-zinc-800/60 transition-colors',
                                        !rule.is_active && 'opacity-50'
                                    )}>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleMutation.mutate(rule.id)}
                                                className={cn(
                                                    'p-1.5 rounded-lg transition-colors',
                                                    rule.is_active
                                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                        : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
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
                                            <span className="text-sm font-mono text-zinc-300">{rule.priority}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-zinc-100">{rule.name}</p>
                                                {rule.category && (
                                                    <span className="inline-flex mt-1 text-xs px-2 py-0.5 bg-purple-500/20
                                                                     text-purple-300 rounded-full">
                                                        {rule.category}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs text-zinc-400 space-y-0.5">
                                                <p>{fieldMeta?.label} {operatorMeta?.label}</p>
                                                {rule.match_value && (
                                                    <p className="text-zinc-300 font-mono truncate max-w-[200px]">
                                                        "{rule.match_value}"
                                                    </p>
                                                )}
                                                {rule.match_amount_min != null && rule.match_amount_max != null && (
                                                    <p className="text-zinc-300 font-mono">
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
                                            <span className="text-sm text-zinc-300">{rule.times_applied}×</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => startEdit(rule)}
                                                    className="p-1.5 text-zinc-400 hover:text-blue-400 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(rule.id)}
                                                    className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
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
        </div>
    )
}
