import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft, FileText, Calendar, CheckCircle2, AlertTriangle,
    Clock, Repeat, DollarSign, Loader2, Shield, List,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

const FREQUENCY_LABELS: Record<string, string> = {
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
    bimonthly: 'Bimestral',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual',
}

const STATUS_STYLES: Record<string, string> = {
    active: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700',
    expired: 'bg-red-100 dark:bg-red-900/30 text-red-700',
    suspended: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700',
}

function formatDate(d: string | Date | null | undefined): string {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('pt-BR')
}

function formatCurrency(val: number | null | undefined): string {
    if (val == null) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

interface RecurringContract {
    id: number
    name: string
    description?: string
    frequency: string
    start_date: string
    end_date?: string
    next_run_date?: string
    monthly_value?: number
    is_active: boolean
    items?: Array<{ description: string; type: string }>
}

interface WorkOrder {
    id: number
    number?: string
    os_number?: string
    status?: string
    created_at?: string
    customer_id?: number
    customer?: { name: string }
}

export default function TechContractInfoPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [wo, setWo] = useState<WorkOrder | null>(null)
    const [contracts, setContracts] = useState<RecurringContract[]>([])
    const [visitHistory, setVisitHistory] = useState<WorkOrder[]>([])

    useEffect(() => {
        if (!id) return
        api.get(`/work-orders/${id}`)
            .then((res) => {
                const data = res.data?.data ?? res.data
                setWo(data)
                return data?.customer_id ?? data?.customer?.id
            })
            .then((customerId) => {
                if (!customerId) return
                return api.get('/recurring-contracts', {
                    params: { customer_id: customerId, active_only: 1, per_page: 50 },
                })
            })
            .then((res) => {
                if (!res) return
                const data = res.data?.data ?? res.data
                const list = Array.isArray(data) ? data : data?.data ?? []
                setContracts(list)
                const first = list[0]
                return { first, customerId: res.config?.params?.customer_id }
            })
            .then((result?: { first?: RecurringContract; customerId?: number }) => {
                const first = result?.first
                const customerId = result?.customerId
                if (!first?.id || customerId == null) return
                return api.get('/work-orders', {
                    params: { customer_id: customerId, per_page: 20 },
                }).then((r) => {
                    const d = r.data?.data ?? r.data
                    const all = Array.isArray(d) ? d : d?.data ?? []
                    const byContract = all.filter(
                        (w: WorkOrder & { recurring_contract_id?: number }) => w.recurring_contract_id === first.id
                    )
                    setVisitHistory(byContract.slice(0, 10))
                }).catch(() => {
                    setVisitHistory([])
                    toast.error('Não foi possível carregar histórico de visitas')
                })
            })
            .catch(() => toast.error('Não foi possível carregar os dados'))
            .finally(() => setLoading(false))
    }, [id])

    if (loading) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                <span className="text-sm text-surface-500">Carregando contrato...</span>
            </div>
        )
    }

    const contract = contracts[0] as RecurringContract | undefined
    const hasContract = !!contract

    const getContractStatus = (c: RecurringContract) => {
        if (!c.is_active) return 'suspended'
        const end = c.end_date ? new Date(c.end_date) : null
        if (end && end < new Date()) return 'expired'
        return 'active'
    }

    const isExpiringSoon = (c: RecurringContract) => {
        if (!c.end_date) return false
        const end = new Date(c.end_date)
        const diff = (end.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        return diff > 0 && diff <= 30
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button
                    onClick={() => navigate(`/tech/os/${id}`)}
                    className="flex items-center gap-1 text-sm text-brand-600 mb-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-600" />
                    Contrato do Cliente
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {!hasContract ? (
                    <div className="bg-card rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center">
                        <Shield className="w-12 h-12 text-surface-400" />
                        <p className="text-sm font-medium text-surface-700">
                            Cliente sem contrato ativo
                        </p>
                        <p className="text-xs text-surface-500">
                            Não há contrato recorrente vinculado a este cliente.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="bg-card rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className={cn(
                                    'px-2.5 py-1 rounded-lg text-xs font-medium',
                                    STATUS_STYLES[getContractStatus(contract)]
                                )}>
                                    {getContractStatus(contract) === 'active' && 'Ativo'}
                                    {getContractStatus(contract) === 'expired' && 'Expirado'}
                                    {getContractStatus(contract) === 'suspended' && 'Suspenso'}
                                </span>
                                <span className="text-xs text-surface-500">{contract.name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-surface-500" />
                                    <span>Início: {formatDate(contract.start_date)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-surface-500" />
                                    <span>Fim: {formatDate(contract.end_date)}</span>
                                </div>
                                <div className="flex items-center gap-2 col-span-2">
                                    <Repeat className="w-4 h-4 text-surface-500" />
                                    <span>Frequência: {FREQUENCY_LABELS[contract.frequency] ?? contract.frequency}</span>
                                </div>
                                {(contract.monthly_value ?? 0) > 0 && (
                                    <div className="flex items-center gap-2 col-span-2">
                                        <DollarSign className="w-4 h-4 text-surface-500" />
                                        <span>Valor/período: {formatCurrency(contract.monthly_value)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {contract.items && contract.items.length > 0 && (
                            <div className="bg-card rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                                    <List className="w-4 h-4" />
                                    Serviços cobertos
                                </h3>
                                <ul className="space-y-1.5">
                                    {contract.items.map((item, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-surface-600">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            {item.description}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {visitHistory.length > 0 && (
                            <div className="bg-card rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                                    <Clock className="w-4 h-4" />
                                    Histórico de visitas
                                </h3>
                                <ul className="space-y-2">
                                    {visitHistory.map((v) => (
                                        <li
                                            key={v.id}
                                            className="flex items-center justify-between text-sm py-1.5 border-b border-surface-100 last:border-0"
                                        >
                                            <span>{formatDate(v.created_at)}</span>
                                            <span className="font-medium">{v.os_number ?? v.number ?? v.id}</span>
                                            <span className="text-xs text-surface-500">{v.status ?? '—'}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {contract.next_run_date && getContractStatus(contract) === 'active' && (
                            <div className="bg-card rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-foreground mb-2">
                                    Próximas visitas
                                </h3>
                                <p className="text-sm text-surface-600">
                                    Próxima: {formatDate(contract.next_run_date)}
                                </p>
                            </div>
                        )}

                        {isExpiringSoon(contract) && (
                            <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                        Contrato expirando em breve
                                    </p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        O contrato vence em {formatDate(contract.end_date)}. Considere renovar.
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
