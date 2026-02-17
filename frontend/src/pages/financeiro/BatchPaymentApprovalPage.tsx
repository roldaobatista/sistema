import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, DollarSign, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { Modal } from '@/components/ui/modal'

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

interface Payable {
    id: number; description: string; amount: string; amount_paid: string
    due_date: string; status: string
    supplier?: { id: number; name: string }
}

export function BatchPaymentApprovalPage() {
    const qc = useQueryClient()

    const [page, setPage] = useState(1)
    const [dueBefore, setDueBefore] = useState('')
    const [minAmount, setMinAmount] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [showConfirm, setShowConfirm] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('transferencia')

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['batch-payment-approval', dueBefore, minAmount, page],
        queryFn: () => api.get('/financial/batch-payment-approval', {
            params: {
                due_before: dueBefore || undefined,
                min_amount: minAmount || undefined,
                page,
                per_page: 30,
            },
        }),
    })
    const records: Payable[] = res?.data?.data ?? []
    const pagination = { currentPage: res?.data?.current_page ?? 1, lastPage: res?.data?.last_page ?? 1, total: res?.data?.total ?? 0 }

    const totalSelected = records.filter(r => selectedIds.has(r.id)).reduce((sum, r) => sum + Number(r.amount) - Number(r.amount_paid), 0)

    const batchMut = useMutation({
        mutationFn: (ids: number[]) => api.post('/financial/batch-payment-approval', { ids, payment_method: paymentMethod }),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['batch-payment-approval'] })
            qc.invalidateQueries({ queryKey: ['accounts-payable'] })
            setSelectedIds(new Set())
            setShowConfirm(false)
            toast.success(res.data.message ?? 'Pagamentos processados')
        },
        onError: (error: unknown) => {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg ?? 'Erro ao processar pagamentos')
        },
    })

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (selectedIds.size === records.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(records.map(r => r.id)))
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Aprovação em Lote"
                subtitle="Aprove pagamentos de contas a pagar em lote"
                count={pagination.total}
            />

            <div className="flex flex-wrap gap-3 items-end">
                <Input label="Vencimento até" type="date" value={dueBefore} onChange={e => setDueBefore(e.target.value)} className="w-44" />
                <Input label="Valor mínimo" type="number" step="0.01" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="R$" className="w-36" />
            </div>

            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                    <span className="text-sm font-medium text-brand-700">{selectedIds.size} título(s) selecionado(s) — Total: {fmtBRL(totalSelected)}</span>
                    <Button size="sm" onClick={() => setShowConfirm(true)}>
                        <CheckSquare className="h-3.5 w-3.5 mr-1" /> Aprovar Pagamento
                    </Button>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left">
                                <input type="checkbox" checked={records.length > 0 && selectedIds.size === records.length} onChange={toggleAll} className="rounded border-default" />
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Fornecedor</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Vencimento</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Restante</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : isError ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-red-600">Erro ao carregar. <button className="underline" onClick={() => refetch()}>Tentar novamente</button></td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-2"><EmptyState icon={<DollarSign className="h-5 w-5 text-surface-300" />} message="Nenhuma conta pendente encontrada" compact /></td></tr>
                        ) : records.map(r => {
                            const remaining = Number(r.amount) - Number(r.amount_paid)
                            const isOverdue = new Date(r.due_date) < new Date()
                            return (
                                <tr key={r.id} className={`hover:bg-surface-50 transition-colors ${selectedIds.has(r.id) ? 'bg-brand-50/40' : ''}`}>
                                    <td className="px-4 py-3">
                                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-default" />
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-surface-900">{r.description}</td>
                                    <td className="px-4 py-3 text-sm text-surface-600">{r.supplier?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-surface-500'}>
                                            {fmtDate(r.due_date)}
                                            {isOverdue && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-red-500" />}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-surface-600">{fmtBRL(r.amount)}</td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-surface-900">{fmtBRL(remaining)}</td>
                                </tr>
                            )
                        })}
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

            <Modal open={showConfirm} onOpenChange={setShowConfirm} title="Confirmar Pagamento em Lote">
                <div className="space-y-4">
                    <div className="rounded-lg bg-amber-50 p-3 text-sm">
                        <p className="font-medium text-amber-800"><AlertTriangle className="inline h-4 w-4 mr-1" /> {selectedIds.size} título(s) serão pagos</p>
                        <p className="text-amber-700 mt-1">Total: {fmtBRL(totalSelected)}</p>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Forma de Pagamento</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} aria-label="Forma de pagamento" className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="transferencia">Transferência</option>
                            <option value="pix">PIX</option>
                            <option value="boleto">Boleto</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="cheque">Cheque</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
                        <Button loading={batchMut.isPending} onClick={() => batchMut.mutate([...selectedIds])}>Confirmar Pagamento</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
