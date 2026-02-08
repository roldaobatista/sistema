import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, Briefcase, Clock } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface Service {
    id: number; code: string | null; name: string; description: string | null
    default_price: string; estimated_minutes: number | null; is_active: boolean
    category: { id: number; name: string } | null
}

const emptyForm = {
    category_id: '' as string | number, code: '', name: '', description: '',
    default_price: '0', estimated_minutes: '' as string | number, is_active: true,
}

export function ServicesPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Service | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [newCat, setNewCat] = useState('')

    const { data: res, isLoading } = useQuery({
        queryKey: ['services', search],
        queryFn: () => api.get('/services', { params: { search, per_page: 50 } }),
    })
    const services: Service[] = res?.data?.data ?? []

    const { data: catsRes } = useQuery({
        queryKey: ['service-categories'],
        queryFn: () => api.get('/service-categories'),
    })
    const categories = catsRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing ? api.put(`/services/${editing.id}`, data) : api.post('/services', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setShowForm(false) },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/services/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
    })

    const catMut = useMutation({
        mutationFn: (name: string) => api.post('/service-categories', { name }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-categories'] }); setNewCat('') },
    })

    const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
    const openEdit = (s: Service) => {
        setEditing(s)
        setForm({
            category_id: s.category?.id ?? '', code: s.code ?? '', name: s.name,
            description: s.description ?? '', default_price: s.default_price,
            estimated_minutes: s.estimated_minutes ?? '', is_active: s.is_active,
        })
        setShowForm(true)
    }

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    const formatBRL = (v: string) => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const formatTime = (m: number | null) => {
        if (!m) return '—'
        const h = Math.floor(m / 60)
        const min = m % 60
        return h > 0 ? `${h}h${min > 0 ? min.toString().padStart(2, '0') : ''}` : `${min}min`
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Serviços</h1>
                    <p className="mt-1 text-sm text-surface-500">Catálogo de serviços prestados</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Novo Serviço</Button>
            </div>

            <div className="max-w-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        placeholder="Buscar por nome ou código..."
                        className="w-full rounded-lg border border-surface-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Serviço</th>
                            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 md:table-cell">Categoria</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-600">Preço</th>
                            <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-600 lg:table-cell">Tempo</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {isLoading ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : services.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum serviço encontrado</td></tr>
                        ) : services.map(s => (
                            <tr key={s.id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                                            <Briefcase className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-surface-900">{s.name}</p>
                                            {s.code && <p className="text-xs text-surface-400">#{s.code}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="hidden px-4 py-3 md:table-cell">
                                    {s.category ? <Badge variant="success">{s.category.name}</Badge> : <span className="text-xs text-surface-400">—</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-medium text-surface-900">{formatBRL(s.default_price)}</td>
                                <td className="hidden px-4 py-3 text-right lg:table-cell">
                                    <span className="flex items-center justify-end gap-1 text-sm text-surface-600">
                                        <Clock className="h-3.5 w-3.5" /> {formatTime(s.estimated_minutes)}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir?')) delMut.mutate(s.id) }}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Form */}
            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Serviço' : 'Novo Serviço'} size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Nome" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} required />
                        <Input label="Código" value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('code', e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Categoria</label>
                            <select value={form.category_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('category_id', e.target.value)}
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">Sem categoria</option>
                                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <div className="mt-1.5 flex gap-1">
                                <input value={newCat} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCat(e.target.value)} placeholder="Nova categoria"
                                    className="flex-1 rounded-md border border-surface-200 px-2 py-1 text-xs" />
                                <Button variant="ghost" size="sm" type="button" disabled={!newCat}
                                    onClick={() => catMut.mutate(newCat)}>+</Button>
                            </div>
                        </div>
                        <Input label="Preço Padrão (R$)" type="number" step="0.01" value={form.default_price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('default_price', e.target.value)} />
                        <Input label="Tempo Estimado (min)" type="number" value={form.estimated_minutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('estimated_minutes', e.target.value)} placeholder="Ex: 60" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Descrição</label>
                        <textarea value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-surface-200 pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
