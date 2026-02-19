import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import type { ServiceCall, ServiceCallStatus } from '@/types/service-call'
import { STATUS_TRANSITIONS } from '@/types/service-call'
import { GripVertical, User, Clock, AlertTriangle, MapPin, ArrowRight } from 'lucide-react'

const KANBAN_COLUMNS: { key: ServiceCallStatus; label: string; color: string }[] = [
    { key: 'open', label: 'Aberto', color: '#3b82f6' },
    { key: 'scheduled', label: 'Agendado', color: '#8b5cf6' },
    { key: 'in_transit', label: 'Em Trânsito', color: '#f59e0b' },
    { key: 'in_progress', label: 'Em Atendimento', color: '#ef4444' },
    { key: 'completed', label: 'Concluído', color: '#22c55e' },
    { key: 'cancelled', label: 'Cancelado', color: '#6b7280' },
]

const PRIORITY_BADGE: Record<string, { bg: string; text: string }> = {
    low: { bg: '#f3f4f6', text: '#374151' },
    normal: { bg: '#dbeafe', text: '#1d4ed8' },
    high: { bg: '#fef3c7', text: '#92400e' },
    urgent: { bg: '#fee2e2', text: '#991b1b' },
}

export default function ServiceCallKanbanPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [draggedId, setDraggedId] = useState<number | null>(null)
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

    const { data: calls = [], isLoading } = useQuery<ServiceCall[]>({
        queryKey: ['service-calls-kanban'],
        queryFn: async () => {
            const { data } = await api.get('/service-calls', { params: { per_page: 200 } })
            return data.data ?? data
        },
    })

    const statusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: number; status: string }) => {
            const { data } = await api.put(`/service-calls/${id}/status`, { status })
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['service-calls-kanban'] })
            queryClient.invalidateQueries({ queryKey: ['service-calls'] })
            broadcastQueryInvalidation(['service-calls-kanban', 'service-calls', 'service-calls-summary'], 'Chamado')
            toast.success('Status atualizado')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao atualizar status')
        },
    })

    const groupedByStatus = KANBAN_COLUMNS.map(col => ({
        ...col,
        items: calls.filter(c => c.status === col.key),
    }))

    const handleDragStart = (id: number) => setDraggedId(id)
    const handleDragEnd = () => { setDraggedId(null); setDragOverColumn(null) }
    const handleDragOver = (e: React.DragEvent, colKey: string) => {
        e.preventDefault()
        setDragOverColumn(colKey)
    }
    const handleDrop = (colKey: string) => {
        if (draggedId !== null) {
            const current = calls.find(c => c.id === draggedId)
            if (current && current.status !== colKey) {
                const allowed = STATUS_TRANSITIONS[current.status as keyof typeof STATUS_TRANSITIONS] ?? []
                if (allowed.includes(colKey as any)) {
                    statusMutation.mutate({ id: draggedId, status: colKey })
                } else {
                    toast.error('Transição de status não permitida')
                }
            }
        }
        setDraggedId(null)
        setDragOverColumn(null)
    }

    const getSlaIndicator = (call: ServiceCall) => {
        if (call.sla_breached) return { color: '#ef4444', label: 'SLA Estourado' }
        if (call.sla_remaining_minutes !== null && call.sla_remaining_minutes <= 240) return { color: '#f59e0b', label: `${Math.round(call.sla_remaining_minutes / 60)}h restantes` }
        return null
    }

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Kanban — Chamados</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>{calls.length} chamados no pipeline</p>
                </div>
                <button
                    onClick={() => navigate('/chamados')}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    Voltar à Lista
                </button>
            </div>

            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, minHeight: 'calc(100vh - 200px)' }}>
                {groupedByStatus.map(col => (
                    <div
                        key={col.key}
                        onDragOver={e => handleDragOver(e, col.key)}
                        onDrop={() => handleDrop(col.key)}
                        style={{
                            minWidth: 280,
                            maxWidth: 320,
                            flex: '1 1 0',
                            background: dragOverColumn === col.key ? '#f0f9ff' : '#f9fafb',
                            borderRadius: 12,
                            border: dragOverColumn === col.key ? '2px dashed #3b82f6' : '1px solid #e5e7eb',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {/* Column Header */}
                        <div style={{ padding: '16px 16px 12px', borderBottom: '2px solid ' + col.color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                                <span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>{col.label}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#e5e7eb', borderRadius: 10, padding: '2px 8px' }}>
                                {col.items.length}
                            </span>
                        </div>

                        {/* Cards */}
                        <div style={{ padding: 8, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {col.items.map(call => {
                                const sla = getSlaIndicator(call)
                                const pb = PRIORITY_BADGE[call.priority] || PRIORITY_BADGE.normal
                                return (
                                    <div
                                        key={call.id}
                                        draggable
                                        onDragStart={() => handleDragStart(call.id)}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => navigate(`/chamados/${call.id}`)}
                                        style={{
                                            background: 'white',
                                            borderRadius: 10,
                                            padding: 14,
                                            border: '1px solid #e5e7eb',
                                            cursor: 'grab',
                                            opacity: draggedId === call.id ? 0.5 : 1,
                                            transition: 'box-shadow 0.15s, opacity 0.15s',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>#{call.call_number}</span>
                                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: pb.bg, color: pb.text }}>
                                                {call.priority === 'urgent' ? '🔥 ' : ''}{call.priority?.toUpperCase()}
                                            </span>
                                        </div>

                                        {call.customer && (
                                            <p style={{ fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: 500 }}>
                                                {call.customer.name}
                                            </p>
                                        )}

                                        {call.city && (
                                            <p style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                                <MapPin size={12} /> {call.city}{call.state ? `/${call.state}` : ''}
                                            </p>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                            {call.technician ? (
                                                <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <User size={12} /> {call.technician.name.split(' ')[0]}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Sem técnico</span>
                                            )}

                                            {call.scheduled_date && (
                                                <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Clock size={11} /> {new Date(call.scheduled_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                            )}
                                        </div>

                                        {sla && (
                                            <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 6, background: sla.color + '15', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <AlertTriangle size={12} color={sla.color} />
                                                <span style={{ fontSize: 11, fontWeight: 600, color: sla.color }}>{sla.label}</span>
                                            </div>
                                        )}

                                        {(call.reschedule_count ?? 0) > 0 && (
                                            <div style={{ marginTop: 4, fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <ArrowRight size={11} /> Reagendado {call.reschedule_count}x
                                            </div>
                                        )}
                                    </div>
                                )
                            })}

                            {col.items.length === 0 && (
                                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>
                                    Nenhum chamado
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
