import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Package, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { IconButton } from '@/components/ui/iconbutton'
import { useAuthStore } from '@/stores/auth-store'
import { EmptyState } from '@/components/ui/emptystate'

interface EquipmentModel {
    id: number
    name: string
    brand: string | null
    category: string | null
    products_count?: number
    products?: { id: number; name: string; code: string | null }[]
}

interface Product {
    id: number
    name: string
    code: string | null
}

export default function EquipmentModelsPage() {
    const { hasPermission } = useAuthStore()
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<EquipmentModel | null>(null)
    const [form, setForm] = useState({ name: '', brand: '', category: '' })
    const [productIds, setProductIds] = useState<number[]>([])
    const [productSearch, setProductSearch] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<EquipmentModel | null>(null)

    const canCreate = hasPermission('equipments.equipment_model.create')
    const canUpdate = hasPermission('equipments.equipment_model.update')
    const canDelete = hasPermission('equipments.equipment_model.delete')

    const { data: listData, isLoading } = useQuery({
        queryKey: ['equipment-models', search],
        queryFn: () => api.get('/equipment-models', { params: { search: search || undefined, per_page: 100 } }),
    })
    const models: EquipmentModel[] = listData?.data?.data ?? []

    const { data: constants } = useQuery({
        queryKey: ['equipments-constants'],
        queryFn: () => api.get('/equipments-constants').then((r) => r.data),
    })
    const categories: Record<string, string> = constants?.categories ?? {}

    const { data: modelDetail } = useQuery({
        queryKey: ['equipment-model', editing?.id],
        queryFn: () => api.get(`/equipment-models/${editing!.id}`).then((r) => r.data.equipment_model),
        enabled: !!editing?.id && showForm,
    })
    const hasSyncedProducts = useRef(false)
    useEffect(() => {
        if (!editing?.id || !modelDetail?.products) return
        if (!hasSyncedProducts.current) {
            hasSyncedProducts.current = true
            setProductIds(modelDetail.products.map((p: { id: number }) => p.id))
        }
    }, [editing?.id, modelDetail?.products])
    useEffect(() => {
        if (!editing) hasSyncedProducts.current = false
    }, [editing])

    const { data: productsData } = useQuery({
        queryKey: ['products', 'select', productSearch],
        queryFn: () => api.get('/products', { params: { search: productSearch || undefined, per_page: 200, is_active: true } }),
        enabled: showForm || !!editing,
    })
    const products: Product[] = Array.isArray(productsData?.data?.data) ? productsData.data.data : productsData?.data?.data ?? []

    const createMut = useMutation({
        mutationFn: (payload: { name: string; brand: string; category: string }) => api.post('/equipment-models', payload),
        onSuccess: async (res) => {
            const id = res.data?.equipment_model?.id
            if (id && productIds.length > 0) {
                await api.put(`/equipment-models/${id}/products`, { product_ids: productIds })
            }
            qc.invalidateQueries({ queryKey: ['equipment-models'] })
            setShowForm(false)
            setForm({ name: '', brand: '', category: '' })
            setProductIds([])
            toast.success('Modelo criado.')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao criar.'),
    })

    const updateMut = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: { name: string; brand: string; category: string } }) =>
            api.put(`/equipment-models/${id}`, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['equipment-models'] })
            toast.success('Modelo atualizado.')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao atualizar.'),
    })

    const syncProductsMut = useMutation({
        mutationFn: ({ id, product_ids }: { id: number; product_ids: number[] }) =>
            api.put(`/equipment-models/${id}/products`, { product_ids }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['equipment-models'] })
            toast.success('Peças atualizadas.')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar peças.'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/equipment-models/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['equipment-models'] })
            setDeleteTarget(null)
            toast.success('Modelo excluído.')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir.'),
    })

    const openCreate = () => {
        setEditing(null)
        setForm({ name: '', brand: '', category: '' })
        setProductIds([])
        setShowForm(true)
    }

    const openEdit = (m: EquipmentModel) => {
        setEditing(m)
        setForm({
            name: m.name,
            brand: m.brand ?? '',
            category: m.category ?? '',
        })
        setProductIds(m.products?.map((p) => p.id) ?? [])
        setShowForm(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (editing) {
            updateMut.mutate(
                { id: editing.id, payload: form },
                {
                    onSuccess: () => {
                        syncProductsMut.mutate(
                            { id: editing.id, product_ids: productIds },
                            {
                                onSuccess: () => {
                                    setShowForm(false)
                                    setEditing(null)
                                },
                            }
                        )
                    },
                }
            )
        } else {
            createMut.mutate(form)
        }
    }

    const toggleProduct = (id: number) => {
        setProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Modelos de balança"
                subtitle="Cadastre modelos e vincule peças compatíveis. Ao vincular um equipamento a um modelo, as peças aparecem na ficha do equipamento."
            />
            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou marca"
                    className="flex-1 rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                    aria-label="Buscar modelos"
                />
                {canCreate && (
                    <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
                        Novo modelo
                    </Button>
                )}
            </div>
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
            ) : models.length === 0 ? (
                <EmptyState
                    icon={Package}
                    title="Nenhum modelo cadastrado"
                    description="Crie um modelo de balança e vincule as peças que podem ser usadas nele."
                    action={canCreate ? { label: 'Novo modelo', onClick: openCreate } : undefined}
                />
            ) : (
                <div className="rounded-xl border border-default bg-surface-0 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-surface-50 border-b border-default">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase">Nome</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase">Marca</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase">Categoria</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase">Peças</th>
                                <th className="w-24 px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-default">
                            {models.map((m) => (
                                <tr key={m.id} className="hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{m.name}</td>
                                    <td className="px-4 py-3 text-surface-600">{m.brand ?? '—'}</td>
                                    <td className="px-4 py-3 text-surface-600">{m.category ? categories[m.category] ?? m.category : '—'}</td>
                                    <td className="px-4 py-3 text-surface-600">{m.products_count ?? 0}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            {canUpdate && (
                                                <IconButton
                                                    icon={<Pencil className="h-4 w-4" />}
                                                    onClick={() => openEdit(m)}
                                                    aria-label="Editar"
                                                    tooltip="Editar"
                                                />
                                            )}
                                            {canDelete && (
                                                <IconButton
                                                    icon={<Trash2 className="h-4 w-4" />}
                                                    onClick={() => setDeleteTarget(m)}
                                                    aria-label="Excluir"
                                                    tooltip="Excluir"
                                                    className="hover:text-red-600"
                                                />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal
                open={showForm}
                onOpenChange={setShowForm}
                title={editing ? 'Editar modelo' : 'Novo modelo de balança'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input
                            label="Nome"
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            required
                        />
                        <Input
                            label="Marca"
                            value={form.brand}
                            onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                        />
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Categoria</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                                aria-label="Categoria do modelo"
                            >
                                <option value="">—</option>
                                {Object.entries(categories).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Peças compatíveis</label>
                        <input
                            type="search"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Buscar produto..."
                            className="mb-2 w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                        />
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-default p-2 space-y-1">
                            {products.length === 0 ? (
                                <p className="text-sm text-surface-500 py-2">Nenhum produto ou busque acima.</p>
                            ) : (
                                products.map((p) => (
                                    <label
                                        key={p.id}
                                        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={productIds.includes(p.id)}
                                            onChange={() => toggleProduct(p.id)}
                                            className="rounded border-default text-brand-600"
                                        />
                                        <span className="text-sm">{p.name}</span>
                                        {p.code && <span className="text-xs text-surface-400">#{p.code}</span>}
                                    </label>
                                ))
                            )}
                        </div>
                        <p className="mt-1 text-xs text-surface-500">{productIds.length} peça(s) selecionada(s)</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-subtle">
                        <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
                            {editing ? 'Salvar' : 'Criar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir modelo" size="sm">
                {deleteTarget && (
                    <div className="space-y-4">
                        <p className="text-sm text-surface-600">
                            Excluir o modelo <strong>{deleteTarget.name}</strong>? Equipamentos vinculados terão o vínculo removido.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="danger"
                                loading={deleteMut.isPending}
                                onClick={() => deleteMut.mutate(deleteTarget.id)}
                            >
                                Excluir
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
