import React, { useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, Briefcase, Clock, AlertTriangle, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuvoExport } from '@/hooks/useAuvoExport'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { useAuthStore } from '@/stores/auth-store'

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
  const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const { exportService } = useAuvoExport()
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 400)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Service | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [newCat, setNewCat] = useState('')

    // Delete handling state
    const [showConfirmDelete, setShowConfirmDelete] = useState<Service | null>(null)
    const [deleteDependencies, setDeleteDependencies] = useState<any>(null)
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null)

    const { data: res, isLoading } = useQuery({
        queryKey: ['services', debouncedSearch],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/services', { params: { search: debouncedSearch, per_page: 50 } }),
    })
    const services: Service[] = res?.data?.data ?? []

    const { data: catsRes } = useQuery({
        queryKey: ['service-categories'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/service-categories'),
    })
    const categories = catsRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing ? api.put(`/services/${editing.id}`, data) : api.post('/services', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['services'] })
            setShowForm(false)
            toast.success(editing ? 'Serviço atualizado com sucesso!' : 'Serviço criado com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao salvar serviço.')
        }
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/services/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['services'] })
            setShowConfirmDelete(null)
            toast.success('Serviço excluído com sucesso!')
        },
        onError: (err: any) => {
            if (err.response?.status === 409 || err.response?.status === 422) {
                setDeleteDependencies(err.response.data.dependencies)
                setDeleteMessage(err.response.data.message)
            } else {
                toast.error(err.response?.data?.message ?? 'Erro ao excluir serviço.')
                setShowConfirmDelete(null)
            }
        },
    })

    const catMut = useMutation({
        mutationFn: (name: string) => api.post('/service-categories', { name }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-categories'] })
            setNewCat('')
            toast.success('Categoria criada!')
        },
        onError: () => toast.error('Erro ao criar categoria.')
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
        if (!m) return 'â€”'
        const h = Math.floor(m / 60)
        const min = m % 60
        return h > 0 ? `${h}h${min > 0 ? min.toString().padStart(2, '0') : ''}` : `${min}min`
    }

    if (isLoading) return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <div className="skeleton h-7 w-32" />
                    <div className="skeleton mt-2 h-4 w-48" />
                </div>
                <div className="skeleton h-9 w-28" />
            </div>
            <div className="skeleton h-10 w-full max-w-md" />
            <div className="rounded-xl border border-surface-200 bg-surface-0 h-96"></div>
        </div>
    )

    return (
        <div className="space-y-5 animate-fade-in">
            <PageHeader
                title="Serviços"
                subtitle="Catálogo de serviços prestados"
                count={services.length}
                actions={[{ label: 'Novo Serviço', onClick: openCreate, icon: <Plus className="h-4 w-4" /> }]}
            />

            <div className="max-w-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        placeholder="Buscar por nome ou código..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Serviço</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500 md:table-cell">Categoria</th>
                            <th className="px-3.5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-surface-500">Preço</th>
                            <th className="hidden px-3.5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-surface-500 lg:table-cell">Tempo</th>
                            <th className="px-3.5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-surface-500">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {services.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-2">
                                <EmptyState
                                    icon={<Briefcase className="h-5 w-5 text-surface-300" />}
                                    message="Nenhum serviço encontrado"
                                    action={{ label: 'Novo Serviço', onClick: openCreate, icon: <Plus className="h-4 w-4" /> }}
                                    compact
                                />
                            </td></tr>
                        ) : services.map(s => (
                            <tr key={s.id} className="hover:bg-surface-50 transition-colors duration-100">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                                            <Briefcase className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-medium text-surface-900">{s.name}</p>
                                            {s.code && <p className="text-xs text-surface-400">#{s.code}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="hidden px-4 py-3 md:table-cell">
                                    {s.category ? <Badge variant="success">{s.category.name}</Badge> : <span className="text-xs text-surface-400">â€”</span>}
                                </td>
                                <td className="px-3.5 py-2.5 text-right text-[13px] font-medium text-surface-900">{formatBRL(s.default_price)}</td>
                                <td className="hidden px-3.5 py-2.5 text-right lg:table-cell">
                                    <span className="flex items-center justify-end gap-1 text-[13px] text-surface-600">
                                        <Clock className="h-3.5 w-3.5" /> {formatTime(s.estimated_minutes)}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <IconButton
                                            icon={<UploadCloud className="h-4 w-4" />}
                                            aria-label="Exportar para Auvo"
                                            tooltip="Exportar para Auvo"
                                            onClick={() => exportService.mutate(s.id)}
                                            className="hover:text-blue-600 hover:bg-blue-50"
                                            disabled={exportService.isPending}
                                        />
                                        <IconButton label="Editar" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(s)} className="hover:text-brand-600" />
                                        <IconButton label="Excluir" icon={<Trash2 className="h-4 w-4" />} onClick={() => {
                                            setShowConfirmDelete(s)
                                            setDeleteDependencies(null)
                                            setDeleteMessage(null)
                                        }} className="hover:text-red-600" />
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
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Categoria</label>
                            <select value={form.category_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('category_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
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
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Descrição</label>
                        <textarea value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Confirm Delete Modal */}
            <Modal open={!!showConfirmDelete} onOpenChange={() => setShowConfirmDelete(null)} size="sm" title="Excluir Serviço">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-medium text-surface-900">Tem certeza?</h3>
                            <p className="text-sm text-surface-500">
                                Deseja realmente excluir <strong>{showConfirmDelete?.name}</strong>?
                            </p>
                        </div>
                    </div>

                    {deleteMessage && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
                            <p className="font-medium mb-1">Não é possível excluir:</p>
                            <p>{deleteMessage}</p>
                        </div>
                    )}

                    {deleteDependencies && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-surface-600 uppercase tracking-wide">Vínculos encontrados:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(deleteDependencies).map(([key, count]) => (
                                    <div key={key} className="flex items-center justify-between rounded bg-surface-50 px-3 py-2 text-sm border border-surface-100">
                                        <span className="text-surface-600 capitalize">{key.replace(/_/g, ' ')}</span>
                                        <Badge variant="neutral">{String(count)}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowConfirmDelete(null)}>Cancelar</Button>
                        {deleteDependencies ? (
                            <Button variant="ghost" disabled className="text-surface-400 cursor-not-allowed">
                                Resolva as pendências acima
                            </Button>
                        ) : (
                            <Button className="bg-red-600 hover:bg-red-700 text-white" loading={deleteMut.isPending}
                                onClick={() => {
                                    if (showConfirmDelete && window.confirm('Deseja realmente excluir este registro?')) {
                                        deleteMut.mutate(showConfirmDelete.id)
                                    }
                                }}>
                                Excluir Serviço
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
