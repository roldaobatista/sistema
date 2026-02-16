import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Phone, MapPin, Clock, ChevronRight, Search, AlertCircle, Wrench,
    CheckCircle2, Loader2, ArrowLeft, ArrowRightCircle, Navigation,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface ServiceCall {
    id: number
    call_number: string
    customer_name?: string
    customer_phone?: string
    customer_address?: string
    subject?: string
    description?: string
    status: string
    priority: string
    created_at: string
    sla_deadline?: string
    latitude?: number
    longitude?: number
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    open: { label: 'Aberto', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    in_progress: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    resolved: { label: 'Resolvido', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    waiting: { label: 'Aguardando', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
}

const PRIORITY_COLORS: Record<string, string> = {
    low: 'border-l-surface-300',
    normal: 'border-l-blue-400',
    high: 'border-l-amber-500',
    urgent: 'border-l-red-500',
}

const PRIORITY_LABELS: Record<string, string> = {
    low: 'Baixa',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
}

export default function TechServiceCallsPage() {
    const navigate = useNavigate()
    const [calls, setCalls] = useState<ServiceCall[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)

    useEffect(() => {
        async function fetchCalls() {
            try {
                setLoading(true)
                const { data } = await api.get('/service-calls', {
                    params: {
                        my: '1',
                        per_page: 50,
                    },
                })
                setCalls(data.data || [])
            } catch (error: any) {
                toast.error(error?.response?.data?.message || 'Erro ao carregar chamados')
            } finally {
                setLoading(false)
            }
        }
        fetchCalls()
    }, [])

    const filteredCalls = useMemo(() => {
        return calls.filter((call) => {
            const matchesSearch = !search || [
                call.call_number,
                call.customer_name,
                call.subject,
                call.description,
            ].some((field) => field?.toLowerCase().includes(search.toLowerCase()))

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'open' && call.status === 'open') ||
                (statusFilter === 'in_progress' && call.status === 'in_progress') ||
                (statusFilter === 'resolved' && call.status === 'resolved')

            return matchesSearch && matchesStatus
        })
    }, [calls, search, statusFilter])

    const handleAccept = async (id: number) => {
        try {
            setUpdatingStatus(id)
            await api.put(`/service-calls/${id}/status`, { status: 'in_progress' })
            setCalls((prev) =>
                prev.map((call) =>
                    call.id === id ? { ...call, status: 'in_progress' } : call
                )
            )
            toast.success('Chamado aceito com sucesso')
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Erro ao aceitar chamado')
        } finally {
            setUpdatingStatus(null)
        }
    }

    const handleConvertToOS = async (id: number) => {
        try {
            setUpdatingStatus(id)
            await api.post(`/service-calls/${id}/convert-to-os`)
            toast.success('Chamado convertido em OS com sucesso')
            navigate('/tech/os')
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Erro ao converter chamado')
        } finally {
            setUpdatingStatus(null)
        }
    }

    const handleNavigate = (call: ServiceCall) => {
        if (call.latitude && call.longitude) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${call.latitude},${call.longitude}`
            window.open(url, '_blank')
        } else if (call.customer_address) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(call.customer_address)}`
            window.open(url, '_blank')
        } else {
            toast.error('Endereço não disponível')
        }
    }

    const statusFilters = [
        { key: 'all', label: 'Todos' },
        { key: 'open', label: 'Abertos' },
        { key: 'in_progress', label: 'Em Andamento' },
        { key: 'resolved', label: 'Resolvidos' },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Chamados Técnicos
                    </h1>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar chamados..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                </div>

                {/* Status filter chips */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                    {statusFilters.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                statusFilter === f.key
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Loading */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                        <p className="text-sm text-surface-500">Carregando chamados...</p>
                    </div>
                ) : filteredCalls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <AlertCircle className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500">
                            {search ? 'Nenhum chamado encontrado' : 'Nenhum chamado atribuído'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredCalls.map((call) => {
                            const status = STATUS_MAP[call.status] || STATUS_MAP.open
                            const priorityKey = call.priority || 'normal'
                            const isExpanded = expandedId === call.id

                            return (
                                <div
                                    key={call.id}
                                    className={cn(
                                        'bg-white dark:bg-surface-800/80 rounded-xl p-4 border-l-4 shadow-sm',
                                        PRIORITY_COLORS[priorityKey] || PRIORITY_COLORS.normal
                                    )}
                                >
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : call.id)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-semibold text-sm text-surface-900 dark:text-surface-50">
                                                        {call.call_number}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                                                            status.color
                                                        )}
                                                    >
                                                        {status.label}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400">
                                                        {PRIORITY_LABELS[priorityKey]}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                                    {call.customer_name || 'Cliente não informado'}
                                                </p>
                                                {(call.subject || call.description) && (
                                                    <p className="text-xs text-surface-400 line-clamp-1 mt-0.5">
                                                        {call.subject || call.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-400 dark:text-surface-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(call.created_at).toLocaleDateString('pt-BR')}
                                                    </span>
                                                    {call.sla_deadline && (
                                                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                                            <AlertCircle className="w-3 h-3" />
                                                            SLA: {new Date(call.sla_deadline).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight
                                                className={cn(
                                                    'w-5 h-5 text-surface-300 dark:text-surface-600 mt-1 flex-shrink-0 transition-transform',
                                                    isExpanded && 'rotate-90'
                                                )}
                                            />
                                        </div>
                                    </button>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700 space-y-3">
                                            {call.description && (
                                                <div>
                                                    <p className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                                                        Descrição
                                                    </p>
                                                    <p className="text-sm text-surface-900 dark:text-surface-50">
                                                        {call.description}
                                                    </p>
                                                </div>
                                            )}
                                            {call.customer_phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-surface-400" />
                                                    <a
                                                        href={`tel:${call.customer_phone}`}
                                                        className="text-sm text-brand-600 dark:text-brand-400"
                                                    >
                                                        {call.customer_phone}
                                                    </a>
                                                </div>
                                            )}
                                            {call.customer_address && (
                                                <div className="flex items-start gap-2">
                                                    <MapPin className="w-4 h-4 text-surface-400 mt-0.5" />
                                                    <p className="text-sm text-surface-900 dark:text-surface-50 flex-1">
                                                        {call.customer_address}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Action buttons */}
                                            <div className="flex gap-2 pt-2">
                                                {call.status === 'open' && (
                                                    <button
                                                        onClick={() => handleAccept(call.id)}
                                                        disabled={updatingStatus === call.id}
                                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                                    >
                                                        {updatingStatus === call.id ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                Aceitando...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                Aceitar
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleConvertToOS(call.id)}
                                                    disabled={updatingStatus === call.id}
                                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                                >
                                                    {updatingStatus === call.id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Convertendo...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ArrowRightCircle className="w-4 h-4" />
                                                            Converter em OS
                                                        </>
                                                    )}
                                                </button>
                                                {(call.latitude || call.customer_address) && (
                                                    <button
                                                        onClick={() => handleNavigate(call)}
                                                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"
                                                    >
                                                        <Navigation className="w-4 h-4" />
                                                        Navegar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
