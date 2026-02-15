import { useMemo , useState } from 'react'
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Clock, CheckCircle, AlertTriangle, Receipt } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { FINANCIAL_STATUS } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth-store'

const fmtBRL = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

const statusCfg: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    [FINANCIAL_STATUS.PENDING]: { label: 'Pendente', color: 'text-amber-600', bg: 'bg-amber-100', icon: Clock },
    [FINANCIAL_STATUS.PARTIAL]: { label: 'Parcial', color: 'text-sky-600', bg: 'bg-sky-100', icon: DollarSign },
    [FINANCIAL_STATUS.PAID]: { label: 'Pago', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
    [FINANCIAL_STATUS.OVERDUE]: { label: 'Atrasado', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
}

export function PortalFinancialsPage() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/portal-financials/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['portal-financials'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['portal-financials'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/portal/financials').then(res => res.data),
    })

    const financials: any[] = data ?? []

    const summary = useMemo(() => {
        let pending = 0, paid = 0, overdue = 0
        financials.forEach(f => {
            const amt = parseFloat(f.amount ?? 0)
            if (f.status === FINANCIAL_STATUS.PAID) paid += amt
            else {
                const isOverdue = new Date(f.due_date) < new Date()
                if (isOverdue) overdue += amt
                else pending += amt
            }
        })
        return { pending, paid, overdue, total: pending + paid + overdue }
    }, [financials])

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Financeiro</h1>
                <p className="mt-0.5 text-[13px] text-surface-500">Suas faturas e pagamentos</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-amber-600"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Pendente</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.pending)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-medium">Atrasado</span></div>
                    <p className="mt-1 text-xl font-bold text-red-600">{fmtBRL(summary.overdue)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-emerald-600"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Pago</span></div>
                    <p className="mt-1 text-xl font-bold text-emerald-600">{fmtBRL(summary.paid)}</p>
                </div>
            </div>

            {/* Financials List */}
            {isLoading ? (
                <div className="text-center text-surface-400 py-12">Carregando...</div>
            ) : financials.length === 0 ? (
                <div className="text-center py-12">
                    <Receipt className="mx-auto h-10 w-10 text-surface-300" />
                    <p className="mt-2 text-sm text-surface-400">Nenhuma fatura encontrada</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {financials.map((item: any) => {
                        const isOverdue = item.status !== FINANCIAL_STATUS.PAID && new Date(item.due_date) < new Date()
                        const effectiveStatus = isOverdue ? 'overdue' : item.status
                        const cfg = statusCfg[effectiveStatus] ?? statusCfg.pending
                        const StatusIcon = cfg.icon
                        return (
                            <div key={item.id} className={cn(
                                'rounded-xl border bg-white p-4 shadow-card flex items-center gap-4 transition-all hover:shadow-elevated',
                                isOverdue ? 'border-red-200' : 'border-surface-200'
                            )}>
                                <div className={cn('rounded-lg p-2.5 flex-shrink-0', cfg.bg)}>
                                    <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-surface-900">{item.description || `Fatura #${item.id}`}</p>
                                    <p className="text-xs text-surface-400 mt-0.5">Vencimento: {fmtDate(item.due_date)}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold text-surface-900">{fmtBRL(item.amount)}</p>
                                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                                        {cfg.label}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
