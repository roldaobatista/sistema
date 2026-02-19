import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Calendar } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

interface DeliveryForecastProps {
    workOrderId: number
    currentForecast?: string | null
}

export default function DeliveryForecast({ workOrderId, currentForecast }: DeliveryForecastProps) {
    const qc = useQueryClient()
    const [date, setDate] = useState(currentForecast ?? '')
    const [editing, setEditing] = useState(false)

    const saveMut = useMutation({
        mutationFn: (delivery_forecast: string) =>
            api.put(`/work-orders/${workOrderId}`, { delivery_forecast }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', workOrderId] })
            toast.success('Previsão atualizada')
            setEditing(false)
        },
        onError: () => toast.error('Erro ao atualizar previsão'),
    })

    const formatDate = (d: string) =>
        new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    const isOverdue = date && new Date(date) < new Date()

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-brand-500" />
                Previsão de Entrega
            </h3>

            {editing ? (
                <div className="flex gap-2">
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        aria-label="Data de previsão de entrega"
                        className="flex-1 rounded-lg border border-subtle bg-surface-50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                    <button
                        onClick={() => date && saveMut.mutate(date)}
                        disabled={!date || saveMut.isPending}
                        className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                        Salvar
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setEditing(true)}
                    className="w-full text-left"
                >
                    {date ? (
                        <div className="flex items-center gap-2">
                            <Calendar className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-emerald-500'}`} />
                            <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-surface-700'}`}>
                                {formatDate(date)}
                            </span>
                            {isOverdue && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Atrasado</span>
                            )}
                        </div>
                    ) : (
                        <span className="text-xs text-surface-400 hover:text-brand-500">
                            + Definir previsão de entrega
                        </span>
                    )}
                </button>
            )}
        </div>
    )
}
