import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Tag, Trash2, Edit, Palette } from 'lucide-react'
import api from '@/lib/api'

interface Category {
    id: number
    name: string
    color: string | null
    description: string | null
    is_active: boolean
}

const presetColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
]

export function AccountPayableCategoriesPage() {
    const qc = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)
    const [name, setName] = useState('')
    const [color, setColor] = useState('#3b82f6')
    const [description, setDescription] = useState('')

    const { data: res, isLoading } = useQuery({
        queryKey: ['ap-categories'],
        queryFn: () => api.get('/account-payable-categories'),
    })
    const categories: Category[] = res?.data ?? []

    const saveMut = useMutation({
        mutationFn: (payload: any) =>
            editing
                ? api.put(`/account-payable-categories/${editing.id}`, payload)
                : api.post('/account-payable-categories', payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['ap-categories'] })
            resetForm()
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/account-payable-categories/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ap-categories'] }),
    })

    const resetForm = () => {
        setShowForm(false)
        setEditing(null)
        setName('')
        setColor('#3b82f6')
        setDescription('')
    }

    const openEdit = (c: Category) => {
        setEditing(c)
        setName(c.name)
        setColor(c.color ?? '#3b82f6')
        setDescription(c.description ?? '')
        setShowForm(true)
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Categorias de Contas a Pagar</h1>
                <button
                    onClick={() => { resetForm(); setShowForm(true) }}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                >
                    <Plus className="h-4 w-4" /> Nova Categoria
                </button>
            </div>

            {showForm && (
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card space-y-4">
                    <h2 className="font-semibold text-surface-900">{editing ? 'Editar' : 'Nova'} Categoria</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[13px] font-medium text-surface-700 mb-1">Nome</label>
                            <input value={name} onChange={e => setName(e.target.value)}
                                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                        </div>
                        <div>
                            <label className="block text-[13px] font-medium text-surface-700 mb-1">Descrição</label>
                            <input value={description} onChange={e => setDescription(e.target.value)}
                                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[13px] font-medium text-surface-700 mb-2">Cor</label>
                        <div className="flex gap-2">
                            {presetColors.map(c => (
                                <button key={c} onClick={() => setColor(c)}
                                    className={`h-8 w-8 rounded-full border-2 transition-transform ${color === c ? 'border-surface-900 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button onClick={resetForm} className="px-4 py-2 text-[13px] text-surface-600 hover:text-surface-800">Cancelar</button>
                        <button onClick={() => saveMut.mutate({ name, color, description: description || null })}
                            disabled={!name.trim() || saveMut.isPending}
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                            {saveMut.isPending ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="text-center text-surface-400 py-12">Carregando...</div>
            ) : categories.length === 0 ? (
                <div className="text-center text-surface-400 py-12">Nenhuma categoria cadastrada.</div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {categories.map(c => (
                        <div key={c.id} className="rounded-xl border border-default bg-surface-0 shadow-card p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: c.color ? `${c.color}20` : '#f1f5f9' }}>
                                <Tag className="h-5 w-5" style={{ color: c.color ?? '#64748b' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-surface-900">{c.name}</p>
                                {c.description && <p className="text-xs text-surface-500 truncate">{c.description}</p>}
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-surface-100 text-surface-400 hover:text-brand-600">
                                    <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => { if (confirm('Excluir categoria?')) deleteMut.mutate(c.id) }}
                                    className="p-1.5 rounded hover:bg-surface-100 text-surface-400 hover:text-red-500">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
