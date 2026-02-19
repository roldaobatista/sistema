import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { CommissionDispute, CommissionEvent } from './types'
import { fmtBRL, fmtDate } from './utils'

export function CommissionDisputesTab() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.dispute.create')
    const canResolve = hasPermission('commissions.dispute.resolve')
    const [showModal, setShowModal] = useState(false)
    const [resolveModal, setResolveModal] = useState<CommissionDispute | null>(null)
    const [resolveNotes, setResolveNotes] = useState('')
    const [resolveStatus, setResolveStatus] = useState<'accepted' | 'rejected'>('accepted')
    const [resolveNewAmount, setResolveNewAmount] = useState('')

    const { data: res, isLoading } = useQuery({ queryKey: ['commission-disputes'], queryFn: () => api.get('/commission-disputes') })
    const disputes: CommissionDispute[] = res?.data?.data ?? res?.data ?? []
    const { data: eventsRes } = useQuery({ queryKey: ['commission-events'], queryFn: () => api.get('/commission-events') })
    const events: CommissionEvent[] = eventsRes?.data?.data ?? []

    const storeMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => api.post('/commission-disputes', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-disputes'] }); setShowModal(false); toast.success('Contestação registrada') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao registrar contestação')
    })
    const resolveMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => api.put(`/commission-disputes/${id}/resolve`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['commission-disputes'] })
            qc.invalidateQueries({ queryKey: ['commission-events'] })
            setResolveModal(null); setResolveNotes(''); setResolveNewAmount('')
            toast.success('Contestação resolvida')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao resolver')
    })

    const openResolve = (dispute: CommissionDispute, status: 'accepted' | 'rejected') => {
        setResolveModal(dispute)
        setResolveStatus(status)
        setResolveNotes('')
        setResolveNewAmount('')
    }

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-default shadow-card'>
                <div><h2 className='font-semibold text-surface-900'>Contestações</h2><p className='text-xs text-surface-500'>Abra e resolva disputas de comissões.</p></div>
                {canCreate && <Button onClick={() => setShowModal(true)} icon={<Plus className='h-4 w-4' />}>Nova Contestação</Button>}
            </div>
            <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                            <tr><th className='px-4 py-3 text-left font-medium'>Data</th><th className='px-4 py-3 text-left font-medium'>Usuário</th><th className='px-4 py-3 text-left font-medium'>Motivo</th><th className='px-4 py-3 text-right font-medium'>Valor</th><th className='px-4 py-3 text-center font-medium'>Status</th><th className='px-4 py-3 text-right font-medium'>Ações</th></tr>
                        </thead>
                        <tbody className='divide-y divide-subtle'>
                            {isLoading ? <tr><td colSpan={6} className='p-8 text-center text-surface-500'>Carregando...</td></tr>
                                : disputes.length === 0 ? <tr><td colSpan={6} className='p-12 text-center'><AlertCircle className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma contestação registrada.</p></td></tr>
                                    : disputes.map(d => (
                                        <tr key={d.id} className='hover:bg-surface-50 transition-colors'>
                                            <td className='px-4 py-3 text-surface-600'>{fmtDate(d.created_at)}</td>
                                            <td className='px-4 py-3 font-medium text-surface-900'>{d.user_name ?? d.user?.name}</td>
                                            <td className='px-4 py-3 text-surface-600 max-w-xs truncate' title={d.reason}>{d.reason}</td>
                                            <td className='px-4 py-3 text-right font-semibold text-emerald-600'>{fmtBRL(d.commission_amount ?? d.commission_event?.commission_amount ?? 0)}</td>
                                            <td className='px-4 py-3 text-center'><Badge variant={d.status === 'accepted' ? 'success' : d.status === 'rejected' ? 'danger' : 'secondary'}>{d.status === 'accepted' ? 'Aceita' : d.status === 'rejected' ? 'Rejeitada' : 'Aberta'}</Badge></td>
                                            <td className='px-4 py-3 text-right'>
                                                {d.status === 'open' && canResolve && (
                                                    <div className='flex justify-end gap-1'>
                                                        <Button size='sm' className='bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2' onClick={() => openResolve(d, 'accepted')}>Aceitar</Button>
                                                        <Button size='sm' variant='outline' className='text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-2' onClick={() => openResolve(d, 'rejected')}>Rejeitar</Button>
                                                    </div>
                                                )}
                                                {d.status !== 'open' && d.resolution_notes && (
                                                    <span className='text-xs text-surface-500' title={d.resolution_notes}>
                                                        {d.resolution_notes.slice(0, 25)}{d.resolution_notes.length > 25 ? '...' : ''}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Dispute Modal */}
            <Modal open={showModal} onOpenChange={setShowModal} title='Nova Contestação'>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); storeMut.mutate({ commission_event_id: fd.get('commission_event_id'), reason: fd.get('reason') }) }} className='space-y-4'>
                    <div><label className='text-xs font-medium text-surface-700 mb-1 block'>Evento</label>
                        <select name='commission_event_id' title='Selecionar evento de comissão' required className='w-full rounded-lg border-default text-sm'>
                            <option value=''>Selecione...</option>
                            {events.filter(e => e.status === 'pending' || e.status === 'approved').map(e => <option key={e.id} value={e.id}>#{e.id} — {e.user?.name} — {fmtBRL(e.commission_amount)}</option>)}
                        </select>
                    </div>
                    <Input label='Motivo (min 10 caracteres)' name='reason' required minLength={10} />
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' type='button' onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type='submit' loading={storeMut.isPending}>Registrar</Button>
                    </div>
                </form>
            </Modal>

            {/* Resolve Dispute Modal */}
            <Modal open={!!resolveModal} onOpenChange={() => { setResolveModal(null); setResolveNotes(''); setResolveNewAmount('') }}
                title={resolveStatus === 'accepted' ? 'Aceitar Contestação' : 'Rejeitar Contestação'}>
                <div className='space-y-4'>
                    {resolveModal && (
                        <div className='bg-surface-50 rounded-lg p-3 text-sm'>
                            <p><strong>Usuário:</strong> {resolveModal.user_name ?? resolveModal.user?.name}</p>
                            <p><strong>Motivo:</strong> {resolveModal.reason}</p>
                            <p><strong>Valor Atual:</strong> {fmtBRL(resolveModal.commission_amount ?? resolveModal.commission_event?.commission_amount ?? 0)}</p>
                        </div>
                    )}
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Notas de Resolução (min 5 caracteres)</label>
                        <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} className='w-full rounded-lg border-default text-sm p-3 min-h-[80px]' placeholder='Descreva a justificativa da decisão...' />
                    </div>
                    {resolveStatus === 'accepted' && (
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Novo Valor (opcional — deixe vazio para estornar)</label>
                            <Input type='number' step='0.01' min='0' value={resolveNewAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResolveNewAmount(e.target.value)} placeholder='Ex: 150.00' />
                            <p className='text-xs text-surface-400 mt-1'>Se preenchido, o valor da comissão será ajustado. Se vazio, o evento será estornado.</p>
                        </div>
                    )}
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' onClick={() => { setResolveModal(null); setResolveNotes(''); setResolveNewAmount('') }}>Cancelar</Button>
                        <Button
                            className={resolveStatus === 'accepted' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                            loading={resolveMut.isPending}
                            disabled={resolveNotes.length < 5}
                            onClick={() => {
                                if (!resolveModal) return
                                const data: Record<string, unknown> = { status: resolveStatus, resolution_notes: resolveNotes }
                                if (resolveStatus === 'accepted' && resolveNewAmount) data.new_amount = Number(resolveNewAmount)
                                resolveMut.mutate({ id: resolveModal.id, data })
                            }}
                        >{resolveStatus === 'accepted' ? 'Confirmar Aceitação' : 'Confirmar Rejeição'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
