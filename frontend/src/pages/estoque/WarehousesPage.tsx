import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, MapPin, Truck, Edit2, Trash2, MoreVertical, Package, CheckCircle2, XCircle } from 'lucide-react'
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

interface Warehouse {
    id: number
    name: string
    code: string
    type: 'fixed' | 'vehicle'
    is_active: boolean
    created_at: string
}

const emptyForm = {
    name: '',
    code: '',
    type: 'fixed' as 'fixed' | 'vehicle',
    is_active: true,
}

export function WarehousesPage() {
  const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Warehouse | null>(null)
    const [form, setForm] = useState(emptyForm)

    const { data: res, isLoading } = useQuery({
        queryKey: ['warehouses', search],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/warehouses', { params: { search } }),
    })
    const warehouses: Warehouse[] = res?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing
                ? api.put(`/warehouses/${editing.id}`, data)
                : api.post('/warehouses', data),
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
            is_active: w.is_active,
        })
        setShowForm(true)
    }

    const handleDelete = (id: number) => {
        if (confirm('Tem certeza que deseja excluir este armazém?')) {
            deleteMut.mutate(id)
        }
    }

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    return (
        <div className="space-y-5">
            <PageHeader
                title="Gestão de Armazéns"
                subtitle="Cadastre depósitos fixos ou veículos para controle de estoque"
                actions={[
                    {
                        label: 'Novo Armazém',
                        icon: <Plus className="h-4 w-4" />,
                        onClick: () => { setEditing(null); setForm(emptyForm); setShowForm(true) },
                    },
                ]}
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-surface-500">Carregando...</div>
                ) : warehouses.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-surface-500">Nenhum armazém encontrado.</div>
                ) : warehouses.map(w => (
                    <div key={w.id} className="group relative overflow-hidden rounded-xl border border-default bg-surface-0 p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-start justify-between">
                            <div className={cn(
                                "flex h-12 w-12 items-center justify-center rounded-xl",
                                w.type === 'vehicle' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                            )}>
                                {w.type === 'vehicle' ? <Truck className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant={w.is_active ? 'emerald' : 'surface'}>
                                    {w.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEdit(w)}>
                                            <Edit2 className="mr-2 h-4 w-4" /> Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(w.id)} className="text-red-600">
                                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <div className="mt-4">
                            <h3 className="font-semibold text-surface-900">{w.name}</h3>
                            <p className="text-xs text-surface-500">Código: {w.code}</p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-subtle pt-4">
                            <div className="flex items-center gap-2 text-xs text-surface-500 font-medium">
                                <Package className="h-3.5 w-3.5" />
                                <span>Ver Estoque</span>
                            </div>
                            <span className="text-[10px] text-surface-400">Criado em {new Date(w.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? "Editar Armazém" : "Novo Armazém"} size="md">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4 pt-2">
                    <Input label="Nome" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Ex: Depósito Principal, Veículo ABC-1234..." />
                    <Input label="Código único" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} required placeholder="Ex: DP01, V01..." />

                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Tipo de Armazém</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => set('type', 'fixed')}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all",
                                    form.type === 'fixed' ? "border-brand-500 bg-brand-50 text-brand-700" : "border-default bg-surface-50 text-surface-600 hover:bg-surface-100"
                                )}
                            >
                                <MapPin className="h-4 w-4" /> Fixo / Depósito
                            </button>
                            <button
                                type="button"
                                onClick={() => set('type', 'vehicle')}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all",
                                    form.type === 'vehicle' ? "border-brand-500 bg-brand-50 text-brand-700" : "border-default bg-surface-50 text-surface-600 hover:bg-surface-100"
                                )}
                            >
                                <Truck className="h-4 w-4" /> Veículo / Frota
                            </button>
                        </div>
                    </div>

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
        </div>
    )
}
