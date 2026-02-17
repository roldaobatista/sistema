import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, MapPin, Truck, Edit2, Trash2, MoreVertical, Package, User } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth-store'

type WarehouseType = 'fixed' | 'vehicle' | 'technician'

interface Warehouse {
    id: number
    name: string
    code: string
    type: WarehouseType
    is_active: boolean
    user_id: number | null
    vehicle_id: number | null
    user?: { id: number; name: string } | null
    vehicle?: { id: number; plate: string } | null
    created_at: string
}

const typeConfig: Record<WarehouseType, { label: string; icon: typeof MapPin; color: string; bgColor: string }> = {
    fixed: { label: 'Fixo / Depósito', icon: MapPin, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    vehicle: { label: 'Veículo / Frota', icon: Truck, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    technician: { label: 'Técnico', icon: User, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
}

const emptyForm = {
    name: '',
    code: '',
    type: 'fixed' as WarehouseType,
    user_id: '' as string | number,
    vehicle_id: '' as string | number,
    is_active: true,
}

export function WarehousesPage() {
    const navigate = useNavigate()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('estoque.warehouse.create')
    const canUpdate = hasPermission('estoque.warehouse.update')
    const canDelete = hasPermission('estoque.warehouse.delete')

    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Warehouse | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [deleteConfirm, setDeleteConfirm] = useState<Warehouse | null>(null)

    const { data: res, isLoading } = useQuery({
        queryKey: ['warehouses', search, typeFilter],
        queryFn: () => api.get('/warehouses', { params: { search, type: typeFilter || undefined, active_only: false } }),
    })
    const warehouses: Warehouse[] = res?.data?.data ?? []

    const { data: usersRes } = useQuery({
        queryKey: ['users-list-simple'],
        queryFn: () => api.get('/users', { params: { per_page: 200 } }),
        enabled: showForm,
    })
    const users: { id: number; name: string }[] = usersRes?.data?.data ?? []

    const { data: vehiclesRes } = useQuery({
        queryKey: ['fleet-vehicles-simple'],
        queryFn: () => api.get('/fleet/vehicles', { params: { per_page: 200 } }),
        enabled: showForm,
    })
    const vehicles: { id: number; plate: string; model?: string }[] = vehiclesRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) => {
            const payload = {
                name: data.name,
                code: data.code,
                type: data.type,
                is_active: data.is_active,
                user_id: data.type === 'technician' ? (data.user_id || null) : null,
                vehicle_id: data.type === 'vehicle' ? (data.vehicle_id || null) : null,
            }
            return editing
                ? api.put(`/warehouses/${editing.id}`, payload)
                : api.post('/warehouses', payload)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['warehouses'] })
            setShowForm(false)
            setEditing(null)
            setForm(emptyForm)
            toast.success(editing ? 'Armazém atualizado!' : 'Armazém criado!')
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Erro ao salvar armazém')
        }
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/warehouses/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['warehouses'] })
            toast.success('Armazém excluído!')
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Erro ao excluir armazém')
        }
    })

    const handleEdit = (w: Warehouse) => {
        setEditing(w)
        setForm({
            name: w.name,
            code: w.code,
            type: w.type,
            user_id: w.user_id ?? '',
            vehicle_id: w.vehicle_id ?? '',
            is_active: w.is_active,
        })
        setShowForm(true)
    }

    const handleDeleteConfirm = (w: Warehouse) => {
        setDeleteConfirm(w)
    }

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    const getSubtitle = (w: Warehouse) => {
        if (w.type === 'technician' && w.user) return `Técnico: ${w.user.name}`
        if (w.type === 'vehicle' && w.vehicle) return `Placa: ${w.vehicle.plate}`
        return null
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Gestão de Armazéns"
                subtitle="Cadastre depósitos fixos, veículos ou armazéns de técnicos"
                actions={canCreate ? [
                    {
                        label: 'Novo Armazém',
                        icon: <Plus className="h-4 w-4" />,
                        onClick: () => { setEditing(null); setForm(emptyForm); setShowForm(true) },
                    },
                ] : []}
            />

            <div className="flex flex-wrap gap-3">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text" value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nome ou código..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    aria-label="Filtrar por tipo de armazém"
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none"
                >
                    <option value="">Todos os tipos</option>
                    <option value="fixed">Fixo / Depósito</option>
                    <option value="vehicle">Veículo</option>
                    <option value="technician">Técnico</option>
                </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-surface-500">Carregando...</div>
                ) : warehouses.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-surface-500">Nenhum armazém encontrado.</div>
                ) : warehouses.map(w => {
                    const cfg = typeConfig[w.type] || typeConfig.fixed
                    const TypeIcon = cfg.icon
                    const subtitle = getSubtitle(w)

                    return (
                        <div key={w.id} className="group relative overflow-hidden rounded-xl border border-default bg-surface-0 p-5 shadow-card transition-all">
                            <div className="flex items-start justify-between">
                                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", cfg.bgColor, cfg.color)}>
                                    <TypeIcon className="h-6 w-6" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={w.is_active ? 'emerald' : 'surface'}>
                                        {w.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                    {(canUpdate || canDelete) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {canUpdate && (
                                                    <DropdownMenuItem onClick={() => handleEdit(w)}>
                                                        <Edit2 className="mr-2 h-4 w-4" /> Editar
                                                    </DropdownMenuItem>
                                                )}
                                                {canDelete && (
                                                    <DropdownMenuItem onClick={() => handleDeleteConfirm(w)} className="text-red-600">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4">
                                <h3 className="font-semibold text-surface-900">{w.name}</h3>
                                <p className="text-xs text-surface-500">Código: {w.code} · {cfg.label}</p>
                                {subtitle && <p className="mt-0.5 text-xs text-surface-500">{subtitle}</p>}
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-subtle pt-4">
                                <button
                                    onClick={() => navigate(`/estoque/movimentacoes?warehouse_id=${w.id}`)}
                                    className="flex items-center gap-2 text-xs text-brand-600 font-medium hover:text-brand-700 transition-colors"
                                >
                                    <Package className="h-3.5 w-3.5" />
                                    <span>Ver Estoque</span>
                                </button>
                                <span className="text-xs text-surface-400">Criado em {new Date(w.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? "Editar Armazém" : "Novo Armazém"} size="md">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4 pt-2">
                    <Input label="Nome" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Ex: Depósito Principal, Veículo ABC-1234..." />
                    <Input label="Código único" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} required placeholder="Ex: DP01, V01..." />

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo de Armazém</label>
                        <div className="grid grid-cols-3 gap-3">
                            {(Object.keys(typeConfig) as WarehouseType[]).map(t => {
                                const cfg = typeConfig[t]
                                const Icon = cfg.icon
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => { set('type', t); if (t !== 'technician') set('user_id', ''); if (t !== 'vehicle') set('vehicle_id', '') }}
                                        className={cn(
                                            "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all",
                                            form.type === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-default bg-surface-50 text-surface-600 hover:bg-surface-100"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" /> {cfg.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {form.type === 'technician' && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Técnico Responsável</label>
                            <select
                                value={form.user_id}
                                onChange={e => set('user_id', e.target.value ? Number(e.target.value) : '')}
                                aria-label="Selecionar técnico responsável"
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            >
                                <option value="">Selecione um técnico...</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    )}

                    {form.type === 'vehicle' && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Veículo Vinculado</label>
                            <select
                                value={form.vehicle_id}
                                onChange={e => set('vehicle_id', e.target.value ? Number(e.target.value) : '')}
                                aria-label="Selecionar veículo vinculado"
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            >
                                <option value="">Selecione um veículo...</option>
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}{v.model ? ` - ${v.model}` : ''}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center gap-2 py-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={form.is_active}
                            onChange={e => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-surface-700 select-none">Armazém Ativo</label>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Atualizar' : 'Criar Armazém'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)} title="Confirmar Exclusão" size="sm">
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-surface-600">
                        Tem certeza que deseja excluir o armazém <strong>{deleteConfirm?.name}</strong>? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            loading={deleteMut.isPending}
                            onClick={() => {
                                if (deleteConfirm) {
                                    deleteMut.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) })
                                }
                            }}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
