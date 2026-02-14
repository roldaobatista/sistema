import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardList, Trash2, Edit, CheckSquare, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

const itemTypes = [
    { value: 'check', label: 'Checkbox' },
    { value: 'text', label: 'Texto' },
    { value: 'number', label: 'Número' },
    { value: 'photo', label: 'Foto' },
    { value: 'yes_no', label: 'Sim/Não' },
]

interface ChecklistItem {
    id?: number
    description: string
    type: string
    is_required: boolean
    order_index: number
}

interface Checklist {
    id: number
    name: string
    description: string | null
    is_active: boolean
    items: ChecklistItem[]
}

export function ServiceChecklistsPage() {
  const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const [editing, setEditing] = useState<Checklist | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [formName, setFormName] = useState('')
    const [formDesc, setFormDesc] = useState('')
    const [formItems, setFormItems] = useState<ChecklistItem[]>([])

    const { data: res, isLoading } = useQuery({
        queryKey: ['service-checklists'],
        queryFn: () => api.get('/service-checklists'),
    })
    const checklists: Checklist[] = res?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (payload: any) =>
            editing
                ? api.put(`/service-checklists/${editing.id}`, payload)
                : api.post('/service-checklists', payload),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['service-checklists'] })
            resetForm()
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/service-checklists/${id}`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['service-checklists'] })
        },
    })

    const resetForm = () => {
        setShowForm(false)
        setEditing(null)
        setFormName('')
        setFormDesc('')
        setFormItems([])
    }

    const openEdit = (c: Checklist) => {
        setEditing(c)
        setFormName(c.name)
        setFormDesc(c.description ?? '')
        setFormItems(c.items.map((it, i) => ({ ...it, order_index: i })))
        setShowForm(true)
    }

    const openNew = () => {
        resetForm()
        setShowForm(true)
    }

    const addItem = () => setFormItems([...formItems, { description: '', type: 'check', is_required: true, order_index: formItems.length }])

    const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx))

    const updateItem = (idx: number, key: string, val: any) => {
        const copy = [...formItems]
            ; (copy[idx] as any)[key] = val
        setFormItems(copy)
    }

    const handleSave = () => {
        if (!formName.trim()) return
        saveMut.mutate({
            name: formName,
            description: formDesc || null,
            is_active: true,
            items: formItems.map((it, i) => ({ ...it, order_index: i })),
        })
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Checklists de Serviço</h1>
                <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
                    <Plus className="h-4 w-4" /> Novo Checklist
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card space-y-4">
                    <h2 className="font-semibold text-surface-900">{editing ? 'Editar' : 'Novo'} Checklist</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[13px] font-medium text-surface-700 mb-1">Nome</label>
                            <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                        </div>
                        <div>
                            <label className="block text-[13px] font-medium text-surface-700 mb-1">Descrição</label>
                            <input value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-surface-700">Itens</h3>
                            <button onClick={addItem} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Adicionar Item</button>
                        </div>
                        {formItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg">
                                <GripVertical className="h-4 w-4 text-surface-400 flex-shrink-0" />
                                <input
                                    value={item.description}
                                    onChange={e => updateItem(idx, 'description', e.target.value)}
                                    placeholder="Descrição do item..."
                                    className="flex-1 rounded border border-surface-300 px-2 py-1.5 text-sm"
                                />
                                <select
                                    value={item.type}
                                    onChange={e => updateItem(idx, 'type', e.target.value)}
                                    className="rounded border border-surface-300 px-2 py-1.5 text-sm"
                                >
                                    {itemTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <label className="flex items-center gap-1 text-xs text-surface-600 whitespace-nowrap">
                                    <input type="checkbox" checked={item.is_required} onChange={e => updateItem(idx, 'is_required', e.target.checked)} />
                                    Obrig.
                                </label>
                                <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        ))}
                        {formItems.length === 0 && <p className="text-sm text-surface-400">Nenhum item adicionado.</p>}
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button onClick={resetForm} className="px-4 py-2 text-[13px] text-surface-600 hover:text-surface-800">Cancelar</button>
                        <button onClick={handleSave} disabled={saveMut.isPending} className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                            {saveMut.isPending ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {isLoading ? (
                <div className="text-center text-surface-400 py-12">Carregando...</div>
            ) : checklists.length === 0 ? (
                <div className="text-center text-surface-400 py-12">Nenhum checklist cadastrado.</div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {checklists.map(c => (
                        <div key={c.id} className="rounded-xl border border-default bg-surface-0 shadow-card p-5 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-brand-600" />
                                    <h3 className="font-semibold text-surface-900">{c.name}</h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    {c.is_active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5 text-surface-300" />}
                                </div>
                            </div>
                            {c.description && <p className="text-[13px] text-surface-500">{c.description}</p>}

                            <div className="space-y-1">
                                {c.items.slice(0, 4).map((it, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[13px] text-surface-600">
                                        <CheckSquare className="h-3.5 w-3.5 text-surface-400" />
                                        <span>{it.description}</span>
                                        <span className="ml-auto text-xs text-surface-400">{itemTypes.find(t => t.value === it.type)?.label}</span>
                                    </div>
                                ))}
                                {c.items.length > 4 && <p className="text-xs text-surface-400">+{c.items.length - 4} itens</p>}
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-surface-100">
                                <button onClick={() => openEdit(c)} className="flex-1 text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center justify-center gap-1">
                                    <Edit className="h-3.5 w-3.5" /> Editar
                                </button>
                                <button onClick={() => { if (window.confirm('Deseja realmente excluir este registro?')) deleteMut.mutate(c.id) }} className="flex-1 text-sm text-red-500 hover:text-red-700 font-medium flex items-center justify-center gap-1">
                                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
