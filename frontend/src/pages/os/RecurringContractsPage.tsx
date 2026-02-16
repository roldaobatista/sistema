import React, { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    RefreshCw, Plus, Pencil, Trash2, Play, Calendar, Search,
    ChevronDown, ChevronUp, Package, Wrench
} from 'lucide-react'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'

interface ContractItem {
    id?: number
    type: string
    description: string
    quantity: number
    unit_price: number
}

interface Contract {
    id: number
    name: string
    description: string | null
    frequency: string
    start_date: string
    end_date: string | null
    next_run_date: string
    priority: string
    is_active: boolean
    generated_count: number
    customer: { id: number; name: string } | null
    equipment: { id: number; type: string; brand: string; model: string } | null
    assignee: { id: number; name: string } | null
    items: ContractItem[]
}

const freqLabels: Record<string, string> = {
    weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal',
    bimonthly: 'Bimestral', quarterly: 'Trimestral',
    semiannual: 'Semestral', annual: 'Anual',
}

const priorityVariant: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
    low: 'default', normal: 'info', high: 'warning', urgent: 'danger',
}

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const emptyForm = {
    name: '', description: '', customer_id: '', equipment_id: '',
    assigned_to: '', frequency: 'monthly', start_date: '', end_date: '',
    priority: 'normal',
    items: [] as ContractItem[],
}

export function RecurringContractsPage() {
  const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Contract | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [expanded, setExpanded] = useState<number | null>(null)

    const { data: res, isLoading, isError } = useQuery({
        queryKey: ['recurring-contracts', search],
        queryFn: () => api.get('/recurring-contracts', { params: { search } }).then((r: any) => r.data),
    })

    const contracts: Contract[] = res?.data ?? res ?? []

    const { data: customers } = useQuery({
        queryKey: ['customers-list'],
        queryFn: () => api.get('/customers', { params: { per_page: 200 } }).then((r: any) => r.data.data ?? r.data),
    })

    const save = useMutation({
        mutationFn: (data: typeof form) =>
            editing
                ? api.put(`/recurring-contracts/${editing.id}`, data)
                : api.post('/recurring-contracts', data),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['recurring-contracts'] })
            closeForm()
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar contrato'),
    })

    const remove = useMutation({
        mutationFn: (id: number) => api.delete(`/recurring-contracts/${id}`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['recurring-contracts'] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao excluir contrato'),
    })

    const generate = useMutation({
        mutationFn: (id: number) => api.post(`/recurring-contracts/${id}/generate`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['recurring-contracts'] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao gerar OS'),
    })

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
            setForm(prev => ({ ...prev, [k]: v }))

    function openEdit(c: Contract) {
        setEditing(c)
        setForm({
            name: c.name, description: c.description ?? '',
            customer_id: String(c.customer?.id ?? ''),
            equipment_id: String(c.equipment?.id ?? ''),
            assigned_to: String(c.assignee?.id ?? ''),
            frequency: c.frequency, start_date: c.start_date?.slice(0, 10) ?? '',
            end_date: c.end_date?.slice(0, 10) ?? '', priority: c.priority,
            items: c.items?.map(i => ({ ...i })) ?? [],
        })
        setShowForm(true)
    }

    function closeForm() {
        setShowForm(false); setEditing(null); setForm(emptyForm)
    }

    function addItem() {
        set('items', [...form.items, { type: 'service', description: '', quantity: 1, unit_price: 0 }])
    }

    function updateItem(idx: number, field: string, val: string | number) {
        const items = [...form.items]
        items[idx] = { ...items[idx], [field]: val }
        set('items', items)
    }

    function removeItem(idx: number) {
        set('items', form.items.filter((_, i) => i !== idx))
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Contratos Recorrentes</h1>
                    <p className="text-sm text-zinc-400 mt-1">Manutenções preventivas e contratos periódicos</p>
                </div>
                <Button onClick={() => { closeForm(); setShowForm(true) }}>
                    <Plus className="h-4 w-4 mr-2" /> Novo Contrato
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                    className="pl-10"
                    placeholder="Buscar contratos..."
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                />
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-zinc-100">
                        {editing ? 'Editar Contrato' : 'Novo Contrato'}
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Input label="Nome" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} required />
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-300">Cliente</label>
                            <select className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
                                value={form.customer_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('customer_id', e.target.value)}>
                                <option value="">Selecione</option>
                                {(customers ?? []).map((c: { id: number; name: string }) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-300">Frequência</label>
                            <select className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
                                value={form.frequency} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('frequency', e.target.value)}>
                                {Object.entries(freqLabels).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <Input label="Data Início" type="date" value={form.start_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('start_date', e.target.value)} required />
                        <Input label="Data Fim (opcional)" type="date" value={form.end_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('end_date', e.target.value)} />
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-300">Prioridade</label>
                            <select className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
                                value={form.priority} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('priority', e.target.value)}>
                                <option value="low">Baixa</option>
                                <option value="normal">Normal</option>
                                <option value="high">Alta</option>
                                <option value="urgent">Urgente</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-300">Descrição</label>
                        <textarea className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 min-h-[80px]"
                            value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)} />
                    </div>

                    {/* Items template */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-zinc-300">Itens Template</label>
                            <Button size="sm" variant="secondary" onClick={addItem}>
                                <Plus className="h-3 w-3 mr-1" /> Item
                            </Button>
                        </div>
                        {form.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <select className="rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100 w-28"
                                    value={item.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(idx, 'type', e.target.value)}>
                                    <option value="product">Produto</option>
                                    <option value="service">Serviço</option>
                                </select>
                                <input className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100"
                                    placeholder="Descrição" value={item.description}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'description', e.target.value)} />
                                <input className="w-20 rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100"
                                    type="number" placeholder="Qtd" value={item.quantity}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'quantity', Number(e.target.value))} />
                                <input className="w-28 rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100"
                                    type="number" step="0.01" placeholder="Vlr Unit" value={item.unit_price}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'unit_price', Number(e.target.value))} />
                                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 p-1">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
                            {save.isPending ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
                        </Button>
                        <Button variant="secondary" onClick={closeForm}>Cancelar</Button>
                    </div>
                </div>
            )}

            {/* Table */}
            {isLoading ? (
                <div className="text-center py-12 text-zinc-400">Carregando...</div>
            ) : isError ? (
                <div className="text-center py-12 text-red-400">Erro ao carregar contratos. Tente novamente.</div>
            ) : contracts.length === 0 ? (
                <div className="text-center py-12">
                    <RefreshCw className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400">Nenhum contrato recorrente</p>
                </div>
            ) : (
                <div className="border border-zinc-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-800/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Contrato</th>
                                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Frequência</th>
                                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Próxima OS</th>
                                <th className="text-center px-4 py-3 text-zinc-400 font-medium">Geradas</th>
                                <th className="text-center px-4 py-3 text-zinc-400 font-medium">Status</th>
                                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-700/50">
                            {contracts.map((c: Contract) => (
                                <React.Fragment key={c.id}>
                                    <tr className="hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                                                className="flex items-center gap-2 text-zinc-100 hover:text-blue-400 font-medium">
                                                {expanded === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                {c.name}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-300">{c.customer?.name ?? 'â€”'}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant="info">{freqLabels[c.frequency] ?? c.frequency}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-300">
                                            <Calendar className="h-3.5 w-3.5 inline mr-1" />
                                            {fmtDate(c.next_run_date)}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-center text-zinc-300">{c.generated_count}</td>
                                        <td className="px-3.5 py-2.5 text-center">
                                            <Badge variant={c.is_active ? 'success' : 'default'}>
                                                {c.is_active ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <button title="Gerar OS agora"
                                                    onClick={() => { if (confirm('Gerar OS manualmente?')) generate.mutate(c.id) }}
                                                    className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400">
                                                    <Play className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => openEdit(c)}
                                                    className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => { if (confirm('Excluir contrato?')) remove.mutate(c.id) }}
                                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expanded === c.id && c.items?.length > 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-8 py-3 bg-zinc-800/30">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-zinc-400 mb-2">Itens Template:</p>
                                                    {c.items.map((item, i) => (
                                                        <div key={i} className="flex items-center gap-3 text-sm">
                                                            {item.type === 'product' ? <Package className="h-3.5 w-3.5 text-amber-400" /> : <Wrench className="h-3.5 w-3.5 text-blue-400" />}
                                                            <span className="text-zinc-300 flex-1">{item.description}</span>
                                                            <span className="text-zinc-400">{item.quantity}x</span>
                                                            <span className="text-zinc-300 font-mono">{fmtBRL(Number(item.unit_price))}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
