import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    MapPin, Plus, Pencil, Trash2, Power, PowerOff, Search, Crosshair
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface Geofence {
    id: number
    name: string
    latitude: number
    longitude: number
    radius_meters: number
    is_active: boolean
    linked_entity_type: string | null
    linked_entity_id: number | null
}

const emptyForm = { name: '', latitude: '', longitude: '', radius_meters: '200' }

export default function GeofenceLocationsPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canManage = hasRole('super_admin') || hasPermission('hr.geofence.manage')
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Geofence | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [deleteTarget, setDeleteTarget] = useState<Geofence | null>(null)

    const { data: geofencesRes, isLoading } = useQuery({
        queryKey: ['geofences'],
        queryFn: () => api.get('/hr/geofences').then(r => r.data?.data ?? []),
    })

    const geofences: Geofence[] = geofencesRes ?? []
    const filtered = geofences.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase())
    )

    const saveMut = useMutation({
        mutationFn: (data: any) =>
            editing
                ? api.put(`/hr/geofences/${editing.id}`, data)
                : api.post('/hr/geofences', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['geofences'] })
            setShowModal(false)
            setEditing(null)
            setForm(emptyForm)
            toast.success(editing ? 'Geofence atualizado' : 'Geofence criado')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/hr/geofences/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['geofences'] })
            setDeleteTarget(null)
            toast.success('Geofence excluído')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir'),
    })

    const openCreate = () => {
        setEditing(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (g: Geofence) => {
        setEditing(g)
        setForm({
            name: g.name,
            latitude: String(g.latitude),
            longitude: String(g.longitude),
            radius_meters: String(g.radius_meters),
        })
        setShowModal(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        saveMut.mutate({
            name: form.name,
            latitude: parseFloat(form.latitude),
            longitude: parseFloat(form.longitude),
            radius_meters: parseInt(form.radius_meters, 10),
        })
    }

    const useCurrentLocation = () => {
        navigator.geolocation.getCurrentPosition(
            pos => {
                setForm(p => ({
                    ...p,
                    latitude: pos.coords.latitude.toFixed(8),
                    longitude: pos.coords.longitude.toFixed(8),
                }))
                toast.success('Localização atual capturada')
            },
            () => toast.error('Não foi possível obter GPS'),
            { enableHighAccuracy: true, timeout: 10_000 }
        )
    }

    return (
        <div className="space-y-5">
            <PageHeader title="Geofencing" subtitle="Localizações de referência para validação de ponto" />

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar localização..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                </div>
                {canManage && (
                    <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
                        Nova Localização
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Coordenadas</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Raio (m)</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Status</th>
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
                                    <MapPin className="mx-auto h-8 w-8 text-surface-300" />
                                    <p className="mt-2 text-sm text-surface-400">Nenhuma localização cadastrada</p>
                                    {canManage && (
                                        <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                                            Criar primeira localização
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        )}
                        {filtered.map(g => (
                            <tr key={g.id} className="transition-colors hover:bg-surface-50/50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-brand-500" />
                                        <span className="font-medium text-surface-900">{g.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-surface-500">
                                    {g.latitude.toFixed(6)}, {g.longitude.toFixed(6)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                                        {g.radius_meters}m
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={cn(
                                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        g.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-500'
                                    )}>
                                        {g.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                {canManage && (
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button title="Editar" onClick={() => openEdit(g)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button title="Excluir" onClick={() => setDeleteTarget(g)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            <Modal open={showModal && canManage} onOpenChange={setShowModal} title={editing ? 'Editar Localização' : 'Nova Localização'} size="md">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Nome *" value={form.name} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, name: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Latitude *" type="number" step="any" value={form.latitude} required
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, latitude: e.target.value }))} />
                        <Input label="Longitude *" type="number" step="any" value={form.longitude} required
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, longitude: e.target.value }))} />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={useCurrentLocation} icon={<Crosshair className="h-3.5 w-3.5" />}>
                        Usar localização atual
                    </Button>
                    <Input label="Raio (metros) *" type="number" min="10" max="5000" value={form.radius_meters} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, radius_meters: e.target.value }))} />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir Localização" size="sm">
                <p className="text-sm text-surface-600">
                    Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
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
