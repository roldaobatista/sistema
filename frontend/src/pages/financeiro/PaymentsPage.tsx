import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Calendar, DollarSign, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'

interface Payment {
    id: number
    payable_type: string
    payable_id: number
    amount: string
    payment_method: string | null
    payment_date: string
    notes: string | null
    created_at: string
}

interface PaymentSummary {
    total_received: number
    total_paid: number
    net: number
    count: number
    total: number
    by_method: Array<{
        payment_method: string | null
        total: number | string
        count: number
    }>
}

interface PaginatedPayments {
    data: Payment[]
    current_page: number
    last_page: number
    total: number
}

interface ApiErrorLike {
    response?: {
        status?: number
        data?: {
            message?: string
        }
    }
}

const PER_PAGE = 50

export function PaymentsPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')

    const canViewReceivable = isSuperAdmin || hasPermission('finance.receivable.view')
    const canViewPayable = isSuperAdmin || hasPermission('finance.payable.view')
    const canReverseReceivable = isSuperAdmin || hasPermission('finance.receivable.settle')
    const canReversePayable = isSuperAdmin || hasPermission('finance.payable.settle')

    const [type, setType] = useState<string>('')
    const [method, setMethod] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [page, setPage] = useState(1)
    const [reverseTarget, setReverseTarget] = useState<Payment | null>(null)

    const { data: listData, isLoading, error: listError } = useQuery({
        queryKey: ['payments', type, method, dateFrom, dateTo, page],
        queryFn: async () => {
            const { data } = await api.get<PaginatedPayments>('/payments', {
                params: {
                    type: type || undefined,
                    payment_method: method || undefined,
                    date_from: dateFrom || undefined,
                    date_to: dateTo || undefined,
                    page,
                    per_page: PER_PAGE,
                },
            })
            return data
        },
    })

    const { data: summary = { total_received: 0, total_paid: 0, net: 0, count: 0, total: 0, by_method: [] } } = useQuery({
        queryKey: ['payments-summary', type, method, dateFrom, dateTo],
        queryFn: async () => {
            const { data } = await api.get<PaymentSummary>('/payments-summary', {
                params: {
                    type: type || undefined,
                    payment_method: method || undefined,
                    date_from: dateFrom || undefined,
                    date_to: dateTo || undefined,
                },
            })
            return data
        },
    })

    const { data: methods = [] } = useQuery({
        queryKey: ['payment-methods'],
        queryFn: async () => {
            const { data } = await api.get<Array<{ id: number; name: string; code: string }>>('/payment-methods')
            return data
        },
        enabled: canViewReceivable || canViewPayable,
    })

    const reverseMut = useMutation({
        mutationFn: async (paymentId: number) => {
            await api.delete(`/payments/${paymentId}`)
        },
        onSuccess: () => {
            toast.success('Pagamento estornado com sucesso')
                qc.invalidateQueries({ queryKey: ['payments'] })
            qc.invalidateQueries({ queryKey: ['payments-summary'] })
        },
        onError: (error: ApiErrorLike) => {
            if (error?.response?.status === 403) {
                toast.error('Sem permissao para estornar este pagamento')
                return
            }
            toast.error(error?.response?.data?.message ?? 'Erro ao estornar pagamento')
        },
    })

    const payments = listData?.data ?? []
    const currentPage = listData?.current_page ?? 1
    const lastPage = listData?.last_page ?? 1
    const total = listData?.total ?? 0

    const formatBRL = (value: number | string) => {
        const numeric = typeof value === 'string' ? parseFloat(value) : value
        return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR')

    const canReversePayment = (payment: Payment) => (
        payment.payable_type.includes('AccountReceivable')
            ? canReverseReceivable
            : canReversePayable
    )

    const handleReverse = (payment: Payment) => {
        if (!canReversePayment(payment)) {
            toast.error('Sem permissao para estornar este pagamento')
            return
        }
        setReverseTarget(payment)
    }

    const confirmReverse = () => {
        if (!reverseTarget) return
        reverseMut.mutate(reverseTarget.id)
        setReverseTarget(null)
    }

    const resetFilters = () => {
        setType('')
        setMethod('')
        setDateFrom('')
        setDateTo('')
        setPage(1)
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Pagamentos"
                subtitle="Historico consolidado de recebimentos e pagamentos"
                count={total}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sm text-surface-500"><DollarSign className="h-4 w-4" /> Movimentacoes</div>
                    <p className="mt-1 text-lg font-semibold text-surface-900 tracking-tight">{summary.count}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sm text-emerald-600"><ArrowDownCircle className="h-4 w-4" /> Recebido</div>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{formatBRL(summary.total_received)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sm text-red-600"><ArrowUpCircle className="h-4 w-4" /> Pago</div>
                    <p className="mt-1 text-2xl font-bold text-red-700">{formatBRL(summary.total_paid)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sm text-surface-500"><DollarSign className="h-4 w-4" /> Saldo</div>
                    <p className={`mt-1 text-2xl font-bold ${summary.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatBRL(summary.net)}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setType(e.target.value); setPage(1) }}
                    className="rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                    <option value="">Todos os tipos</option>
                    <option value="receivable">Recebimentos</option>
                    <option value="payable">Pagamentos</option>
                </select>
                <select
                    value={method}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setMethod(e.target.value); setPage(1) }}
                    className="rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                    <option value="">Todos os metodos</option>
                    {methods.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
                </select>
                <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-surface-400" />
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDateFrom(e.target.value); setPage(1) }}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                    <span className="text-surface-400">-</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDateTo(e.target.value); setPage(1) }}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                </div>
                <Button variant="outline" onClick={resetFilters}>Limpar filtros</Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Data</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Tipo</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500 md:table-cell">Metodo</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Valor</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500 lg:table-cell">Observacoes</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Acoes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : listError ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-red-600">Erro ao carregar pagamentos</td></tr>
                        ) : payments.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-2"><EmptyState icon={<DollarSign className="h-5 w-5 text-surface-300" />} message="Nenhum pagamento encontrado" compact /></td></tr>
                        ) : payments.map(payment => {
                            const isReceivable = payment.payable_type.includes('AccountReceivable')
                            const canReverse = canReversePayment(payment)
                            const reversingCurrent = reverseMut.isPending && reverseMut.variables === payment.id

                            return (
                                <tr key={payment.id} className="hover:bg-surface-50 transition-colors duration-100">
                                    <td className="px-4 py-3 text-sm text-surface-700">{formatDate(payment.payment_date)}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={isReceivable ? 'success' : 'danger'}>
                                            {isReceivable ? 'Recebimento' : 'Pagamento'}
                                        </Badge>
                                    </td>
                                    <td className="hidden px-4 py-3 text-sm text-surface-600 md:table-cell">
                                        {payment.payment_method || '-'}
                                    </td>
                                    <td className={`px-3.5 py-2.5 text-right text-sm font-semibold ${isReceivable ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {isReceivable ? '+' : '-'}{formatBRL(payment.amount)}
                                    </td>
                                    <td className="hidden max-w-xs truncate px-4 py-3 text-sm text-surface-500 lg:table-cell">
                                        {payment.notes || '-'}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right">
                                        {canReverse ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                icon={<RotateCcw className="h-3.5 w-3.5" />}
                                                loading={reversingCurrent}
                                                onClick={() => handleReverse(payment)}
                                            >
                                                Estornar
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-surface-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-end gap-2">
                <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>
                    Anterior
                </Button>
                <span className="text-xs text-surface-500">Pagina {currentPage} de {lastPage}</span>
                <Button variant="outline" disabled={currentPage >= lastPage} onClick={() => setPage(prev => prev + 1)}>
                    Proxima
                </Button>
            </div>

            <Modal open={!!reverseTarget} onOpenChange={() => setReverseTarget(null)} title="Estornar Pagamento">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Confirmar estorno do pagamento de{' '}
                        <strong>{reverseTarget ? formatBRL(reverseTarget.amount) : ''}</strong>?
                    </p>
                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button variant="outline" onClick={() => setReverseTarget(null)}>Cancelar</Button>
                        <Button variant="danger" loading={reverseMut.isPending} onClick={confirmReverse}>Estornar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
