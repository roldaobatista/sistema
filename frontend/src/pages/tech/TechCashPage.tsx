import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Wallet, ArrowUpCircle, ArrowDownCircle, Loader2,
    Send, Clock, CheckCircle2, XCircle, DollarSign, TrendingUp, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface CashFund {
    id: number
    balance: number
    limit: number
    last_settlement_at: string | null
}

interface CashTransaction {
    id: number
    type: string
    amount: number
    description: string | null
    reference_type: string | null
    reference_id: number | null
    created_at: string
    created_by_name?: string
}

interface FundRequest {
    id: number
    amount: number
    reason: string | null
    status: string
    created_at: string
    approved_at: string | null
}

export default function TechCashPage() {
    const navigate = useNavigate()
    const [fund, setFund] = useState<CashFund | null>(null)
    const [transactions, setTransactions] = useState<CashTransaction[]>([])
    const [requests, setRequests] = useState<FundRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [showRequestForm, setShowRequestForm] = useState(false)
    const [requestAmount, setRequestAmount] = useState('')
    const [requestReason, setRequestReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState<'transactions' | 'requests'>('transactions')

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        try {
            const [fundRes, txRes, reqRes] = await Promise.allSettled([
                api.get('/technician-cash/my-fund'),
                api.get('/technician-cash/my-transactions', { params: { per_page: 50 } }),
                api.get('/technician-cash/my-requests'),
            ])

            if (fundRes.status === 'fulfilled') setFund(fundRes.value.data?.data ?? fundRes.value.data)
            if (txRes.status === 'fulfilled') setTransactions(txRes.value.data?.data ?? txRes.value.data ?? [])
            if (reqRes.status === 'fulfilled') setRequests(reqRes.value.data?.data ?? reqRes.value.data ?? [])
        } catch {
            toast.error('Erro ao carregar dados do caixa')
        } finally {
            setLoading(false)
        }
    }

    async function handleRequestFunds() {
        if (!requestAmount || parseFloat(requestAmount) <= 0) return
        setSubmitting(true)
        try {
            await api.post('/technician-cash/request-funds', {
                amount: parseFloat(requestAmount),
                reason: requestReason || null,
            })
            toast.success('Solicitação de fundos enviada!')
            setShowRequestForm(false)
            setRequestAmount('')
            setRequestReason('')
            fetchData()
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Erro ao solicitar fundos')
        } finally {
            setSubmitting(false)
        }
    }

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    const txTypeConfig: Record<string, { label: string; icon: typeof ArrowUpCircle; color: string }> = {
        credit: { label: 'Crédito', icon: ArrowUpCircle, color: 'text-emerald-600 dark:text-emerald-400' },
        debit: { label: 'Débito', icon: ArrowDownCircle, color: 'text-red-600 dark:text-red-400' },
        fund_in: { label: 'Recarga', icon: ArrowUpCircle, color: 'text-emerald-600 dark:text-emerald-400' },
        fund_out: { label: 'Retirada', icon: ArrowDownCircle, color: 'text-red-600 dark:text-red-400' },
        expense: { label: 'Despesa', icon: ArrowDownCircle, color: 'text-amber-600 dark:text-amber-400' },
        settlement: { label: 'Acerto', icon: DollarSign, color: 'text-blue-600 dark:text-blue-400' },
    }

    const reqStatusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
        pending: { label: 'Pendente', icon: Clock, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
        approved: { label: 'Aprovada', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
        rejected: { label: 'Rejeitada', icon: XCircle, color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                <p className="text-sm text-surface-500">Carregando caixa...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Meu Caixa</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Balance card */}
                <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <Wallet className="w-5 h-5 opacity-80" />
                        <span className="text-sm font-medium opacity-80">Saldo Atual</span>
                    </div>
                    <p className="text-3xl font-bold mt-1">
                        {fund ? formatCurrency(fund.balance) : 'R$ 0,00'}
                    </p>
                    {fund?.limit != null && fund.limit > 0 && (
                        <div className="mt-3">
                            <div className="flex items-center justify-between text-xs opacity-80 mb-1">
                                <span>Limite: {formatCurrency(fund.limit)}</span>
                                <span>{Math.round((fund.balance / fund.limit) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white/80 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, (fund.balance / fund.limit) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowRequestForm(true)}
                        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/20 text-sm font-medium backdrop-blur-sm active:bg-white/30 transition-colors"
                    >
                        <Send className="w-4 h-4" /> Solicitar Fundos
                    </button>
                </div>

                {/* Request funds form */}
                {showRequestForm && (
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">Solicitar Fundos</h3>
                        <div>
                            <label className="text-xs text-surface-500 font-medium mb-1 block">Valor (R$) *</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={requestAmount}
                                onChange={(e) => setRequestAmount(e.target.value)}
                                placeholder="0,00"
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-surface-500 font-medium mb-1 block">Motivo</label>
                            <textarea
                                value={requestReason}
                                onChange={(e) => setRequestReason(e.target.value)}
                                placeholder="Ex: Preciso de troco para OS em campo..."
                                rows={2}
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowRequestForm(false)}
                                className="flex-1 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-700 text-sm font-medium text-surface-600 dark:text-surface-400"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRequestFunds}
                                disabled={submitting || !requestAmount}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors',
                                    requestAmount ? 'bg-brand-600 active:bg-brand-700' : 'bg-surface-300 dark:bg-surface-700',
                                )}
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Enviar
                            </button>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={cn(
                            'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                            activeTab === 'transactions' ? 'bg-brand-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                        )}
                    >
                        Movimentações
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={cn(
                            'flex-1 py-2 rounded-lg text-xs font-medium transition-colors relative',
                            activeTab === 'requests' ? 'bg-brand-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                        )}
                    >
                        Solicitações
                        {requests.filter(r => r.status === 'pending').length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                                {requests.filter(r => r.status === 'pending').length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Transactions */}
                {activeTab === 'transactions' && (
                    <div className="space-y-2">
                        {transactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <DollarSign className="w-10 h-10 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhuma movimentação</p>
                            </div>
                        ) : transactions.map((tx) => {
                            const config = txTypeConfig[tx.type] || txTypeConfig.debit
                            const TxIcon = config.icon
                            const isPositive = ['credit', 'fund_in'].includes(tx.type)
                            return (
                                <div key={tx.id} className="flex items-center gap-3 bg-white dark:bg-surface-800/80 rounded-xl p-3">
                                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                                        isPositive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
                                    )}>
                                        <TxIcon className={cn('w-4 h-4', config.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{config.label}</p>
                                        {tx.description && <p className="text-xs text-surface-500 truncate">{tx.description}</p>}
                                        <p className="text-[10px] text-surface-400 mt-0.5">
                                            {new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <p className={cn('text-sm font-bold flex-shrink-0', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                                        {isPositive ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Fund requests */}
                {activeTab === 'requests' && (
                    <div className="space-y-2">
                        {requests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Send className="w-10 h-10 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhuma solicitação</p>
                            </div>
                        ) : requests.map((req) => {
                            const config = reqStatusConfig[req.status] || reqStatusConfig.pending
                            const ReqIcon = config.icon
                            return (
                                <div key={req.id} className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                                    <div className="flex items-center gap-3">
                                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', config.color)}>
                                            <ReqIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-surface-900 dark:text-surface-50">
                                                {formatCurrency(req.amount)}
                                            </p>
                                            {req.reason && <p className="text-xs text-surface-500 truncate">{req.reason}</p>}
                                            <p className="text-[10px] text-surface-400 mt-0.5">
                                                {new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', config.color)}>
                                            {config.label}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
