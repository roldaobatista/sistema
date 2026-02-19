import React, { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
    Wrench, Phone, FileText, DollarSign, BarChart3, CheckCircle, Clock,
    Inbox, Flag, Calendar, UserCheck, MessageSquare, List, GripVertical,
    AlertTriangle, ExternalLink,
} from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

// ── Visual configs ──

const tipoConfig: Record<string, { label: string; icon: any; color: string }> = {
    os: { label: 'OS', icon: Wrench, color: 'text-blue-600 bg-blue-50' },
    chamado: { label: 'Chamado', icon: Phone, color: 'text-cyan-600 bg-cyan-50' },
    orçamento: { label: 'Orçamento', icon: FileText, color: 'text-amber-600 bg-amber-50' },
    financeiro: { label: 'Financeiro', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    calibracao: { label: 'Calibração', icon: BarChart3, color: 'text-indigo-600 bg-indigo-50' },
    contrato: { label: 'Contrato', icon: FileText, color: 'text-rose-600 bg-rose-50' },
    tarefa: { label: 'Tarefa', icon: CheckCircle, color: 'text-surface-600 bg-surface-50' },
    lembrete: { label: 'Lembrete', icon: Clock, color: 'text-surface-500 bg-surface-50' },
    outro: { label: 'Outro', icon: Inbox, color: 'text-surface-500 bg-surface-50' },
}

const prioridadeConfig: Record<string, { label: string; color: string }> = {
    baixa: { label: 'Baixa', color: 'text-surface-500' },
    media: { label: 'Média', color: 'text-blue-600' },
    alta: { label: 'Alta', color: 'text-amber-600' },
    urgente: { label: 'Urgente', color: 'text-red-600' },
}

function normalize(val: string | undefined, fallback: string): string {
    if (!val) return fallback
    return val.toLowerCase().replace(/_/g, '_')
}

interface KanbanColumn {
    key: string
    label: string
    color: string
    bgDrop: string
}

const columns: KanbanColumn[] = [
    { key: 'aberto', label: 'Aberto', color: 'border-blue-400', bgDrop: 'bg-blue-50/50' },
    { key: 'em_andamento', label: 'Em Andamento', color: 'border-amber-400', bgDrop: 'bg-amber-50/50' },
    { key: 'aguardando', label: 'Aguardando', color: 'border-surface-400', bgDrop: 'bg-surface-50/50' },
    { key: 'concluido', label: 'Concluído', color: 'border-emerald-400', bgDrop: 'bg-emerald-50/50' },
]

export function CentralKanbanPage() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const [dragItemId, setDragItemId] = useState<number | null>(null)
    const [dragOverCol, setDragOverCol] = useState<string | null>(null)

    const { data: res, isLoading } = useQuery({
        queryKey: ['central-kanban'],
        queryFn: () => api.get('/central/items', {
            params: { per_page: 200, sort_by: 'prioridade', sort_dir: 'asc' },
        }),
    })

    const allItems: any[] = res?.data?.data ?? []

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/central/items/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['central-kanban'] })
            qc.invalidateQueries({ queryKey: ['central-items'] })
            qc.invalidateQueries({ queryKey: ['central-summary'] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao mover item'),
    })

    // ── Drag handlers ──

    const handleDragStart = useCallback((e: React.DragEvent, itemId: number) => {
        setDragItemId(itemId)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(itemId))
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverCol(colKey)
    }, [])

    const handleDragLeave = useCallback(() => {
        setDragOverCol(null)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent, newStatus: string) => {
        e.preventDefault()
        setDragOverCol(null)
        const itemId = Number(e.dataTransfer.getData('text/plain'))
        if (!itemId) return

        const item = allItems.find(i => i.id === itemId)
        if (!item) return

        const currentStatus = normalize(item.status, 'aberto')
        if (currentStatus === newStatus) {
            setDragItemId(null)
            return
        }

        updateMut.mutate({ id: itemId, data: { status: newStatus } })
        setDragItemId(null)
    }, [allItems, updateMut])

    const handleDragEnd = useCallback(() => {
        setDragItemId(null)
        setDragOverCol(null)
    }, [])

    // ── Helpers ──

    const isOverdue = (item: any) => {
        if (!item.due_at || normalize(item.status, '') === 'concluido' || normalize(item.status, '') === 'cancelado') return false
        return new Date(item.due_at) < new Date()
    }

    const formatDate = (d: string | null) => {
        if (!d) return null
        return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }

    // Group items by column
    const groupedItems: Record<string, any[]> = {}
    for (const col of columns) {
        groupedItems[col.key] = []
    }
    for (const item of allItems) {
        const status = normalize(item.status, 'aberto')
        if (groupedItems[status]) {
            groupedItems[status].push(item)
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Kanban da Central</h1>
                    <p className="mt-0.5 text-sm text-surface-500">Arraste os cards para mudar o status</p>
                </div>
                <div className="flex gap-2">
                    <Link to="/central">
                        <Button variant="outline" icon={<List className="h-4 w-4" />}>
                            Visualizar Lista
                        </Button>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-10 w-10 animate-spin rounded-full border-3 border-brand-500 border-t-transparent" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-h-[60vh]">
                    {columns.map(col => {
                        const items = groupedItems[col.key] ?? []
                        const isDragTarget = dragOverCol === col.key

                        return (
                            <div
                                key={col.key}
                                className={`flex flex-col rounded-xl border-t-4 ${col.color} bg-surface-50/30 transition-colors ${isDragTarget ? col.bgDrop + ' ring-2 ring-brand-300' : ''}`}
                                onDragOver={(e) => handleDragOver(e, col.key)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, col.key)}
                            >
                                <div className="flex items-center justify-between px-4 py-3">
                                    <h3 className="text-sm font-semibold text-surface-700">{col.label}</h3>
                                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-surface-200 px-2 text-xs font-bold text-surface-600">
                                        {items.length}
                                    </span>
                                </div>

                                <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3 max-h-[calc(100vh-220px)]">
                                    {items.length === 0 && (
                                        <div className="flex items-center justify-center py-8 text-xs text-surface-400">
                                            Nenhum item
                                        </div>
                                    )}
                                    {items.map((item: any) => {
                                        const tipoKey = normalize(item.tipo, 'tarefa')
                                        const tipo = tipoConfig[tipoKey] ?? tipoConfig.tarefa
                                        const prioKey = normalize(item.prioridade, 'media')
                                        const prio = prioridadeConfig[prioKey] ?? prioridadeConfig.media
                                        const TipoIcon = tipo.icon
                                        const overdue = isOverdue(item)
                                        const isDragging = dragItemId === item.id

                                        return (
                                            <div
                                                key={item.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, item.id)}
                                                onDragEnd={handleDragEnd}
                                                className={`group cursor-grab rounded-lg border bg-surface-0 p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${isDragging ? 'opacity-40 scale-95' : ''} ${overdue ? 'border-red-200' : 'border-default'}`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-surface-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`rounded p-1 ${tipo.color}`}>
                                                                <TipoIcon className="h-3 w-3" />
                                                            </div>
                                                            <span className="text-sm font-medium text-surface-900 truncate">{item.titulo}</span>
                                                        </div>
                                                        {item.descricao_curta && (
                                                            <p className="mt-1 text-xs text-surface-500 line-clamp-2">{item.descricao_curta}</p>
                                                        )}
                                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-surface-400">
                                                            <span className={`font-medium ${prio.color}`}>{prio.label}</span>
                                                            {overdue && <Badge variant="danger">Atrasado</Badge>}
                                                            {item.due_at && (
                                                                <span className="flex items-center gap-0.5">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {formatDate(item.due_at)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1.5 flex items-center gap-2 text-xs text-surface-400">
                                                            {item.responsavel && (
                                                                <span className="flex items-center gap-0.5 truncate" title={item.responsavel.name}>
                                                                    <UserCheck className="h-3 w-3" />
                                                                    {item.responsavel.name?.split(' ')[0]}
                                                                </span>
                                                            )}
                                                            {(item.comments_count ?? 0) > 0 && (
                                                                <span className="flex items-center gap-0.5">
                                                                    <MessageSquare className="h-3 w-3" />{item.comments_count}
                                                                </span>
                                                            )}
                                                            {item.tags?.length > 0 && (
                                                                <span className="text-xs text-brand-500">#{item.tags[0]}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
