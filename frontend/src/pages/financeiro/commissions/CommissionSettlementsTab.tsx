import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, CheckCircle, XCircle, Download, Wallet, RefreshCw, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { CommissionSettlement, UserOption, BalanceSummary } from './types'
import { fmtBRL, fmtDate, settlementStatusLabel, settlementStatusVariant } from './utils'

export function CommissionSettlementsTab() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canManage = hasPermission('commissions.settlement.create')
    const canApprove = hasPermission('commissions.settlement.approve')

    const [closePeriod, setClosePeriod] = useState(new Date().toISOString().slice(0, 7))
    const [closeUserId, setCloseUserId] = useState('')
    const [balanceUserId, setBalanceUserId] = useState('')

    const { data: settRes, isLoading } = useQuery({ queryKey: ['commission-settlements'], queryFn: () => api.get('/commission-settlements') })
    const settlements: CommissionSettlement[] = settRes?.data?.data ?? settRes?.data ?? []

    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users: UserOption[] = usersRes?.data ?? []

    const { data: balanceRes } = useQuery({
        queryKey: ['commission-balance', balanceUserId],
        queryFn: () => api.get('/commission-settlements/balance-summary', { params: { user_id: balanceUserId } }),
        enabled: !!balanceUserId,
    })
    const balance: BalanceSummary | null = balanceRes?.data ?? null

    const [payError, setPayError] = useState<string | null>(null)
    const [confirmAction, setConfirmAction] = useState<{ type: 'reopen' | 'approve'; id: number } | null>(null)
    const [payModal, setPayModal] = useState<{ id: number; total_amount: number } | null>(null)
    const [payAmount, setPayAmount] = useState('')
    const [payNotes, setPayNotes] = useState('')
    const [rejectModal, setRejectModal] = useState<{ id: number } | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [batchModal, setBatchModal] = useState(false)
    const [batchUserId, setBatchUserId] = useState('')
    const [batchDateFrom, setBatchDateFrom] = useState('')
    const [batchDateTo, setBatchDateTo] = useState('')
    const [previewPdf, setPreviewPdf] = useState<{ url: string; userId: number; period: string } | null>(null)

    const invalidateAll = () => {
        qc.invalidateQueries({ queryKey: ['commission-settlements'] })
        qc.invalidateQueries({ queryKey: ['commission-events'] })
        qc.invalidateQueries({ queryKey: ['commission-overview'] })
        qc.invalidateQueries({ queryKey: ['commission-balance'] })
        broadcastQueryInvalidation(['commission-settlements', 'commission-events', 'commission-overview', 'commission-balance'], 'Comissão')
    }

    const closeMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => api.post('/commission-settlements/close', data),
        onSuccess: () => { invalidateAll(); toast.success('Período fechado com sucesso') },
        onError: (err: any) => { toast.error(err?.response?.data?.message ?? 'Erro ao fechar período') }
    })

    const payMut = useMutation({
        mutationFn: ({ id, paid_amount, payment_notes }: { id: number; paid_amount: number; payment_notes: string }) =>
            api.post(`/commission-settlements/${id}/pay`, { paid_amount, payment_notes }),
        onSuccess: () => { invalidateAll(); setPayError(null); setPayModal(null); setPayAmount(''); setPayNotes(''); toast.success('Pagamento registrado') },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao pagar fechamento'; setPayError(msg); toast.error(msg) }
    })

    const reopenMut = useMutation({
        mutationFn: (id: number) => api.post(`/commission-settlements/${id}/reopen`),
        onSuccess: () => { invalidateAll(); toast.success('Fechamento reaberto') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao reabrir fechamento')
    })

    const approveMut = useMutation({
        mutationFn: (id: number) => api.post(`/commission-settlements/${id}/approve`),
        onSuccess: () => { invalidateAll(); toast.success('Fechamento aprovado') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao aprovar fechamento')
    })

    const rejectMut = useMutation({
        mutationFn: ({ id, rejection_reason }: { id: number; rejection_reason: string }) => api.post(`/commission-settlements/${id}/reject`, { rejection_reason }),
        onSuccess: () => { invalidateAll(); setRejectModal(null); setRejectReason(''); toast.success('Fechamento rejeitado') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao rejeitar fechamento')
    })

    const batchGenMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => api.post('/commission-events/batch-generate', data),
        onSuccess: (res: any) => {
            const d = res?.data?.data ?? res?.data
            toast.success(d?.message ?? `${d?.generated ?? 0} comissões geradas`)
            invalidateAll()
            setBatchModal(false)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao gerar em lote')
    })

    const handleExportSettlements = async () => {
        try {
            const res = await api.get('/commission-settlements/export', { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const a = document.createElement('a'); a.href = url; a.download = 'fechamentos.csv'; a.click()
            window.URL.revokeObjectURL(url)
        } catch { toast.error('Erro ao exportar') }
    }

    const handlePreviewStatement = async (userId: number, period: string) => {
        try {
            const res = await api.get(`/commission-statement/pdf`, { params: { user_id: userId, period }, responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
            setPreviewPdf({ url, userId, period })
        } catch { toast.error('Erro ao carregar PDF') }
    }

    const handleDownloadStatement = () => {
        if (!previewPdf) return
        const a = document.createElement('a')
        a.href = previewPdf.url
        a.download = `extrato-${previewPdf.period}-${previewPdf.userId}.pdf`
        a.click()
    }

    return (
        <div className='space-y-4'>
            {/* Saldo Acumulado */}
            <div className='bg-surface-0 border border-default rounded-xl p-4 shadow-card space-y-4'>
                <h2 className='font-semibold text-surface-900'>Saldo Acumulado</h2>
                <div className='flex flex-wrap gap-3 items-end'>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Beneficiário</label>
                        <select title='Selecionar beneficiário' value={balanceUserId} onChange={(e) => setBalanceUserId(e.target.value)} className='w-48 rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500 h-9 px-2'>
                            <option value=''>Selecione...</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                </div>
                {balance && (
                    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                        <div className='rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center'>
                            <p className='text-xl font-bold text-emerald-700'>{fmtBRL(balance.total_earned)}</p>
                            <p className='text-xs font-medium text-emerald-600 mt-0.5'>Total Calculado</p>
                        </div>
                        <div className='rounded-xl border border-sky-200 bg-sky-50 p-3 text-center'>
                            <p className='text-xl font-bold text-sky-700'>{fmtBRL(balance.total_paid)}</p>
                            <p className='text-xs font-medium text-sky-600 mt-0.5'>Total Pago</p>
                        </div>
                        <div className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-center'>
                            <p className='text-xl font-bold text-amber-700'>{fmtBRL(balance.balance)}</p>
                            <p className='text-xs font-medium text-amber-600 mt-0.5'>Saldo a Receber</p>
                        </div>
                        <div className='rounded-xl border border-surface-200 bg-surface-50 p-3 text-center'>
                            <p className='text-xl font-bold text-surface-700'>{fmtBRL(balance.pending_unsettled)}</p>
                            <p className='text-xs font-medium text-surface-600 mt-0.5'>Pendente (sem fechamento)</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Fechar Período + Gerar em Lote */}
            <div className='bg-surface-0 border border-default rounded-xl p-4 shadow-card space-y-4'>
                <h2 className='font-semibold text-surface-900'>Fechar Período</h2>
                <div className='flex flex-wrap gap-3 items-end'>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Período</label>
                        <Input type='month' value={closePeriod} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClosePeriod(e.target.value)} className='w-40' />
                    </div>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Usuário</label>
                        <select title='Selecionar usuário para fechamento' value={closeUserId} onChange={(e) => setCloseUserId(e.target.value)} className='w-48 rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500 h-9 px-2'>
                            <option value=''>Selecione...</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <Button onClick={() => { if (!closeUserId) return toast.error('Selecione um usuário'); closeMut.mutate({ user_id: closeUserId, period: closePeriod }) }} loading={closeMut.isPending} icon={<Calendar className='h-4 w-4' />}>Fechar Período</Button>
                    {canManage && <Button variant='outline' onClick={() => setBatchModal(true)} icon={<RefreshCw className='h-4 w-4' />}>Gerar Comissões em Lote</Button>}
                </div>
                {payError && <p className='text-sm text-red-600 bg-red-50 rounded-lg p-3'>{payError} <button className='underline ml-2' onClick={() => setPayError(null)}>Fechar</button></p>}
            </div>

            <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
                <div className='p-4 border-b border-default flex justify-between items-center'>
                    <h2 className='font-semibold text-surface-900'>Fechamentos Realizados</h2>
                    <Button variant='outline' size='sm' onClick={handleExportSettlements} icon={<Download className='h-3 w-3' />}>Exportar CSV</Button>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                            <tr>
                                <th className='px-4 py-3 text-left font-medium'>Período</th>
                                <th className='px-4 py-3 text-left font-medium'>Beneficiário</th>
                                <th className='px-4 py-3 text-right font-medium'>Eventos</th>
                                <th className='px-4 py-3 text-right font-medium'>Calculado</th>
                                <th className='px-4 py-3 text-right font-medium'>Pago</th>
                                <th className='px-4 py-3 text-right font-medium'>Saldo</th>
                                <th className='px-4 py-3 text-center font-medium'>Status</th>
                                <th className='px-4 py-3 text-center font-medium'>Pago Em</th>
                                <th className='px-4 py-3 text-right font-medium'>Ações</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-subtle'>
                            {isLoading ? (
                                <tr><td colSpan={9} className='p-8 text-center text-surface-500'>Carregando...</td></tr>
                            ) : settlements.length === 0 ? (
                                <tr><td colSpan={9} className='p-12 text-center'><Calendar className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhum fechamento realizado.</p></td></tr>
                            ) : settlements.map((s) => (
                                <tr key={s.id} className='hover:bg-surface-50 transition-colors'>
                                    <td className='px-4 py-3 font-medium text-surface-900'>{s.period}</td>
                                    <td className='px-4 py-3 text-surface-700'>{s.user?.name}</td>
                                    <td className='px-4 py-3 text-right text-surface-600'>{s.events_count}</td>
                                    <td className='px-4 py-3 text-right font-semibold text-emerald-600'>{fmtBRL(s.total_amount)}</td>
                                    <td className='px-4 py-3 text-right font-semibold text-sky-600'>{s.paid_amount != null ? fmtBRL(s.paid_amount) : '—'}</td>
                                    <td className='px-4 py-3 text-right font-semibold'><span className={Number(s.balance ?? 0) > 0 ? 'text-amber-600' : 'text-surface-400'}>{s.balance != null ? fmtBRL(s.balance) : '—'}</span></td>
                                    <td className='px-4 py-3 text-center'>
                                        <Badge variant={settlementStatusVariant(s.status)}>{settlementStatusLabel(s.status)}</Badge>
                                        {s.rejection_reason && <p className='text-xs text-red-500 mt-1' title={s.rejection_reason}>Motivo: {s.rejection_reason.slice(0, 30)}...</p>}
                                        {s.payment_notes && <p className='text-xs text-surface-500 mt-1' title={s.payment_notes}>Obs: {s.payment_notes.slice(0, 30)}{s.payment_notes.length > 30 ? '...' : ''}</p>}
                                    </td>
                                    <td className='px-4 py-3 text-center text-surface-500'>{s.paid_at ? fmtDate(s.paid_at) : '—'}</td>
                                    <td className='px-4 py-3 text-right'>
                                        <div className='flex justify-end gap-1 flex-wrap'>
                                            <Button size='sm' variant='outline' className='h-7 text-xs px-2' onClick={() => handlePreviewStatement(s.user_id, s.period)} icon={<Download className='h-3 w-3' />}>PDF</Button>
                                            {canApprove && s.status === 'closed' && (
                                                <>
                                                    <Button size='sm' className='bg-sky-600 hover:bg-sky-700 text-white h-7 text-xs px-2' onClick={() => setConfirmAction({ type: 'approve', id: s.id })} loading={approveMut.isPending} icon={<CheckCircle className='h-3 w-3' />}>Aprovar</Button>
                                                    <Button size='sm' variant='outline' className='text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-2' onClick={() => setRejectModal({ id: s.id })} icon={<XCircle className='h-3 w-3' />}>Rejeitar</Button>
                                                </>
                                            )}
                                            {canManage && (s.status === 'closed' || s.status === 'approved') && (
                                                <Button size='sm' className='bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2' onClick={() => { setPayModal({ id: s.id, total_amount: Number(s.total_amount) }); setPayAmount(String(Number(s.total_amount).toFixed(2))) }} loading={payMut.isPending} icon={<Wallet className='h-3 w-3' />}>Pagar</Button>
                                            )}
                                            {canManage && ['closed', 'approved', 'rejected'].includes(s.status) && (
                                                <Button size='sm' variant='outline' className='h-7 text-xs px-2' onClick={() => setConfirmAction({ type: 'reopen', id: s.id })} loading={reopenMut.isPending} icon={<RotateCcw className='h-3 w-3' />}>Reabrir</Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PDF Preview Modal */}
            <Modal open={!!previewPdf} onOpenChange={() => { if (previewPdf) { window.URL.revokeObjectURL(previewPdf.url); setPreviewPdf(null) } }} title='Preview do Extrato'>
                <div className='space-y-4'>
                    {previewPdf && (
                        <iframe src={previewPdf.url} className='w-full h-[60vh] rounded-lg border border-default' title='Preview PDF' />
                    )}
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' onClick={() => { if (previewPdf) { window.URL.revokeObjectURL(previewPdf.url); setPreviewPdf(null) } }}>Fechar</Button>
                        <Button onClick={handleDownloadStatement} icon={<Download className='h-4 w-4' />}>Baixar PDF</Button>
                    </div>
                </div>
            </Modal>

            {/* Pay Modal */}
            <Modal open={!!payModal} onOpenChange={() => { setPayModal(null); setPayAmount(''); setPayNotes('') }} title='Registrar Pagamento'>
                <div className='space-y-4'>
                    <p className='text-sm text-surface-600'>Informe o valor efetivamente pago. O valor calculado é <strong>{payModal ? fmtBRL(payModal.total_amount) : ''}</strong>.</p>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Valor Pago (R$)</label>
                        <Input type='number' step='0.01' min='0' value={payAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayAmount(e.target.value)} placeholder='0.00' />
                    </div>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Observações</label>
                        <textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} className='w-full rounded-lg border-default text-sm p-3 min-h-[60px]' placeholder='Ex: Pago via PIX em 15/03/2025...' />
                    </div>
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' onClick={() => { setPayModal(null); setPayAmount(''); setPayNotes('') }}>Cancelar</Button>
                        <Button className='bg-emerald-600 hover:bg-emerald-700 text-white' loading={payMut.isPending}
                            onClick={() => { if (payModal) payMut.mutate({ id: payModal.id, paid_amount: parseFloat(payAmount) || 0, payment_notes: payNotes }) }}>Confirmar Pagamento</Button>
                    </div>
                </div>
            </Modal>

            {/* Confirm Modal (approve/reopen) */}
            <Modal open={!!confirmAction} onOpenChange={() => setConfirmAction(null)} title={confirmAction?.type === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Reabertura'}>
                <p className='text-sm text-surface-600 py-2'>
                    {confirmAction?.type === 'approve' ? 'Deseja aprovar este fechamento? Após aprovação, poderá ser marcado como pago.'
                        : 'Deseja reabrir este fechamento? Os eventos voltarão ao status pendente.'}
                </p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setConfirmAction(null)}>Cancelar</Button>
                    <Button
                        className={confirmAction?.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                        loading={confirmAction?.type === 'approve' ? approveMut.isPending : reopenMut.isPending}
                        onClick={() => {
                            if (confirmAction?.type === 'approve') approveMut.mutate(confirmAction.id)
                            else if (confirmAction) reopenMut.mutate(confirmAction.id)
                            setConfirmAction(null)
                        }}
                    >{confirmAction?.type === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Reabertura'}</Button>
                </div>
            </Modal>

            {/* Reject Modal */}
            <Modal open={!!rejectModal} onOpenChange={() => { setRejectModal(null); setRejectReason('') }} title='Rejeitar Fechamento'>
                <div className='space-y-4'>
                    <p className='text-sm text-surface-600'>Informe o motivo da rejeição. O fechamento voltará para status "aberto".</p>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Motivo da Rejeição</label>
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className='w-full rounded-lg border-default text-sm p-3 min-h-[80px]' placeholder='Ex: Valores divergem do relatório...' required />
                    </div>
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' onClick={() => { setRejectModal(null); setRejectReason('') }}>Cancelar</Button>
                        <Button className='bg-red-600 hover:bg-red-700 text-white' loading={rejectMut.isPending} disabled={rejectReason.length < 5}
                            onClick={() => { if (rejectModal) rejectMut.mutate({ id: rejectModal.id, rejection_reason: rejectReason }) }}>Rejeitar Fechamento</Button>
                    </div>
                </div>
            </Modal>

            {/* Batch Generate Modal */}
            <Modal open={batchModal} onOpenChange={() => setBatchModal(false)} title='Gerar Comissões em Lote'>
                <div className='space-y-4'>
                    <p className='text-sm text-surface-600'>Selecione o técnico e o período. O sistema gerará comissões para todas as OS que ainda não possuem comissão.</p>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Técnico</label>
                        <select title='Selecionar técnico para lote' value={batchUserId} onChange={(e) => setBatchUserId(e.target.value)} className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500 h-9 px-2'>
                            <option value=''>Todos</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div className='grid grid-cols-2 gap-3'>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Data Início</label>
                            <Input type='date' value={batchDateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBatchDateFrom(e.target.value)} />
                        </div>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Data Fim</label>
                            <Input type='date' value={batchDateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBatchDateTo(e.target.value)} />
                        </div>
                    </div>
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' onClick={() => setBatchModal(false)}>Cancelar</Button>
                        <Button className='bg-brand-600 hover:bg-brand-700 text-white' loading={batchGenMut.isPending}
                            disabled={!batchDateFrom || !batchDateTo}
                            onClick={() => batchGenMut.mutate({ user_id: batchUserId || undefined, date_from: batchDateFrom, date_to: batchDateTo })}>Gerar Comissões</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
