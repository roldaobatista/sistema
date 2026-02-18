import React, { useState } from 'react'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { useDebounce } from '@/hooks/useDebounce'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, Package, AlertTriangle, UploadCloud, Scale, ChevronLeft, ChevronRight } from 'lucide-react'
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

interface Product {
    id: number; code: string | null; name: string; description: string | null
    unit: string; cost_price: string; sell_price: string
    stock_qty: string; stock_min: string; is_active: boolean
    manufacturer_code?: string | null; storage_location?: string | null
    category: { id: number; name: string } | null
    equipment_models?: { id: number; name: string; brand: string | null; category: string | null }[]
}

const emptyForm = {
    category_id: '' as string | number, code: '', name: '', description: '',
    unit: 'UN', cost_price: '0', sell_price: '0',
    stock_qty: '0', stock_min: '0', is_active: true,
    manufacturer_code: '', storage_location: '',
}

export function ProductsPage() {
    const { hasPermission } = useAuthStore()

    const canCreate = hasPermission('cadastros.product.create')
    const canEdit = hasPermission('cadastros.product.update')
    const canDelete = hasPermission('cadastros.product.delete')

    const qc = useQueryClient()
    const { exportProduct } = useAuvoExport()
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 400)
    const [page, setPage] = useState(1)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Product | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [newCat, setNewCat] = useState('')

    const [showConfirmDelete, setShowConfirmDelete] = useState<Product | null>(null)
    const [deleteDependencies, setDeleteDependencies] = useState<any>(null)
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null)

    const perPage = 25

    const { data: res, isLoading } = useQuery({
        queryKey: ['products', debouncedSearch, page],
        queryFn: () => api.get('/products', { params: { search: debouncedSearch, per_page: perPage, page } }),
    })
    const products: Product[] = res?.data?.data ?? []
    const totalProducts: number = res?.data?.total ?? 0
    const lastPage: number = res?.data?.last_page ?? 1

    const { data: catsRes } = useQuery({
        queryKey: ['product-categories'],
        queryFn: () => api.get('/product-categories'),
    })
    const categories = catsRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing ? api.put(`/products/${editing.id}`, data) : api.post('/products', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['products'] })
            broadcastQueryInvalidation(['products', 'products-all', 'stock'], 'Produto')
            setShowForm(false)
            toast.success(editing ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao salvar produto.')
        }
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/products/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['products'] })
            qc.invalidateQueries({ queryKey: ['stock'] })
            broadcastQueryInvalidation(['products', 'products-all', 'stock'], 'Produto')
            setShowConfirmDelete(null)
            toast.success('Produto excluído com sucesso!')
        },
        onError: (err: any) => {
            if (err.response?.status === 409 || err.response?.status === 422) {
                setDeleteDependencies(err.response.data.dependencies)
                setDeleteMessage(err.response.data.message)
            } else {
                toast.error(err.response?.data?.message ?? 'Erro ao excluir produto.')
                setShowConfirmDelete(null)
            }
        },
    })

    const catMut = useMutation({
        mutationFn: (name: string) => api.post('/product-categories', { name }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['product-categories'] })
            setNewCat('')
            toast.success('Categoria criada!')
        },
        onError: () => toast.error('Erro ao criar categoria.')
    })

    const { data: productDetail } = useQuery({
        queryKey: ['product', editing?.id],
        queryFn: () => api.get(`/products/${editing!.id}`).then((r) => r.data),
        enabled: !!editing?.id && showForm,
    })
    const productEquipmentModels: { id: number; name: string; brand: string | null }[] = productDetail?.equipment_models ?? []

    const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
    const openEdit = (p: Product) => {
        setEditing(p)
        setForm({
            category_id: p.category?.id ?? '', code: p.code ?? '', name: p.name,
            description: p.description ?? '', unit: p.unit,
            cost_price: p.cost_price, sell_price: p.sell_price,
            stock_qty: p.stock_qty, stock_min: p.stock_min, is_active: p.is_active,
            manufacturer_code: p.manufacturer_code ?? '', storage_location: p.storage_location ?? '',
        })
        setShowForm(true)
    }

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    const handleSearch = (val: string) => {
        setSearch(val)
        setPage(1)
    }

    const isLowStock = (p: Product) => {
        const min = parseFloat(p.stock_min)
        return min > 0 && parseFloat(p.stock_qty) <= min
    }

    const formatBRL = (v: string) => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
            <div className="rounded-xl border border-default bg-surface-0 h-96"></div>
        </div>
    )

    return (
        <div className="space-y-5 animate-fade-in">
            <PageHeader
                title="Produtos"
                subtitle="Catálogo de produtos e peças"
                count={totalProducts}
                actions={canCreate ? [{ label: 'Novo Produto', onClick: openCreate, icon: <Plus className="h-4 w-4" /> }] : []}
            />

            <div className="max-w-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                        placeholder="Buscar por nome ou código..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Produto</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500 md:table-cell">Categoria</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Preço</th>
                            <th className="hidden px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500 lg:table-cell">Estoque</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {products.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-2">
                                <EmptyState
                                    icon={<Package className="h-5 w-5 text-surface-300" />}
                                    message="Nenhum produto encontrado"
                                    action={canCreate ? { label: 'Novo Produto', onClick: openCreate, icon: <Plus className="h-4 w-4" /> } : undefined}
                                    compact
                                />
                            </td></tr>
                        ) : products.map(p => (
                            <tr key={p.id} className="hover:bg-surface-50 transition-colors duration-100">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                                            <Package className="h-4 w-4 text-brand-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-surface-900">{p.name}</p>
                                            {p.code && <p className="text-xs text-surface-400">#{p.code}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="hidden px-4 py-3 md:table-cell">
                                    {p.category ? <Badge variant="brand">{p.category.name}</Badge> : <span className="text-xs text-surface-400">—</span>}
                                </td>
                                <td className="px-3.5 py-2.5 text-right text-sm font-medium text-surface-900">{formatBRL(p.sell_price)}</td>
                                <td className="hidden px-3.5 py-2.5 text-right lg:table-cell">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {isLowStock(p) && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                        <span className={cn('text-sm font-medium', isLowStock(p) ? 'text-amber-600' : 'text-surface-700')}>
                                            {parseFloat(p.stock_qty)} {p.unit}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        {hasPermission('auvo.export.execute') && (
                                            <IconButton
                                                icon={<UploadCloud className="h-4 w-4" />}
                                                aria-label="Exportar para Auvo"
                                                tooltip="Exportar para Auvo"
                                                onClick={() => exportProduct.mutate(p.id)}
                                                className="hover:text-blue-600 hover:bg-blue-50"
                                                disabled={exportProduct.isPending}
                                            />
                                        )}
                                        {canEdit && (
                                            <IconButton label="Editar" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(p)} className="hover:text-brand-600" />
                                        )}
                                        {canDelete && (
                                            <IconButton label="Excluir" icon={<Trash2 className="h-4 w-4" />} onClick={() => {
                                                setShowConfirmDelete(p)
                                                setDeleteDependencies(null)
                                                setDeleteMessage(null)
                                            }} className="hover:text-red-600" />
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {lastPage > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-surface-500">
                        Mostrando {(page - 1) * perPage + 1}–{Math.min(page * perPage, totalProducts)} de {totalProducts}
                    </p>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-3 text-sm text-surface-700">Página {page} de {lastPage}</span>
                        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Produto' : 'Novo Produto'} size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Nome" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} required />
                        <Input label="Código" value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('code', e.target.value)} placeholder="Opcional" />
                        <Input label="Código fabricante" value={form.manufacturer_code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('manufacturer_code', e.target.value)} placeholder="Opcional" />
                        <Input label="Endereço no estoque" value={form.storage_location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('storage_location', e.target.value)} placeholder="Ex: A-01-02" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label htmlFor="product-category" className="mb-1.5 block text-sm font-medium text-surface-700">Categoria</label>
                            <select id="product-category" value={form.category_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('category_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Sem categoria</option>
                                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <div className="mt-1.5 flex gap-1">
                                <input value={newCat} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCat(e.target.value)} placeholder="Nova categoria"
                                    className="flex-1 rounded-md border border-default px-2 py-1 text-xs" />
                                <Button variant="ghost" size="sm" type="button" disabled={!newCat}
                                    onClick={() => catMut.mutate(newCat)}>+</Button>
                            </div>
                        </div>
                        <Input label="Unidade" value={form.unit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('unit', e.target.value)} placeholder="UN, CX, KG..." />
                        <div />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Input label="Preço Custo (R$)" type="number" step="0.01" value={form.cost_price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('cost_price', e.target.value)} />
                        <Input label="Preço Venda (R$)" type="number" step="0.01" value={form.sell_price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('sell_price', e.target.value)} />
                        <Input label="Estoque" type="number" step="0.01" value={form.stock_qty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('stock_qty', e.target.value)} />
                        <Input label="Estoque Mín." type="number" step="0.01" value={form.stock_min} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('stock_min', e.target.value)} />
                    </div>
                    <div>
                        <label htmlFor="product-description" className="mb-1.5 block text-sm font-medium text-surface-700">Descrição</label>
                        <textarea id="product-description" placeholder="Descrição do produto" value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm font-medium text-surface-700">Produto ativo</span>
                    </label>
                    {editing && productEquipmentModels.length > 0 && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Usado nos modelos de balança</label>
                            <ul className="rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm space-y-1">
                                {productEquipmentModels.map((m) => (
                                    <li key={m.id} className="flex items-center gap-2">
                                        <Scale className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                                        {m.brand ? `${m.brand} - ${m.name}` : m.name}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-1 text-xs text-surface-500">Para alterar, edite em Equipamentos → Modelos de balança.</p>
                        </div>
                    )}
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!showConfirmDelete} onOpenChange={() => setShowConfirmDelete(null)} size="sm" title="Excluir Produto">
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
                                    <div key={key} className="flex items-center justify-between rounded bg-surface-50 px-3 py-2 text-sm border border-default">
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
                                    if (showConfirmDelete) {
                                        deleteMut.mutate(showConfirmDelete.id)
                                    }
                                }}>
                                Excluir Produto
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
