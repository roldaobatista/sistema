import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    PackageSearch, ArrowLeft, Loader2, Warehouse,
    ClipboardList, AlertCircle, PlayCircle
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'

export default function InventoryCreatePage() {
    const navigate = useNavigate()
    const [warehouseId, setWarehouseId] = useState('')
    const [reference, setReference] = useState('')

    const { data: warehousesRes, isLoading: loadingWarehouses } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => api.get('/inventory/warehouses')
    })
    const warehouses = warehousesRes?.data || []

    const createMut = useMutation({
        mutationFn: (data: any) => api.post('/inventory/inventories', data),
        onSuccess: (res) => {
            toast.success('Sessão de inventário iniciada!')
            navigate(`/estoque/inventarios/${res.data.data.id}`)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao iniciar inventário')
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!warehouseId) {
            toast.error('Selecione um depósito para o inventário.')
            return
        }
        createMut.mutate({
            warehouse_id: warehouseId,
            reference: reference
        })
    }

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <button
                onClick={() => navigate('/estoque/inventarios')}
                className="flex items-center gap-2 text-sm text-surface-500 hover:text-brand-600 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Voltar para Listagem
            </button>

            <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
                <div className="bg-brand-600 p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <PackageSearch className="w-10 h-10 mb-4 opacity-80" />
                        <h1 className="text-2xl font-bold">Iniciar Novo Inventário</h1>
                        <p className="text-brand-100 text-sm mt-1">Configure a sessão de auditoria e contagem blindada.</p>
                    </div>
                    {/* Pattern Decorativo */}
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Warehouse className="w-32 h-32 rotate-12" />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-surface-400 uppercase flex items-center gap-2">
                                <Warehouse className="w-4 h-4" /> Depósito para Auditoria
                            </label>
                            <select
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                                title="Depósito para Auditoria"
                                className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                                required
                            >
                                <option value="">Selecione um depósito...</option>
                                {warehouses.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-surface-400 uppercase flex items-center gap-2">
                                <ClipboardList className="w-4 h-4" /> Referência / Nome (Opcional)
                            </label>
                            <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Ex: Inventário Mensal de Fevereiro"
                                className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
                            Ao iniciar, o sistema tirará uma foto instantly do estoque atual. Qualquer movimentação realizada após o início não será considerada na expectativa original desta auditoria.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={createMut.isPending || loadingWarehouses}
                        className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-brand-500/25 disabled:opacity-50"
                    >
                        {createMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                        Começar Contagem Blindada
                    </button>
                </form>
            </div>
        </div>
    )
}
