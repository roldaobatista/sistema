import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    PackageSearch, ArrowLeft, Loader2, Search,
    ScanLine, CheckCircle2, AlertTriangle, Save,
    ClipboardCheck, History, Info
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

export default function InventoryExecutionPage() {
  const { hasPermission } = useAuthStore()

    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [counts, setCounts] = useState<Record<number, string>>({})

    const { data: invRes, isLoading } = useQuery({
        queryKey: ['inventory-detail', id],
        queryFn: () => api.get(`/inventory/inventories/${id}`)
    })
    const inventory = invRes?.data

    const updateItemMut = useMutation({
        mutationFn: ({ itemId, quantity }: { itemId: number, quantity: number }) =>
            api.put(`/inventory/inventories/${id}/items/${itemId}`, { counted_quantity: quantity }),
        onSuccess: () => {
            toast.success('Contagem salva!')
            qc.invalidateQueries({ queryKey: ['inventory-detail', id] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar')
    })

    const completeMut = useMutation({
        mutationFn: () => api.post(`/inventory/inventories/${id}/complete`),
        onSuccess: () => {
            toast.success('Inventário finalizado com sucesso!')
            navigate('/estoque/inventarios')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao finalizar')
    })

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p className="text-surface-500 animate-pulse font-medium">Carregando sessão de inventário...</p>
            </div>
        )
    }

    const filteredItems = inventory?.items.filter((item: any) =>
        item.product.name.toLowerCase().includes(search.toLowerCase()) ||
        item.product.sku?.toLowerCase().includes(search.toLowerCase())
    ) || []

    const itemsPending = inventory?.items.filter((i: any) => i.counted_quantity === null).length || 0

    return (
        <div className="flex flex-col min-h-screen bg-surface-50 dark:bg-surface-950 pb-24">
            {/* Header Fixo */}
            <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 sticky top-0 z-10 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button title="Voltar para listagem" onClick={() => navigate('/estoque/inventarios')} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-surface-500" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                                {inventory?.reference || `Inventário #${id}`}
                                {inventory?.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                            </h1>
                            <p className="text-xs text-surface-500">{inventory?.warehouse?.name} • Blind Audit Mode</p>
                        </div>
                    </div>

                    {inventory?.status === 'open' && (
                        <button
                            onClick={() => {
                                if (itemsPending > 0) {
                                    toast.error(`Existem ${itemsPending} itens sem contagem.`);
                                    return;
                                }
                                completeMut.mutate();
                            }}
                            disabled={completeMut.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {completeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                            Finalizar Inventário
                        </button>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-5xl mx-auto w-full p-4 lg:p-6 space-y-6">
                {/* Alerta de Auditoria */}
                {inventory?.status === 'open' && (
                    <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/30 p-4 rounded-2xl flex items-start gap-4">
                        <div className="bg-brand-500 p-2 rounded-xl">
                            <Info className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-brand-900 dark:text-brand-400">Modo Auditoria Cega Ativo</h4>
                            <p className="text-xs text-brand-800/70 dark:text-brand-400/60 mt-0.5">
                                As quantidades esperadas pelo sistema estão ocultas para evitar erros e fraudes na contagem.
                            </p>
                        </div>
                    </div>
                )}

                {/* Busca e filtros */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 group-focus-within:text-brand-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar produto por nome ou SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-base"
                    />
                    <button
                        title="Escanear Código de Barras"
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl"
                    >
                        <ScanLine className="w-5 h-5 text-surface-400" />
                    </button>
                </div>

                {/* Lista de Itens */}
                <div className="grid gap-4">
                    {filteredItems.map((item: any) => (
                        <div
                            key={item.id}
                            className={cn(
                                "bg-white dark:bg-surface-900 p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-6",
                                item.counted_quantity !== null ? "border-emerald-100 dark:border-emerald-900/20 bg-emerald-50/20" : "border-surface-200 dark:border-surface-800"
                            )}
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 rounded-xl bg-surface-50 dark:bg-surface-800 flex items-center justify-center text-surface-400 border border-surface-100 dark:border-surface-700">
                                    <PackageSearch className="w-6 h-6" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-surface-900 dark:text-surface-50 truncate">{item.product.name}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                                        <span>SKU: {item.product.sku || 'N/I'}</span>
                                        {item.batch && (
                                            <span className="bg-amber-100 text-amber-700 px-1.5 rounded">LT: {item.batch.number}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-auto">
                                <div className="text-right">
                                    <label className="block text-[10px] font-bold text-surface-400 uppercase mb-1">Qtd. Contada</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={counts[item.id] ?? (item.counted_quantity || '')}
                                            onChange={(e) => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            disabled={inventory?.status !== 'open' || updateItemMut.isPending}
                                            className="w-24 text-right px-3 py-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg font-bold text-surface-900 dark:text-surface-50 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                            placeholder="0.00"
                                        />
                                        {inventory?.status === 'open' && (
                                            <button
                                                onClick={() => updateItemMut.mutate({ itemId: item.id, quantity: Number(counts[item.id] || 0) })}
                                                disabled={updateItemMut.isPending}
                                                title="Salvar Contagem"
                                                className="p-2 bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-600 hover:text-white transition-all active:scale-90"
                                            >
                                                {updateItemMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredItems.length === 0 && (
                        <div className="py-20 text-center text-surface-500">
                            Nenhum item corresponde à sua busca.
                        </div>
                    )}
                </div>
            </main>

            {/* Resumo Rodapé Mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800 p-4 md:hidden safe-area-bottom">
                <div className="flex items-center justify-between px-2 mb-3">
                    <span className="text-xs text-surface-500">Progresso da Contagem:</span>
                    <span className="text-xs font-bold text-brand-600">{inventory?.items.length - itemsPending}/{inventory?.items.length}</span>
                </div>
                <div className="h-1.5 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full bg-brand-500 transition-all duration-500 w-[${Math.round(((inventory?.items.length - itemsPending) / (inventory?.items.length || 1)) * 100)}%]`}
                    />
                </div>
            </div>
        </div>
    )
}
