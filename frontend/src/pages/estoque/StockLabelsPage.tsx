import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Printer, Package, Loader2, Eye, Search } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'

interface LabelFormat {
    key: string
    name: string
    width_mm: number
    height_mm: number
    output: string
}

interface Product {
    id: number
    name: string
    code: string | null
    category?: { id: number; name: string } | null
}

interface ProductCategory {
    id: number
    name: string
}

export default function StockLabelsPage() {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [quantityByProduct, setQuantityByProduct] = useState<Record<number, number>>({})
    const [formatKey, setFormatKey] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [showLogo, setShowLogo] = useState(true)
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState<string>('')
    const [storageLocation, setStorageLocation] = useState('')

    const { data: formatsRes } = useQuery({
        queryKey: ['stock-label-formats'],
        queryFn: () => api.get<{ data: LabelFormat[] }>('/stock/labels/formats'),
    })
    const formats: LabelFormat[] = formatsRes?.data?.data ?? []

    const { data: categoriesRes } = useQuery({
        queryKey: ['product-categories'],
        queryFn: () => api.get<{ data?: ProductCategory[] }>('/product-categories'),
    })
    const categories: ProductCategory[] = Array.isArray(categoriesRes?.data?.data) ? categoriesRes.data.data : (categoriesRes?.data as any)?.data ?? []

    useEffect(() => {
        if (formats.length && !formatKey) setFormatKey(formats[0].key)
    }, [formats.length, formatKey])

    const { data: productsRes } = useQuery({
        queryKey: ['products-labels', search, categoryId || null, storageLocation || null],
        queryFn: () => {
            const params: Record<string, string | number | boolean> = { per_page: 500, is_active: true }
            if (search.trim()) params.search = search.trim()
            if (categoryId) params.category_id = categoryId
            if (storageLocation.trim()) params.storage_location = storageLocation.trim()
            return api.get<{ data?: Product[] }>('/products', { params })
        },
    })
    const products: Product[] = Array.isArray(productsRes?.data?.data) ? productsRes.data.data : (productsRes?.data as any)?.data ?? []

    const previewMut = useMutation({
        mutationFn: async (productId: number) => {
            const res = await api.get('/stock/labels/preview', {
                params: { product_id: productId, format_key: formatKey, show_logo: showLogo ? '1' : '0' },
                responseType: 'blob',
            })
            return res.data as Blob
        },
        onSuccess: (data) => {
            const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
            window.open(url, '_blank')
            setTimeout(() => URL.revokeObjectURL(url), 60000)
            toast.success('Preview aberto em nova aba.')
        },
        onError: async (err: any) => {
            const data = err?.response?.data
            if (data instanceof Blob) {
                try {
                    const text = await data.text()
                    const parsed = JSON.parse(text) as { message?: string }
                    toast.error(parsed?.message ?? 'Erro ao gerar preview.')
                } catch {
                    toast.error('Erro ao gerar preview.')
                }
            } else {
                const msg = typeof data?.message === 'string' ? data.message : null
                toast.error(msg ?? 'Erro ao gerar preview.')
            }
        },
    })

    const generateMut = useMutation({
        mutationFn: async () => {
            const format = formats.find((f) => f.key === formatKey)
            const items = Array.from(selectedIds).map((id) => ({
                product_id: id,
                quantity: quantityByProduct[id] ?? quantity,
            }))
            const res = await api.post(
                '/stock/labels/generate',
                { items, format_key: formatKey, show_logo: showLogo },
                { responseType: 'blob' }
            )
            return { data: res.data as Blob, output: format?.output ?? 'pdf' }
        },
        onSuccess: (result) => {
            const { data, output } = result as { data: Blob; output: string }
            if (output === 'zpl') {
                const url = URL.createObjectURL(new Blob([data], { type: 'text/plain' }))
                const a = document.createElement('a')
                a.href = url
                a.download = 'etiquetas.zpl'
                a.click()
                URL.revokeObjectURL(url)
                toast.success('Arquivo ZPL baixado. Envie para a impressora térmica.')
            } else {
                const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
                window.open(url, '_blank')
                setTimeout(() => URL.revokeObjectURL(url), 60000)
                toast.success('PDF aberto em nova aba. Use Imprimir do navegador.')
            }
        },
        onError: async (err: any) => {
            const data = err?.response?.data
            if (data instanceof Blob) {
                try {
                    const text = await data.text()
                    const parsed = JSON.parse(text) as { message?: string }
                    toast.error(parsed?.message ?? 'Erro ao gerar etiquetas.')
                } catch {
                    toast.error('Erro ao gerar etiquetas.')
                }
            } else {
                const msg = typeof data?.message === 'string' ? data.message : null
                toast.error(msg ?? 'Erro ao gerar etiquetas.')
            }
        },
    })

    const toggleProduct = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAll = () => {
        if (selectedIds.size === products.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(products.map((p) => p.id)))
    }

    if (!formats.length) {
        return (
            <div className="space-y-4">
                <PageHeader title="Etiquetas de estoque" subtitle="Imprimir etiquetas com QR para OS, inventário e transferência" />
                <p className="text-surface-500">Nenhum formato de etiqueta configurado.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Etiquetas de estoque"
                subtitle="Selecione os produtos, o formato e imprima. O QR code permite usar na OS, inventário e transferência."
            />

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-default bg-surface-0 p-5">
                    <h3 className="text-sm font-semibold text-surface-900 mb-3">Produtos</h3>
                    <div className="space-y-2 mb-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" aria-hidden />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nome ou código"
                                className="w-full pl-8 pr-3 py-2 rounded-lg border border-default bg-surface-50 text-sm"
                                aria-label="Buscar produtos"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                                aria-label="Filtrar por categoria"
                            >
                                <option value="">Todas as categorias</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={storageLocation}
                                onChange={(e) => setStorageLocation(e.target.value)}
                                placeholder="Endereço no estoque"
                                className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                                aria-label="Filtrar por endereço"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={selectAll} className="text-sm text-brand-600 hover:underline">
                            {selectedIds.size === products.length ? 'Desmarcar todos' : 'Selecionar todos'}
                        </button>
                        <span className="text-xs text-surface-500">{selectedIds.size} selecionado(s)</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1 border border-default rounded-lg p-2">
                        {products.length === 0 ? (
                            <p className="text-sm text-surface-500 py-4 text-center">Nenhum produto disponível.</p>
                        ) : (
                            products.map((p) => (
                                <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-surface-50 rounded">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(p.id)}
                                        onChange={() => toggleProduct(p.id)}
                                        className="rounded border-default text-brand-600"
                                        aria-label={`Selecionar ${p.name}`}
                                    />
                                    <span className="text-sm truncate flex-1 min-w-0">{p.name}</span>
                                    {p.code && <span className="text-xs text-surface-400 shrink-0">#{p.code}</span>}
                                    {selectedIds.has(p.id) && (
                                        <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={quantityByProduct[p.id] ?? quantity}
                                            onChange={(e) => setQuantityByProduct((prev) => ({ ...prev, [p.id]: Math.max(1, Number(e.target.value) || 1) }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-14 rounded border border-default bg-surface-0 px-1.5 py-0.5 text-sm text-right"
                                            aria-label={`Qtd etiquetas ${p.name}`}
                                        />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-default bg-surface-0 p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-surface-900">Formato e quantidade</h3>
                    <div>
                        <label className="block text-xs font-medium text-surface-600 mb-1">Formato da etiqueta</label>
                        <select
                            aria-label="Formato da etiqueta"
                            value={formatKey}
                            onChange={(e) => setFormatKey(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                        >
                            {formats.map((f) => (
                                <option key={f.key} value={f.key}>
                                    {f.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-surface-600 mb-1">Quantidade padrão (novos selecionados)</label>
                        <input
                            type="number"
                            min={1}
                            max={100}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                            aria-label="Quantidade padrão"
                            placeholder="1"
                        />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showLogo}
                            onChange={(e) => setShowLogo(e.target.checked)}
                            className="rounded border-default text-brand-600"
                        />
                        <span className="text-sm text-surface-700">Exibir logo da empresa</span>
                    </label>
                    {formats.find((f) => f.key === formatKey)?.output === 'zpl' && (
                        <p className="text-xs text-amber-600">⚠ Logo aparece apenas em etiquetas PDF, não em ZPL.</p>
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                const one = Array.from(selectedIds)[0]
                                if (selectedIds.size !== 1 || one == null) {
                                    toast.error('Selecione exatamente um produto para visualizar.')
                                    return
                                }
                                previewMut.mutate(one)
                            }}
                            disabled={previewMut.isPending || selectedIds.size !== 1}
                            className="flex-1"
                        >
                            {previewMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                            Visualizar
                        </Button>
                        <Button
                            onClick={() => {
                                if (selectedIds.size === 0) {
                                    toast.error('Selecione ao menos um produto.')
                                    return
                                }
                                generateMut.mutate()
                            }}
                            disabled={generateMut.isPending || selectedIds.size === 0}
                            className="flex-1"
                        >
                            {generateMut.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Printer className="w-4 h-4 mr-2" />
                                    Gerar e imprimir
                                </>
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-surface-500">
                        PDF abre em nova aba; ZPL é baixado para envio à impressora Zebra.
                    </p>
                </div>
            </div>
        </div>
    )
}
