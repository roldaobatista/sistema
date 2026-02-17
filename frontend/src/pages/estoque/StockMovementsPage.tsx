import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Package, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Wrench, ArrowLeftRight, MapPin, FileUp } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'

interface ProductOption {
    id: number
    name: string
    code?: string | null
}

interface WarehouseOption {
    id: number
    name: string
}

interface StockMovement {
    id: number
    product: { id: number; name: string; code: string | null }
    work_order: { id: number; number: string; os_number?: string | null; business_number?: string | null } | null
    type: 'entry' | 'exit' | 'reserve' | 'return' | 'adjustment'
    quantity: string
    unit_cost: string
    reference: string | null
    notes: string | null
    warehouse: { id: number; name: string } | null
    created_by_user: { id: number; name: string } | null
    created_at: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; badgeVariant: 'emerald' | 'red' | 'amber' | 'blue' | 'brand' }> = {
    entry: { label: 'Entrada', icon: ArrowDownToLine, color: 'text-emerald-600 bg-emerald-50', badgeVariant: 'emerald' },
    exit: { label: 'Saída', icon: ArrowUpFromLine, color: 'text-red-600 bg-red-50', badgeVariant: 'red' },
    reserve: { label: 'Reserva', icon: Package, color: 'text-amber-600 bg-amber-50', badgeVariant: 'amber' },
    return: { label: 'Devolução', icon: RotateCcw, color: 'text-blue-600 bg-blue-50', badgeVariant: 'blue' },
    adjustment: { label: 'Ajuste', icon: ArrowLeftRight, color: 'text-surface-600 bg-surface-100', badgeVariant: 'brand' },
}
const woIdentifier = (wo?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

type MovementFormType = 'entry' | 'exit' | 'reserve' | 'return' | 'adjustment'

const emptyForm = {
    product_id: '' as string | number,
    warehouse_id: '' as string | number,
    type: 'entry' as MovementFormType,
    quantity: '',
    unit_cost: '0',
    notes: '',
}

export function StockMovementsPage() {
  const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [showXmlModal, setShowXmlModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [page, setPage] = useState(1)
    const [xmlFile, setXmlFile] = useState<File | null>(null)
    const [xmlWarehouseId, setXmlWarehouseId] = useState('')

    const { data: res, isLoading } = useQuery({
        queryKey: ['stock-movements', search, typeFilter, page],
        queryFn: () => api.get('/stock/movements', { params: { search, type: typeFilter || undefined, page, per_page: 25 } }),
    })
    const movements: StockMovement[] = res?.data?.data ?? []
    const pagination = { last_page: res?.data?.last_page ?? 1, current_page: res?.data?.current_page ?? 1 }

    const { data: productsRes } = useQuery({
        queryKey: ['products-select'],
        queryFn: () => api.get('/products', { params: { per_page: 200 } }),
    })
    const products: ProductOption[] = productsRes?.data?.data ?? []

    const { data: warehousesRes } = useQuery({
        queryKey: ['warehouses-select'],
        queryFn: () => api.get('/warehouses'),
    })
    const warehouses: WarehouseOption[] = warehousesRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) => api.post('/stock/movements', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['stock-movements'] })
            qc.invalidateQueries({ queryKey: ['stock-summary'] })
            qc.invalidateQueries({ queryKey: ['stock-low-alerts'] })
            qc.invalidateQueries({ queryKey: ['products-select'] })
            setShowForm(false)
            setForm(emptyForm)
            toast.success('Movimentação registrada com sucesso!')
        },
        onError: (error: any) => {
            const msg = error?.response?.data?.message || 'Erro ao registrar movimentação'
            toast.error(msg)
        },
    })

    const importXmlMut = useMutation({
        mutationFn: (data: FormData) => api.post('/stock/import-xml', data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['stock-movements'] })
            toast.success('XML processado com sucesso!')
                setShowXmlModal(false)
            setXmlFile(null)
            const errors = res.data.data.errors
            if (errors && errors.length > 0) {
                toast.warning(`${errors.length} itens não puderam ser importados. Verifique o log.`)
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Erro ao importar XML')
        }
    })

    const handleXmlSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!xmlFile || !xmlWarehouseId) return
        const formData = new FormData()
        formData.append('xml_file', xmlFile)
        formData.append('warehouse_id', xmlWarehouseId)
        importXmlMut.mutate(formData)
    }

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    const formatBRL = (v: string) => {
        const num = parseFloat(v)
        return isNaN(num) ? 'R$ 0,00' : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Movimentações de Estoque"
                subtitle="Registro de entradas, saídas e ajustes"
                actions={[
                    {
                        label: 'Importar XML',
                        icon: <FileUp className="h-4 w-4" />,
                        onClick: () => setShowXmlModal(true),
                        variant: 'outline',
                        permission: hasPermission('estoque.movement.create'),
                    },
                    {
                        label: 'Nova Movimentação',
                        icon: <Plus className="h-4 w-4" />,
                        onClick: () => { setForm(emptyForm); setShowForm(true) },
                        permission: hasPermission('estoque.movement.create'),
                    },
                ]}
            />

            <div className="flex flex-wrap gap-3">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text" value={search}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Buscar por produto..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setTypeFilter(e.target.value); setPage(1) }}
                    title="Filtrar por tipo de movimentação"
                    className="rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                    <option value="">Todos os tipos</option>
                    <option value="entry">Entrada</option>
                    <option value="exit">Saída</option>
                    <option value="reserve">Reserva</option>
                    <option value="return">Devolução</option>
                    <option value="adjustment">Ajuste</option>
                </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Data</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Produto</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Local</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Tipo</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Quantidade</th>
                            <th className="hidden px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500 md:table-cell">Custo Unit.</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500 lg:table-cell">Referência</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500 lg:table-cell">Usuário</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : movements.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-surface-500">
                                <div className="flex flex-col items-center gap-2">
                                    <Package className="h-8 w-8 text-surface-300" />
                                    Nenhuma movimentação encontrada
                                </div>
                            </td></tr>
                        ) : movements.map(m => {
                            const conf = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.adjustment
                            const Icon = conf.icon
                            return (
                                <tr key={m.id} className="hover:bg-surface-50 transition-colors duration-100">
                                    <td className="px-4 py-3 text-sm text-surface-600 whitespace-nowrap">{formatDate(m.created_at)}</td>
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-surface-900">{m.product?.name}</p>
                                            {m.product?.code && <p className="text-xs text-surface-400">#{m.product.code}</p>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-surface-600 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3 text-surface-400" />
                                            {m.warehouse?.name ?? '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', conf.color)}>
                                                <Icon className="h-3.5 w-3.5" />
                                            </div>
                                            <Badge variant={conf.badgeVariant}>{conf.label}</Badge>
                                        </div>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right text-sm font-medium text-surface-900">
                                        {m.type === 'entry' || m.type === 'return' ? '+' : m.type === 'exit' || m.type === 'reserve' ? '-' : ''}
                                        {parseFloat(m.quantity)}
                                    </td>
                                    <td className="hidden px-3.5 py-2.5 text-right text-sm text-surface-600 md:table-cell">
                                        {parseFloat(m.unit_cost) > 0 ? formatBRL(m.unit_cost) : '—'}
                                    </td>
                                    <td className="hidden px-4 py-3 text-sm text-surface-600 lg:table-cell">
                                        {(m.reference || m.work_order) ? (
                                            <span className="flex items-center gap-1">
                                                <Wrench className="h-3 w-3" />
                                                {m.reference || `OS #${woIdentifier(m.work_order)}`}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td className="hidden px-4 py-3 text-sm text-surface-500 lg:table-cell">
                                        {m.created_by_user?.name ?? '—'}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {pagination.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-subtle px-4 py-3">
                        <p className="text-xs text-surface-500">Página {pagination.current_page} de {pagination.last_page}</p>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                            <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                        </div>
                    </div>
                )}
            </div>

            <Modal open={showForm} onOpenChange={setShowForm} title="Nova Movimentação" size="md">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Produto</label>
                        <select
                            value={form.product_id}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('product_id', e.target.value)}
                            required
                            title="Produto"
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        >
                            <option value="">Selecione um produto</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (#${p.code})` : ''}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Depósito / Veículo</label>
                        <select
                            value={form.warehouse_id}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('warehouse_id', e.target.value)}
                            required
                            title="Depósito / Veículo"
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        >
                            <option value="">Selecione um local</option>
                            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo</label>
                            <select
                                value={form.type}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('type', e.target.value as MovementFormType)}
                                title="Tipo de movimentação"
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            >
                                <option value="entry">Entrada</option>
                                <option value="exit">Saída</option>
                                <option value="reserve">Reserva</option>
                                <option value="return">Devolução</option>
                                <option value="adjustment">Ajuste</option>
                            </select>
                        </div>
                        <Input label="Quantidade" type="number" step="0.01" min="0.01" value={form.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('quantity', e.target.value)} required />
                    </div>
                    <Input label="Custo Unitário (R$)" type="number" step="0.01" value={form.unit_cost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('unit_cost', e.target.value)} />
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Observações</label>
                        <textarea
                            value={form.notes}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('notes', e.target.value)}
                            rows={2}
                            placeholder="Motivo da movimentação..."
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        />
                    </div>
                    {saveMut.isError && (
                        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                            Erro ao salvar movimentação. Verifique os dados e tente novamente.
                        </div>
                    )}
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>Registrar</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={showXmlModal} onOpenChange={setShowXmlModal} title="Importação de NF-e (XML)" size="md">
                <form onSubmit={handleXmlSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Arquivo XML da NF-e</label>
                        <input
                            type="file"
                            accept=".xml"
                            title="Arquivo XML da NF-e"
                            onChange={(e) => setXmlFile(e.target.files?.[0] || null)}
                            required
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Depósito para entrada</label>
                        <select
                            value={xmlWarehouseId}
                            onChange={(e) => setXmlWarehouseId(e.target.value)}
                            required
                            title="Depósito para entrada"
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        >
                            <option value="">Selecione um local</option>
                            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div className="rounded-lg bg-surface-50 p-3 text-xs text-surface-500 italic">
                        Nota: O sistema tentará localizar os produtos pelo código (cProd) indicado na nota.
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowXmlModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={importXmlMut.isPending} disabled={!xmlFile || !xmlWarehouseId}>
                            Processar XML
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
