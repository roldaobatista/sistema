import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Phone, Clock, AlertTriangle, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const statusLabels: Record<string, { label: string; color: string }> = {
    open: { label: 'Aberto', color: '#3b82f6' },
    scheduled: { label: 'Agendado', color: '#f59e0b' },
    en_route: { label: 'A Caminho', color: '#8b5cf6' },
    in_progress: { label: 'Em Atend.', color: '#ef4444' },
    completed: { label: 'Concluído', color: '#22c55e' },
    cancelled: { label: 'Cancelado', color: '#6b7280' },
}

const priorityColors: Record<string, string> = {
    low: '#94a3b8', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444',
}

export function ServiceCallMapPage() {
    const navigate = useNavigate()
    const [statusFilter, setStatusFilter] = useState<string>('')

    const { data: res, isLoading } = useQuery({
        queryKey: ['service-calls-map', statusFilter],
        queryFn: () => api.get('/service-calls/map-data', { params: statusFilter ? { status: statusFilter } : {} }),
    })

    const calls = res?.data ?? []

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/chamados')} className="rounded-lg p-1.5 hover:bg-surface-100">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-surface-900">Mapa de Chamados</h1>
                        <p className="text-sm text-surface-500">{calls.length} chamados com localização</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                        <option value="">Todos os status</option>
                        {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="py-16 text-center text-sm text-surface-500">Carregando mapa...</div>
            ) : calls.length === 0 ? (
                <div className="rounded-xl border border-surface-200 bg-white p-12 text-center shadow-card">
                    <MapPin className="mx-auto h-12 w-12 text-surface-300" />
                    <p className="mt-3 text-sm text-surface-500">Nenhum chamado com localização disponível</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {calls.map((call: any) => {
                        const st = statusLabels[call.status] ?? statusLabels.open
                        return (
                            <div key={call.id} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <span className="text-xs font-mono text-surface-400">{call.call_number}</span>
                                        <p className="text-sm font-semibold text-surface-900">{call.customer?.name}</p>
                                    </div>
                                    <Badge variant={call.status === 'completed' ? 'success' : call.status === 'cancelled' ? 'danger' : call.status === 'in_progress' ? 'warning' : 'info'}>
                                        {st.label}
                                    </Badge>
                                </div>
                                <p className="text-xs text-surface-600 line-clamp-2 mb-3">{call.description}</p>
                                <div className="flex items-center gap-4 text-xs text-surface-500">
                                    {call.customer?.phone && (
                                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{call.customer.phone}</span>
                                    )}
                                    {call.latitude && call.longitude && (
                                        <a href={`https://www.google.com/maps?q=${call.latitude},${call.longitude}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-brand-600 hover:underline">
                                            <MapPin className="h-3 w-3" />Ver no Maps
                                        </a>
                                    )}
                                </div>
                                {call.priority === 'urgent' && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                                        <AlertTriangle className="h-3 w-3" />Urgente
                                    </div>
                                )}
                                {call.technician && (
                                    <p className="mt-2 text-xs text-surface-500">Técnico: <span className="font-medium text-surface-700">{call.technician.name}</span></p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Legenda */}
            <div className="flex flex-wrap gap-3">
                {Object.entries(statusLabels).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5 text-xs text-surface-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                        {v.label}
                    </div>
                ))}
            </div>
        </div>
    )
}
