import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    DollarSign, Clock, CheckCircle2, Plus, Loader2, ArrowLeft,
} from 'lucide-react'
import { cn, getApiErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

const STATUS_BADGES: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    paid: 'Pago',
    reversed: 'Estornado',
    cancelled: 'Cancelado',
    rejected: 'Rejeitado',
    open: 'Aberta',
    resolved: 'Resolvida',
    accepted: 'Aceita',
    closed: 'Fechado',
}

interface CommissionEvent {
    id: number
    description?: string
    notes?: string
    commission_amount: number
    status: string
    created_at: string
    work_order?: { os_number?: string; number?: string }
    rule?: { name?: string }
}

interface CommissionSettlement {
    id: number
    period: string
    total_amount: number
    paid_amount?: number
    balance?: number
    status: string
    paid_at?: string
    payment_notes?: string
}

interface CommissionDispute {
    id: number
    reason: string
    status: string
    created_at: string
    commission_event?: { commission_amount?: number }
}

interface Summary {
    total_month?: number
    pending?: number
    paid?: number
}

export default function TechCommissionsPage() {
    const navigate = useNavigate()
    const [userId, setUserId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [periodFilter, setPeriodFilter] = useState<'current' | 'previous' | 'all'>('current')
    const [activeTab, setActiveTab] = useState<'events' | 'settlements' | 'disputes'>('events')
    const [events, setEvents] = useState<CommissionEvent[]>([])
    const [settlements, setSettlements] = useState<CommissionSettlement[]>([])
    const [disputes, setDisputes] = useState<CommissionDispute[]>([])
    const [summary, setSummary] = useState<Summary>({})
    const [showDisputeForm, setShowDisputeForm] = useState(false)
    const [disputeReason, setDisputeReason] = useState('')
    const [disputeAmount, setDisputeAmount] = useState('')
    const [disputeEventId, setDisputeEventId] = useState<number | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const getPeriod = () => {
        const now = new Date()
        if (periodFilter === 'current') return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
        if (periodFilter === 'previous') {
            const prev = new Date(now.getFullYear(), now.getMonth() - 1)
            return prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0')
        }
        return ''
    }

    useEffect(() => {
        api.get('/me')
            .then(({ data }) => setUserId(data?.id ?? null))
            .catch(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (!userId) return

        const period = getPeriod()
        const cacheKey = (suffix: string) => `cache:commission-${suffix}-${userId}-${period}`

        try {
            const evCached = localStorage.getItem(cacheKey('events'))
            if (evCached) {
                const { data, timestamp } = JSON.parse(evCached)
                if (Date.now() - timestamp < 30 * 60 * 1000) {
                    const ev = data || []
                    setEvents(ev)
                    const pending = ev.filter((e: CommissionEvent) => e.status === 'pending' || e.status === 'approved')
                        .reduce((s: number, e: CommissionEvent) => s + Number(e.commission_amount || 0), 0)
                    const paid = ev.filter((e: CommissionEvent) => e.status === 'paid')
                        .reduce((s: number, e: CommissionEvent) => s + Number(e.commission_amount || 0), 0)
                    const total = ev.reduce((s: number, e: CommissionEvent) => s + Number(e.commission_amount || 0), 0)
                    setSummary({ total_month: total, pending, paid })
                }
            }
            const setCached = localStorage.getItem(cacheKey('settlements'))
            if (setCached) {
                const { data, timestamp } = JSON.parse(setCached)
                if (Date.now() - timestamp < 30 * 60 * 1000) setSettlements(data || [])
            }
            const dispCached = localStorage.getItem(`cache:commission-disputes-${userId}`)
            if (dispCached) {
                const { data, timestamp } = JSON.parse(dispCached)
                if (Date.now() - timestamp < 30 * 60 * 1000) setDisputes(data || [])
            }
        } catch {
            toast.error('Erro ao carregar dados em cache.')
        }

        async function fetchData() {
            try {
                setLoading(true)
                const params: Record<string, string | number> = { my: 1 }
                if (period) params.period = period

                const [eventsRes, settlementsRes, disputesRes] = await Promise.all([
                    api.get('/my/commission-events', { params }).catch(() => ({ data: { data: [] } })),
                    api.get('/my/commission-settlements', { params }).catch(() => ({ data: { data: [] } })),
                    api.get('/commission-disputes', { params: { user_id: userId } }).catch(() => ({ data: { data: [] } })),
                ])

                const eventsArr = eventsRes.data?.data ?? (Array.isArray(eventsRes.data) ? eventsRes.data : [])
                setEvents(eventsArr)

                const setData = settlementsRes.data?.data ?? (Array.isArray(settlementsRes.data) ? settlementsRes.data : [])
                setSettlements(setData)

                const dispData = disputesRes.data?.data ?? (Array.isArray(disputesRes.data) ? disputesRes.data : [])
                setDisputes(dispData)

                localStorage.setItem(cacheKey('events'), JSON.stringify({ data: eventsArr, timestamp: Date.now() }))
                localStorage.setItem(cacheKey('settlements'), JSON.stringify({ data: setData, timestamp: Date.now() }))
                localStorage.setItem(`cache:commission-disputes-${userId}`, JSON.stringify({ data: dispData, timestamp: Date.now() }))

                const pending = eventsArr
                    .filter((e: CommissionEvent) => e.status === 'pending' || e.status === 'approved')
                    .reduce((s: number, e: CommissionEvent) => s + Number(e.commission_amount || 0), 0)
                const paid = eventsArr
                    .filter((e: CommissionEvent) => e.status === 'paid')
                    .reduce((s: number, e: CommissionEvent) => s + Number(e.commission_amount || 0), 0)
                const total = eventsArr
                    .reduce((s: number, e: CommissionEvent) => s + Number(e.commission_amount || 0), 0)

                setSummary({
                    total_month: total,
                    pending,
                    paid,
                })
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                toast.error(msg || 'Erro ao carregar comissões')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [userId, periodFilter, activeTab])

    const handleCreateDispute = async () => {
        if (!disputeEventId || !disputeReason.trim()) {
            toast.error('Selecione um evento e informe o motivo')
            return
        }
        if (disputeReason.trim().length < 10) {
            toast.error('O motivo deve ter pelo menos 10 caracteres')
            return
        }
        try {
            setSubmitting(true)
            await api.post('/commission-disputes', {
                commission_event_id: disputeEventId,
                reason: disputeReason.trim(),
                amount: disputeAmount ? parseFloat(disputeAmount) : undefined,
            })
            toast.success('Contestação registrada')
            setShowDisputeForm(false)
            setDisputeReason('')
            setDisputeAmount('')
            setDisputeEventId(null)
            const { data } = await api.get('/commission-disputes', { params: { user_id: userId } })
            const dispArr = Array.isArray(data) ? data : data?.data ?? []
            setDisputes(dispArr)
            localStorage.setItem(`cache:commission-disputes-${userId}`, JSON.stringify({ data: dispArr, timestamp: Date.now() }))
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao registrar contestação'))
        } finally {
            setSubmitting(false)
        }
    }

    const disputableEvents = events.filter((e) => e.status === 'pending' || e.status === 'approved')

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button
                    onClick={() => navigate('/tech')}
                    className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                    Comissões
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <DollarSign className="w-4 h-4 text-brand-600" />
                                    <span className="text-xs text-surface-500 dark:text-surface-400">Total do Mês</span>
                                </div>
                                <p className="text-lg font-bold text-surface-900 dark:text-surface-50">
                                    {formatCurrency(summary.total_month ?? 0)}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs text-surface-500 dark:text-surface-400">Pendente</span>
                                </div>
                                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                    {formatCurrency(summary.pending ?? 0)}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs text-surface-500 dark:text-surface-400">Pago</span>
                                </div>
                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(summary.paid ?? 0)}
                                </p>
                            </div>
                        </div>

                        {/* Saldo acumulado total */}
                        {settlements.length > 0 && (() => {
                            const totalEarned = settlements.reduce((s: number, st: CommissionSettlement) => s + Number(st.total_amount || 0), 0)
                            const totalPaid = settlements.reduce((s: number, st: CommissionSettlement) => s + Number(st.paid_amount || 0), 0)
                            const totalBalance = totalEarned - totalPaid
                            return totalBalance > 0 ? (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Saldo acumulado a receber</p>
                                    <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{formatCurrency(totalBalance)}</p>
                                    <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 mt-1">Calculado: {formatCurrency(totalEarned)} - Recebido: {formatCurrency(totalPaid)}</p>
                                </div>
                            ) : null
                        })()}

                        <div className="flex gap-2">
                            {(['current', 'previous', 'all'] as const).map((pf) => (
                                <button
                                    key={pf}
                                    onClick={() => setPeriodFilter(pf)}
                                    className={cn(
                                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium',
                                        periodFilter === pf
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                                    )}
                                >
                                    {pf === 'current' ? 'Mês Atual' : pf === 'previous' ? 'Mês Anterior' : 'Tudo'}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700 pb-2">
                            {(['events', 'settlements', 'disputes'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium',
                                        activeTab === tab
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                                    )}
                                >
                                    {tab === 'events' ? 'Eventos' : tab === 'settlements' ? 'Fechamentos' : 'Disputas'}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'events' && (
                            <div className="space-y-3">
                                {events.length === 0 ? (
                                    <p className="text-sm text-surface-500 text-center py-6">Nenhum evento</p>
                                ) : (
                                    events.map((ev) => (
                                        <div
                                            key={ev.id}
                                            className="bg-white dark:bg-surface-800/80 rounded-xl p-3"
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                                        {ev.notes || ev.rule?.name || 'Comissão'}
                                                    </p>
                                                    <p className="text-xs text-surface-500">
                                                        OS {(ev.work_order?.os_number || ev.work_order?.number) ?? '—'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                                        {formatCurrency(Number(ev.commission_amount || 0))}
                                                    </p>
                                                    <span
                                                        className={cn(
                                                            'inline-block px-2 py-0.5 rounded text-[10px] font-medium mt-1',
                                                            STATUS_BADGES[ev.status] ?? 'bg-surface-100 text-surface-600'
                                                        )}
                                                    >
                                                        {STATUS_LABELS[ev.status] ?? ev.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-surface-400 mt-2">
                                                {new Date(ev.created_at).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'settlements' && (
                            <div className="space-y-3">
                                {settlements.length === 0 ? (
                                    <p className="text-sm text-surface-500 text-center py-6">Nenhum fechamento</p>
                                ) : (
                                    settlements.map((s) => {
                                        const earned = Number(s.total_amount || 0)
                                        const paid = Number(s.paid_amount || 0)
                                        const bal = earned - paid
                                        return (
                                            <div
                                                key={s.id}
                                                className="bg-white dark:bg-surface-800/80 rounded-xl p-3"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                                            {s.period.replace(/-/, '/')}
                                                        </p>
                                                        <p className="text-xs text-surface-500">
                                                            Calculado: {formatCurrency(earned)}
                                                        </p>
                                                        {s.status === 'paid' && (
                                                            <>
                                                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                                                    Recebido: {formatCurrency(paid)}
                                                                </p>
                                                                {bal > 0.01 && (
                                                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                                                        Saldo: {formatCurrency(bal)}
                                                                    </p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <span
                                                            className={cn(
                                                                'inline-block px-2 py-0.5 rounded text-[10px] font-medium',
                                                                STATUS_BADGES[s.status] ?? 'bg-surface-100 text-surface-600'
                                                            )}
                                                        >
                                                            {STATUS_LABELS[s.status] ?? s.status}
                                                        </span>
                                                        {s.paid_at && (
                                                            <p className="text-[10px] text-surface-400 mt-1">
                                                                Pago em {new Date(s.paid_at).toLocaleDateString('pt-BR')}
                                                            </p>
                                                        )}
                                                        {s.payment_notes && (
                                                            <p className="text-[10px] text-surface-400 mt-1">
                                                                {s.payment_notes.length > 40 ? s.payment_notes.slice(0, 40) + '...' : s.payment_notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        )}

                        {activeTab === 'disputes' && (
                            <div className="space-y-3">
                                {showDisputeForm && (
                                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                                        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                                            Nova contestação
                                        </h3>
                                        <select
                                            value={disputeEventId ?? ''}
                                            onChange={(e) => setDisputeEventId(Number(e.target.value) || null)}
                                            className="w-full px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm"
                                        >
                                            <option value="">Selecione o evento</option>
                                            {disputableEvents.map((e) => (
                                                <option key={e.id} value={e.id}>
                                                    OS {(e.work_order?.os_number || e.work_order?.number) ?? e.id} — {formatCurrency(Number(e.commission_amount || 0))}
                                                </option>
                                            ))}
                                        </select>
                                        <textarea
                                            value={disputeReason}
                                            onChange={(e) => setDisputeReason(e.target.value)}
                                            placeholder="Motivo da contestação (mín. 10 caracteres)"
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm resize-none"
                                        />
                                        <input
                                            type="number"
                                            value={disputeAmount}
                                            onChange={(e) => setDisputeAmount(e.target.value)}
                                            placeholder="Valor esperado (opcional)"
                                            step="0.01"
                                            className="w-full px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setShowDisputeForm(false)
                                                    setDisputeReason('')
                                                    setDisputeAmount('')
                                                    setDisputeEventId(null)
                                                }}
                                                className="flex-1 px-3 py-2 rounded-lg bg-surface-200 dark:bg-surface-700 text-sm"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleCreateDispute}
                                                disabled={submitting}
                                                className="flex-1 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                Enviar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!showDisputeForm && (
                                    <button
                                        onClick={() => setShowDisputeForm(true)}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-400 hover:border-brand-500 hover:text-brand-600"
                                    >
                                        <Plus className="w-5 h-5" /> Nova contestação
                                    </button>
                                )}

                                {disputes.length === 0 ? (
                                    <p className="text-sm text-surface-500 text-center py-6">Nenhuma contestação</p>
                                ) : (
                                    disputes.map((d) => (
                                        <div
                                            key={d.id}
                                            className="bg-white dark:bg-surface-800/80 rounded-xl p-3"
                                        >
                                            <p className="text-sm text-surface-900 dark:text-surface-50 line-clamp-2">
                                                {d.reason}
                                            </p>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-xs text-surface-500">
                                                    {formatCurrency(Number(d.commission_event?.commission_amount || 0))}
                                                </span>
                                                <p className="text-[10px] text-surface-400">
                                                    {new Date(d.created_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                            <span
                                                className={cn(
                                                    'inline-block px-2 py-0.5 rounded text-[10px] font-medium mt-2',
                                                    STATUS_BADGES[d.status] ?? 'bg-surface-100 text-surface-600'
                                                )}
                                            >
                                                {STATUS_LABELS[d.status] ?? d.status}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
