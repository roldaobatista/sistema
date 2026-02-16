import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Warehouse as WarehouseIcon, ChevronRight, ClipboardCheck, Loader2, Package } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface WarehouseItem {
    id: number
    name: string
    code: string | null
    type: string
    vehicle_id: number | null
    vehicle?: { id: number; plate: string } | null
}

export default function InventoryPwaListPage() {
    const navigate = useNavigate()

    const { data, isLoading, error } = useQuery({
        queryKey: ['inventory-pwa', 'my-warehouses'],
        queryFn: async () => {
            const res = await api.get<{ data: WarehouseItem[] }>('/stock/inventory-pwa/my-warehouses')
            return res.data?.data ?? []
        },
    })

    const warehouses: WarehouseItem[] = data ?? []

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p className="text-surface-500 font-medium">Carregando seus armazéns...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-red-800 font-medium">Não foi possível carregar os armazéns.</p>
                <p className="text-red-600 text-sm mt-1">Verifique sua conexão ou permissões.</p>
            </div>
        )
    }

    if (warehouses.length === 0) {
        return (
            <div className="max-w-lg mx-auto text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-100 mb-4">
                    <WarehouseIcon className="w-8 h-8 text-surface-400" />
                </div>
                <h2 className="text-lg font-bold text-surface-900 mb-2">Nenhum armazém para inventário</h2>
                <p className="text-surface-500 text-sm">
                    Você não possui armazém de técnico ou de veículo atribuído. Entre em contato com o responsável para configurar.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-brand-100 text-brand-600">
                    <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-surface-900">Meu inventário</h1>
                    <p className="text-sm text-surface-500">Selecione o armazém para fazer a contagem</p>
                </div>
            </div>

            <div className="grid gap-3">
                {warehouses.map((wh) => (
                    <button
                        key={wh.id}
                        type="button"
                        onClick={() => navigate(`/estoque/inventario-pwa/${wh.id}`)}
                        className={cn(
                            'w-full flex items-center justify-between p-4 rounded-xl border border-default bg-surface-0',
                            'hover:border-brand-200 hover:bg-brand-50/50 transition-colors text-left'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-surface-100">
                                <Package className="w-5 h-5 text-surface-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-surface-900">{wh.name}</p>
                                <p className="text-xs text-surface-500">
                                    {wh.type === 'vehicle' && wh.vehicle?.plate ? `Veículo: ${wh.vehicle.plate}` : 'Estoque do técnico'}
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-surface-400" />
                    </button>
                ))}
            </div>
        </div>
    )
}
