import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckCircle, DollarSign, Clock, User } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { Modal } from '@/components/ui/modal'

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

interface Expense {
    id: number
    description: string
    amount: string
    date?: string
    expense_date?: string
    status: string
    creator?: { id: number; name: string }
    category?: { id: number; name: string; color?: string }
}

export function ExpenseReimbursementsPage() {
    const qc = useQueryClient()
    const [statusFilter, setStatusFilter] = useState('approved')
    const [confirmTarget, setConfirmTarget] = useState<Expense | null>(null)

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['expense-reimbursements', statusFilter],
        queryFn: () => api.get('/financial/expense-reimbursements', { params: { status: statusFilter === 'reimbursed' ? 'approved' : 'pending' } }),
    })
    const records: Expense[] = res?.data?.data ?? []
    const pagination = { currentPage: res?.data?.current_page ?? 1, lastPage: res?.data?.last_page ?? 1, total: res?.data?.total ?? 0 }
    const [page, setPage] = useState(1)

    const approveMut = useMutation({
        mutationFn: (id: number) => api.post(`/financial/expense-reimbursements/${id}/approve`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expense-reimbursements'] })
            setConfirmTarget(null)
            toast.success('Reembolso aprovado com sucesso')
        },
        onError: (error: unknown) => {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg ?? 'Erro ao aprovar reembolso')
        },
    })

    return (
        <div className="space-y-5">
            <PageHeader title="Reembolso de Despesas" subtitle="Despesas aprovadas aguardando reembolso" count={pagination.total} />

            <div className="flex gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filtrar por status"
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                    <option value="approved">Aguardando Reembolso</option>
                    <option value="reimbursed">Reembolsadas</option>
                </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Solicitante</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Categoria</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Data</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : isError ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-red-600">Erro ao carregar. <button className="underline" onClick={() => refetch()}>Tentar novamente</button></td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-2"><EmptyState icon={<DollarSign className="h-5 w-5 text-surface-300" />} message="Nenhuma despesa encontrada" compact /></td></tr>
                        ) : records.map(r => (
                            <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-surface-900">{r.description}</td>
                                <td className="px-4 py-3 text-sm text-surface-600">{r.creator?.name ?? '—'}</td>
                                <td className="px-4 py-3">
                                    {r.category ? (
                                        <Badge variant="default">
                                            <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: r.category.color ?? '#666' }} />
                                            {r.category.name}
                                        </Badge>
                                    ) : '—'}
                                </td>
                                <td className="px-4 py-3 text-sm text-surface-500">{fmtDate(r.expense_date ?? r.date ?? '')}</td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-surface-900">{fmtBRL(r.amount)}</td>
                                <td className="px-4 py-3 text-right">
                                    {statusFilter === 'approved' && (
                                        <Button size="sm" onClick={() => setConfirmTarget(r)}>
                                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Reembolsar
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {pagination.lastPage > 1 && (
                <div className="flex items-center justify-between rounded-xl border border-default bg-surface-0 px-4 py-3 shadow-card">
                    <span className="text-sm text-surface-500">{pagination.total} registro(s)</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={pagination.currentPage <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                        <span className="text-sm text-surface-700">Página {pagination.currentPage} de {pagination.lastPage}</span>
                        <Button variant="outline" size="sm" disabled={pagination.currentPage >= pagination.lastPage} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                    </div>
                </div>
            )}

            <Modal open={!!confirmTarget} onOpenChange={() => setConfirmTarget(null)} title="Confirmar Reembolso">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Confirma o reembolso desta despesa?</p>
                    {confirmTarget && (
                        <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                            <p className="font-medium text-emerald-800">{confirmTarget.description}</p>
                            <p className="text-emerald-700">{fmtBRL(confirmTarget.amount)} — {confirmTarget.creator?.name ?? ''}</p>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setConfirmTarget(null)}>Cancelar</Button>
                        <Button loading={approveMut.isPending} onClick={() => { if (confirmTarget) approveMut.mutate(confirmTarget.id) }}>Confirmar Reembolso</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
