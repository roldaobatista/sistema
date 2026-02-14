import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Calendar, Plus, Pencil, Trash2, Search, Globe, MapPin
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface Holiday {
    id: number
    name: string
    date: string
    is_national: boolean
    is_recurring: boolean
}

const emptyForm = { name: '', date: '', is_national: true, is_recurring: false }

export default function HolidaysPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canManage = hasRole('super_admin') || hasPermission('hr.holiday.manage')
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Holiday | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null)
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear())

    const { data: holidaysRes, isLoading } = useQuery({
        queryKey: ['holidays', yearFilter],
        queryFn: () => api.get('/hr/holidays', { params: { year: yearFilter } }).then(r => r.data?.data ?? []),
    })

    const holidays: Holiday[] = holidaysRes ?? []
    const filtered = holidays.filter(h =>
        h.name.toLowerCase().includes(search.toLowerCase())
    )

    const saveMut = useMutation({
        mutationFn: (data: any) =>
            editing
                ? api.put(`/hr/holidays/${editing.id}`, data)
                : api.post('/hr/holidays', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['holidays'] })
            setShowModal(false)
            setEditing(null)
            setForm(emptyForm)
            toast.success(editing ? 'Feriado atualizado' : 'Feriado criado')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/hr/holidays/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['holidays'] })
            setDeleteTarget(null)
            toast.success('Feriado excluído')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir'),
    })

    const importNationalMut = useMutation({
        mutationFn: () => api.post('/hr/holidays/import-national', { year: yearFilter }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['holidays'] })
            toast.success('Feriados nacionais importados')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao importar'),
    })

    const openCreate = () => {
        setEditing(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (h: Holiday) => {
        setEditing(h)
        setForm({
            name: h.name,
            date: h.date,
            is_national: h.is_national,
            is_recurring: h.is_recurring,
        })
        setShowModal(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        saveMut.mutate(form)
    }

    return (
        <div className="space-y-5">
            <PageHeader title="Feriados" subtitle="Feriados nacionais e locais que afetam o cálculo de jornada" />

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                        <input
                            type="text"
                            placeholder="Buscar feriado..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        />
                    </div>
                    <select
                        aria-label="Filtrar por ano"
                        value={yearFilter}
                        onChange={e => setYearFilter(Number(e.target.value))}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none"
                    >
                        {[yearFilter - 1, yearFilter, yearFilter + 1].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                {canManage && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => importNationalMut.mutate()}
                            loading={importNationalMut.isPending} icon={<Globe className="h-4 w-4" />}>
                            Importar Nacionais
                        </Button>
                        <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
                            Novo Feriado
                        </Button>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-brand-50 p-2.5"><Calendar className="h-5 w-5 text-brand-600" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Total</p>
                            <p className="text-lg font-bold text-surface-900">{holidays.length}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2.5"><Globe className="h-5 w-5 text-blue-600" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Nacionais</p>
                            <p className="text-lg font-bold text-surface-900">{holidays.filter(h => h.is_national).length}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-amber-50 p-2.5"><MapPin className="h-5 w-5 text-amber-600" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Locais</p>
                            <p className="text-lg font-bold text-surface-900">{holidays.filter(h => !h.is_national).length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Feriado</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Recorrente</th>
                            {canManage && <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>
                        )}
                        {!isLoading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center">
                                    <Calendar className="mx-auto h-8 w-8 text-surface-300" />
                                    <p className="mt-2 text-sm text-surface-400">Nenhum feriado cadastrado</p>
                                    {canManage && (
                                        <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                                            Adicionar feriado
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        )}
                        {filtered.map(h => {
                            const date = new Date(h.date + 'T00:00:00')
                            const isPast = date < new Date()
                            return (
                                <tr key={h.id} className={cn('transition-colors hover:bg-surface-50/50', isPast && 'opacity-60')}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-red-400" />
                                            <span className="font-medium text-surface-900">{h.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-surface-600">
                                        {date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={cn(
                                            'rounded-full px-2.5 py-0.5 text-xs font-medium',
                                            h.is_national ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                        )}>
                                            {h.is_national ? 'Nacional' : 'Local'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs text-surface-500">
                                        {h.is_recurring ? 'Sim' : 'Não'}
                                    </td>
                                    {canManage && (
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button title="Editar" onClick={() => openEdit(h)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button title="Excluir" onClick={() => setDeleteTarget(h)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            <Modal open={showModal && canManage} onOpenChange={setShowModal} title={editing ? 'Editar Feriado' : 'Novo Feriado'} size="sm">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Nome *" value={form.name} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, name: e.target.value }))} />
                    <Input label="Data *" type="date" value={form.date} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, date: e.target.value }))} />
                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 text-sm text-surface-700">
                            <input
                                type="checkbox"
                                checked={form.is_national}
                                onChange={e => setForm(p => ({ ...p, is_national: e.target.checked }))}
                                className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                            />
                            Nacional
                        </label>
                        <label className="flex items-center gap-2 text-sm text-surface-700">
                            <input
                                type="checkbox"
                                checked={form.is_recurring}
                                onChange={e => setForm(p => ({ ...p, is_recurring: e.target.checked }))}
                                className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                            />
                            Recorrente (todo ano)
                        </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir Feriado" size="sm">
                <p className="text-sm text-surface-600">
                    Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
                </p>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                    <Button
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
                        loading={deleteMut.isPending}
                    >
                        Excluir
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
