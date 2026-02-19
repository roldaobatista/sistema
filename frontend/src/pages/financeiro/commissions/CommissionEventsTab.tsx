import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Wallet, RefreshCw, Trash2, Download, Split } from 'lucide-react'
import api from '@/lib/api'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { CommissionEvent, UserOption } from './types'
import { fmtBRL, fmtDate } from './utils'

interface CommissionEventsTabProps {
    initialFilters?: Record<string, string>
}

export function CommissionEventsTab({ initialFilters }: CommissionEventsTabProps) {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canUpdate = hasPermission('commissions.rule.update')

    const [eventError, setEventError] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState(initialFilters?.status ?? '')
    const [filterPeriod, setFilterPeriod] = useState(initialFilters?.period ?? '')
    const [filterUserId, setFilterUserId] = useState(initialFilters?.user_id ?? '')
    const [filterOs, setFilterOs] = useState(initialFilters?.os_number ?? '')
    const [page, setPage] = useState(1)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [splitEvent, setSplitEvent] = useState<CommissionEvent | null>(null)
    const [splitRows, setSplitRows] = useState<{ user_id: string; percentage: string }[]>([{ user_id: '', percentage: '50' }, { user_id: '', percentage: '50' }])

    const params: Record<string, string | number> = { page, per_page: 50 }
    if (filterStatus) params.status = filterStatus
    if (filterPeriod) params.period = filterPeriod
    if (filterUserId) params.user_id = filterUserId
    if (filterOs) params.os_number = filterOs

    const { data: eventsRes, isLoading } = useQuery({
        queryKey: ['commission-events', params],
        queryFn: () => api.get('/commission-events', { params }),
    })
    const eventsData = eventsRes?.data?.data ?? eventsRes?.data ?? []
    const events: CommissionEvent[] = Array.isArray(eventsData) ? eventsData : eventsData.data ?? []
    const pagination = eventsData.meta ?? eventsData
    const lastPage = pagination?.last_page ?? 1

    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users: UserOption[] = usersRes?.data ?? []

    const approveMut = useMutation({
        mutationFn: (id: number) => api.put(`/commission-events/${id}/status`, { status: 'approved' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['commission-events'] });
            qc.invalidateQueries({ queryKey: ['commission-overview'] }); broadcastQueryInvalidation(['commission-events', 'commission-overview'], 'Comissão'); setEventError(null); toast.success('Evento aprovado')
        },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao aprovar evento'; setEventError(msg); toast.error(msg) }
    })

    const reverseMut = useMutation({
        mutationFn: (id: number) => api.put(`/commission-events/${id}/status`, { status: 'reversed' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['commission-events'] });
            qc.invalidateQueries({ queryKey: ['commission-overview'] }); broadcastQueryInvalidation(['commission-events', 'commission-overview'], 'Comissão'); setEventError(null); toast.success('Evento estornado')
        },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao estornar evento'; setEventError(msg); toast.error(msg) }
    })

    const batchMut = useMutation({
        mutationFn: (data: { ids: number[]; status: string }) => api.post('/commission-events/batch-status', data),
        onSuccess: (_, vars) => {
            qc.invalidateQueries({ queryKey: ['commission-events'] })
            qc.invalidateQueries({ queryKey: ['commission-overview'] })
            broadcastQueryInvalidation(['commission-events', 'commission-overview'], 'Comissão')
            setSelectedIds(new Set())
            toast.success(`${vars.ids.length} eventos ${vars.status === 'approved' ? 'aprovados' : 'estornados'}`)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao processar lote')
    })

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const pendingEvents = events.filter(ev => ev.status === 'pending')
    const toggleAll = () => {
        if (selectedIds.size === pendingEvents.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(pendingEvents.map(ev => ev.id)))
    }

    const handleExport = async () => {
        try {
            const res = await api.get('/commission-events/export', { params, responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const a = document.createElement('a'); a.href = url; a.download = 'comissoes_eventos.csv'; a.click()
            window.URL.revokeObjectURL(url)
        } catch { toast.error('Erro ao exportar eventos') }
    }

    const splitMut = useMutation({
        mutationFn: ({ eventId, splits }: { eventId: number; splits: { user_id: number; percentage: number }[] }) => api.post(`/commission-events/${eventId}/splits`, { splits }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] }); broadcastQueryInvalidation(['commission-events'], 'Comissão'); setSplitEvent(null); toast.success('Comissão dividida com sucesso') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao dividir comissão')
    })

    const { data: splitDataRes } = useQuery({
        queryKey: ['commission-splits', splitEvent?.id],
        queryFn: () => api.get(`/commission-events/${splitEvent!.id}/splits`),
        enabled: !!splitEvent,
    })
    const existingSplits = splitDataRes?.data ?? []

    const [confirmEvAction, setConfirmEvAction] = useState<{ type: 'reverse' | 'batch_reverse'; id?: number } | null>(null)

    const openSplitModal = (ev: CommissionEvent) => {
        setSplitEvent(ev)
        setSplitRows([{ user_id: '', percentage: '50' }, { user_id: '', percentage: '50' }])
    }

    return (<>
        <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
            <div className='p-4 border-b border-default flex flex-col gap-3'>
                <div className='flex justify-between items-center'>
                    <h2 className='font-semibold text-surface-900'>Eventos de Comissão</h2>
                    <div className='flex gap-2'>
                        <Button variant='outline' size='sm' onClick={handleExport} icon={<Download className='h-3 w-3' />}>Exportar CSV</Button>
                        <Button variant='outline' size='sm' onClick={() => qc.invalidateQueries({ queryKey: ['commission-events'] })} icon={<RefreshCw className='h-3 w-3' />}>Atualizar</Button>
                    </div>
                </div>
                {/* Filters */}
                <div className='flex flex-wrap gap-2 items-end'>
                    <div>
                        <label className='text-xs font-medium text-surface-500 mb-0.5 block'>Status</label>
                        <select title='Filtrar por status' value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className='h-8 rounded-lg border-default text-xs px-2 w-28'>
                            <option value=''>Todos</option>
                            <option value='pending'>Pendente</option>
                            <option value='approved'>Aprovado</option>
                            <option value='paid'>Pago</option>
                            <option value='reversed'>Estornado</option>
                        </select>
                    </div>
                    <div>
                        <label className='text-xs font-medium text-surface-500 mb-0.5 block'>Período</label>
                        <Input type='month' value={filterPeriod} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFilterPeriod(e.target.value); setPage(1) }} className='h-8 text-xs w-36' />
                    </div>
                    <div>
                        <label className='text-xs font-medium text-surface-500 mb-0.5 block'>Usuário</label>
                        <select title='Filtrar por usuário' value={filterUserId} onChange={e => { setFilterUserId(e.target.value); setPage(1) }} className='h-8 rounded-lg border-default text-xs px-2 w-40'>
                            <option value=''>Todos</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className='text-xs font-medium text-surface-500 mb-0.5 block'>Nº OS</label>
                        <Input placeholder='Ex: 1234' value={filterOs} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFilterOs(e.target.value); setPage(1) }} className='h-8 text-xs w-24' />
                    </div>
                    {(filterStatus || filterPeriod || filterUserId || filterOs) && (
                        <Button variant='ghost' size='sm' className='h-8 text-xs' onClick={() => { setFilterStatus(''); setFilterPeriod(''); setFilterUserId(''); setFilterOs(''); setPage(1) }}>Limpar</Button>
                    )}
                </div>
                {/* Batch actions */}
                {canUpdate && selectedIds.size > 0 && (
                    <div className='flex items-center gap-2 bg-brand-50 rounded-lg px-3 py-2'>
                        <span className='text-xs font-medium text-brand-700'>{selectedIds.size} selecionado(s)</span>
                        <Button size='sm' className='h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white' loading={batchMut.isPending}
                            onClick={() => batchMut.mutate({ ids: [...selectedIds], status: 'approved' })}>Aprovar Lote</Button>
                        <Button size='sm' variant='outline' className='h-7 text-xs text-red-600 border-red-200' loading={batchMut.isPending}
                            onClick={() => setConfirmEvAction({ type: 'batch_reverse' })}>Estornar Lote</Button>
                    </div>
                )}
            </div>

            {eventError && <div className='mx-4 mt-2 text-sm text-red-600 bg-red-50 rounded-lg p-3'>{eventError} <button className='underline ml-2' onClick={() => setEventError(null)}>Fechar</button></div>}

            <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                        <tr>
                            {canUpdate && (
                                <th className='px-3 py-3 w-8'>
                                    <input type='checkbox' aria-label='Selecionar todos os pendentes' checked={pendingEvents.length > 0 && selectedIds.size === pendingEvents.length} onChange={toggleAll} className='rounded border-default' />
                                </th>
                            )}
                            <th className='px-4 py-3 text-left font-medium'>Data</th>
                            <th className='px-4 py-3 text-left font-medium'>Beneficiário</th>
                            <th className='px-4 py-3 text-left font-medium'>Origem</th>
                            <th className='px-4 py-3 text-right font-medium'>Valor</th>
                            <th className='px-4 py-3 text-center font-medium'>Status</th>
                            {canUpdate && <th className='px-4 py-3 text-right font-medium'>Ações</th>}
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-subtle'>
                        {isLoading ? (
                            <tr><td colSpan={canUpdate ? 7 : 5} className='p-8 text-center text-surface-500'>Carregando eventos...</td></tr>
                        ) : events.length === 0 ? (
                            <tr><td colSpan={canUpdate ? 7 : 5} className='p-12 text-center'><Wallet className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhum evento registrado.</p></td></tr>
                        ) : events.map((ev) => (
                            <tr key={ev.id} className='hover:bg-surface-50 transition-colors'>
                                {canUpdate && (
                                    <td className='px-3 py-3'>
                                        {ev.status === 'pending' && <input type='checkbox' aria-label={`Selecionar evento ${ev.id}`} checked={selectedIds.has(ev.id)} onChange={() => toggleSelect(ev.id)} className='rounded border-default' />}
                                    </td>
                                )}
                                <td className='px-4 py-3 text-surface-600 whitespace-nowrap'>
                                    {fmtDate(ev.created_at)}
                                    <span className='block text-xs text-surface-400'>
                                        {new Date(ev.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </td>
                                <td className='px-4 py-3 font-medium text-surface-900'>{ev.user?.name}</td>
                                <td className='px-4 py-3'>
                                    <div className='flex items-center gap-1.5'>
                                        <Badge variant='outline' className='text-xs'>{ev.rule?.name ?? 'Manual'}</Badge>
                                        {ev.work_order && (
                                            <span className='text-xs text-brand-600 font-medium bg-brand-50 px-1.5 py-0.5 rounded'>
                                                OS #{ev.work_order.os_number || ev.work_order.number}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className='px-4 py-3 text-right font-semibold text-emerald-600'>{fmtBRL(ev.commission_amount)}</td>
                                <td className='px-4 py-3 text-center'>
                                    <Badge variant={ev.status === 'approved' ? 'success' : ev.status === 'paid' ? 'default' : ev.status === 'reversed' ? 'danger' : 'secondary'}>
                                        {ev.status === 'approved' ? 'Aprovado' : ev.status === 'paid' ? 'Pago' : ev.status === 'reversed' ? 'Estorno' : 'Pendente'}
                                    </Badge>
                                </td>
                                {canUpdate && (
                                    <td className='px-4 py-3 text-right'>
                                        <div className='flex justify-end gap-1'>
                                            {ev.status === 'pending' && (
                                                <>
                                                    <Button size='sm' className='bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2'
                                                        onClick={() => approveMut.mutate(ev.id)} loading={approveMut.isPending}>Aprovar</Button>
                                                    <Button size='sm' variant='outline' className='text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-2'
                                                        onClick={() => setConfirmEvAction({ type: 'reverse', id: ev.id })}>Rejeitar</Button>
                                                </>
                                            )}
                                            {ev.status === 'approved' && (
                                                <>
                                                    <Button size='sm' variant='outline' className='text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-2'
                                                        onClick={() => setConfirmEvAction({ type: 'reverse', id: ev.id })}>Estornar</Button>
                                                    <Button size='sm' variant='outline' className='h-7 text-xs px-2' onClick={() => openSplitModal(ev)} icon={<Split className='h-3 w-3' />}>Split</Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
                <div className='flex items-center justify-between px-4 py-3 border-t border-default'>
                    <span className='text-xs text-surface-500'>Página {page} de {lastPage}</span>
                    <div className='flex gap-1'>
                        <Button variant='outline' size='sm' className='h-7 text-xs' disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                        <Button variant='outline' size='sm' className='h-7 text-xs' disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                    </div>
                </div>
            )}
        </div>

        {/* Split Modal */}
        <Modal open={!!splitEvent} onOpenChange={() => setSplitEvent(null)} title={`Dividir Comissão — ${fmtBRL(splitEvent?.commission_amount ?? 0)}`}>
            <div className='space-y-4'>
                {existingSplits.length > 0 && (
                    <div className='bg-surface-50 rounded-lg p-3'>
                        <h4 className='text-xs font-semibold text-surface-700 mb-2'>Splits Existentes</h4>
                        {existingSplits.map((s: any) => (
                            <div key={s.id} className='flex justify-between text-sm'>
                                <span className='text-surface-700'>{s.user_name}</span>
                                <span className='text-surface-500'>{s.percentage}% — {fmtBRL(s.amount)}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className='space-y-2'>
                    {splitRows.map((row, idx) => (
                        <div key={idx} className='flex gap-2 items-end'>
                            <div className='flex-1'>
                                <label className='text-xs font-medium text-surface-500 block mb-0.5'>Usuário</label>
                                <select title='Selecionar usuário para split' value={row.user_id} onChange={e => { const next = [...splitRows]; next[idx].user_id = e.target.value; setSplitRows(next) }} className='w-full h-8 rounded-lg border-default text-xs px-2'>
                                    <option value=''>Selecione...</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className='w-24'>
                                <label className='text-xs font-medium text-surface-500 block mb-0.5'>%</label>
                                <Input type='number' min='0.01' max='100' step='0.01' value={row.percentage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const next = [...splitRows]; next[idx].percentage = e.target.value; setSplitRows(next) }} className='h-8 text-xs' />
                            </div>
                            {splitRows.length > 2 && (
                                <Button size='icon' variant='ghost' className='h-8 w-8 text-red-500' onClick={() => setSplitRows(splitRows.filter((_, i) => i !== idx))}><Trash2 className='h-3 w-3' /></Button>
                            )}
                        </div>
                    ))}
                </div>
                <div className='flex justify-between items-center'>
                    <Button variant='outline' size='sm' onClick={() => setSplitRows([...splitRows, { user_id: '', percentage: '0' }])} icon={<Plus className='h-3 w-3' />}>Adicionar</Button>
                    <span className={cn('text-xs font-medium', Math.abs(splitRows.reduce((sum, r) => sum + Number(r.percentage), 0) - 100) < 0.1 ? 'text-emerald-600' : 'text-red-600')}>
                        Total: {splitRows.reduce((sum, r) => sum + Number(r.percentage), 0).toFixed(1)}%
                    </span>
                </div>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setSplitEvent(null)}>Cancelar</Button>
                    <Button
                        loading={splitMut.isPending}
                        disabled={splitRows.some(r => !r.user_id) || Math.abs(splitRows.reduce((s, r) => s + Number(r.percentage), 0) - 100) > 0.1}
                        onClick={() => splitEvent && splitMut.mutate({ eventId: splitEvent.id, splits: splitRows.map(r => ({ user_id: Number(r.user_id), percentage: Number(r.percentage) })) })}
                    >Dividir Comissão</Button>
                </div>
            </div>
        </Modal>

        {/* Confirm Reverse Modal */}
        <Modal open={!!confirmEvAction} onOpenChange={() => setConfirmEvAction(null)} title='Confirmar Estorno'>
            <p className='text-sm text-surface-600 py-2'>
                {confirmEvAction?.type === 'batch_reverse'
                    ? `Deseja estornar ${selectedIds.size} evento(s) selecionado(s)?`
                    : 'Deseja rejeitar/estornar este evento de comissão?'}
            </p>
            <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                <Button variant='outline' onClick={() => setConfirmEvAction(null)}>Cancelar</Button>
                <Button className='bg-red-600 hover:bg-red-700 text-white'
                    loading={confirmEvAction?.type === 'batch_reverse' ? batchMut.isPending : reverseMut.isPending}
                    onClick={() => {
                        if (confirmEvAction?.type === 'batch_reverse') batchMut.mutate({ ids: [...selectedIds], status: 'reversed' })
                        else if (confirmEvAction?.id) reverseMut.mutate(confirmEvAction.id)
                        setConfirmEvAction(null)
                    }}>Confirmar Estorno</Button>
            </div>
        </Modal>
    </>)
}
