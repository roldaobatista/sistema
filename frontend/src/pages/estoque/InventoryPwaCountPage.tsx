import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Package, AlertTriangle, Save, QrCode } from 'lucide-react'
import { parseLabelQrPayload } from '@/lib/labelQr'
import { QrScannerModal } from '@/components/qr/QrScannerModal'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ProductItem {
    product_id: number
    product: { id: number; name: string; code?: string; unit?: string }
    expected_quantity: number
}

export default function InventoryPwaCountPage() {
    const { warehouseId } = useParams<{ warehouseId: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [counts, setCounts] = useState<Record<number, string>>({})
    const [showQrScanner, setShowQrScanner] = useState(false)

    const id = Number(warehouseId)
    const { data: productsRes, isLoading } = useQuery({
        queryKey: ['inventory-pwa', 'warehouse-products', id],
        queryFn: () => api.get<{ data: ProductItem[] }>(`/stock/inventory-pwa/warehouses/${id}/products`),
        enabled: Number.isFinite(id),
    })

    const products: ProductItem[] = productsRes?.data?.data ?? []

    const submitMut = useMutation({
        mutationFn: (payload: { warehouse_id: number; items: Array<{ product_id: number; counted_quantity: number }> }) =>
            api.post('/stock/inventory-pwa/submit-counts', payload),
        onSuccess: (res: { data?: { message?: string; has_discrepancy?: boolean } }) => {
            toast.success(res?.data?.message ?? 'Contagem enviada.')
            queryClient.invalidateQueries({ queryKey: ['inventory-pwa'] })
            if (res?.data?.has_discrepancy) {
                toast.warning('Foi detectada diferença em relação ao esperado. O responsável foi notificado.')
            }
            navigate('/estoque/inventario-pwa')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao enviar contagem.')
        },
    })

    const handleSubmit = () => {
        const items = products.map((p) => ({
            product_id: p.product_id,
            counted_quantity: Number(counts[p.product_id] ?? p.expected_quantity) || 0,
        }))
        submitMut.mutate({ warehouse_id: id, items })
    }

    const filledCount = products.filter((p) => counts[p.product_id] !== undefined && counts[p.product_id] !== '').length
    const totalCount = products.length
    const allFilled = totalCount > 0 && filledCount === totalCount

    const handleScanLabel = () => setShowQrScanner(true)

    const handleQrScanned = (raw: string) => {
        const productId = parseLabelQrPayload(raw)
        if (!productId) {
            toast.error('Código inválido.')
            return
        }
        const found = products.some((p) => p.product_id === productId)
        if (!found) {
            toast.error('Este produto não está na lista deste armazém.')
            return
        }
        document.getElementById(`product-row-${productId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    if (isLoading || !Number.isFinite(id)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p className="text-surface-500 font-medium">Carregando produtos...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen bg-surface-50 pb-28">
            <header className="bg-surface-0 border-b border-default sticky top-0 z-10 px-4 py-3">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/estoque/inventario-pwa')}
                        className="p-2 hover:bg-surface-100 rounded-full transition-colors"
                        aria-label="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-surface-900">Contagem</h1>
                        <p className="text-xs text-surface-500">Informe a quantidade contada de cada item</p>
                    </div>
                    {products.length > 0 && (
                        <button
                            type="button"
                            onClick={handleScanLabel}
                            className="p-2 hover:bg-surface-100 rounded-full transition-colors"
                            title="Escanear etiqueta"
                            aria-label="Escanear etiqueta"
                        >
                            <QrCode className="w-5 h-5 text-surface-600" />
                        </button>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-4">
                {products.length === 0 ? (
                    <div className="rounded-xl border border-default bg-surface-0 p-8 text-center text-surface-500">
                        Nenhum produto neste armazém para contagem.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {products.map((item) => (
                            <div
                                id={`product-row-${item.product_id}`}
                                key={item.product_id}
                                className={cn(
                                    'rounded-xl border bg-surface-0 p-4',
                                    counts[item.product_id] !== undefined && counts[item.product_id] !== ''
                                        ? 'border-emerald-200 bg-emerald-50/30'
                                        : 'border-default'
                                )}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 rounded-lg bg-surface-100 shrink-0">
                                            <Package className="w-5 h-5 text-surface-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-surface-900 truncate">{item.product.name}</p>
                                            <p className="text-xs text-surface-500">
                                                {item.product.code ?? '—'} • Esperado: {Number(item.expected_quantity)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <label className="sr-only">Quantidade contada</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="any"
                                            value={counts[item.product_id] ?? ''}
                                            onChange={(e) =>
                                                setCounts((prev) => ({ ...prev, [item.product_id]: e.target.value }))
                                            }
                                            placeholder="0"
                                            className="w-20 text-right px-3 py-2 border border-default rounded-lg font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                        />
                                        {item.product.unit && (
                                            <span className="text-xs text-surface-500 w-6">{item.product.unit}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 bg-surface-0 border-t border-default p-4 safe-area-bottom">
                <div className="max-w-2xl mx-auto flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-surface-500">Itens preenchidos</span>
                        <span className="font-medium text-brand-600">
                            {filledCount}/{totalCount}
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-brand-500 transition-all duration-300"
                            style={{ width: `${totalCount ? (filledCount / totalCount) * 100 : 0}%` }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitMut.isPending || products.length === 0}
                        className={cn(
                            'w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2',
                            allFilled
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-brand-600 hover:bg-brand-700 text-white',
                            (submitMut.isPending || products.length === 0) && 'opacity-60 cursor-not-allowed'
                        )}
                    >
                        {submitMut.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Enviar contagem
                            </>
                        )}
                    </button>
                    {!allFilled && products.length > 0 && (
                        <p className="text-xs text-surface-500 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Preencha todos os itens antes de enviar para maior precisão.
                        </p>
                    )}
                </div>
            </div>

            <QrScannerModal
                open={showQrScanner}
                onClose={() => setShowQrScanner(false)}
                onScan={handleQrScanned}
                title="Escanear etiqueta"
            />
        </div>
    )
}
