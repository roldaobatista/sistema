import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Pause, Repeat } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { RecurringCommission } from './types'

export function CommissionRecurringTab() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.recurring.create')
    const canUpdate = hasPermission('commissions.recurring.update')
    const [showProcessConfirm, setShowProcessConfirm] = useState(false)
    const { data: res, isLoading } = useQuery({ queryKey: ['recurring-commissions'], queryFn: () => api.get('/recurring-commissions') })
    const items: RecurringCommission[] = res?.data ?? []

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: number, status: string }) => api.put(`/recurring-commissions/${id}/status`, { status }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-commissions'] }); toast.success('Status atualizado') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao atualizar status')
    })
    const processMut = useMutation({
        mutationFn: () => api.post('/recurring-commissions/process-monthly'),
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ['recurring-commissions'] });
            qc.invalidateQueries({ queryKey: ['commission-events'] }); toast.success(res?.data?.message ?? 'Processamento concluído')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao processar')
    })

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-default shadow-card'>
                <div><h2 className='font-semibold text-surface-900'>Comissões Recorrentes</h2><p className='text-xs text-surface-500'>Comissões vinculadas a contratos recorrentes.</p></div>
                {canCreate && <Button onClick={() => setShowProcessConfirm(true)} loading={processMut.isPending} icon={<Play className='h-4 w-4' />}>Processar Mês</Button>}
            </div>
            <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                            <tr><th className='px-4 py-3 text-left font-medium'>Usuário</th><th className='px-4 py-3 text-left font-medium'>Regra</th><th className='px-4 py-3 text-left font-medium'>Contrato</th><th className='px-4 py-3 text-center font-medium'>Status</th><th className='px-4 py-3 text-right font-medium'>Ações</th></tr>
                        </thead>
                        <tbody className='divide-y divide-subtle'>
                            {isLoading ? <tr><td colSpan={5} className='p-8 text-center text-surface-500'>Carregando...</td></tr>
                                : items.length === 0 ? <tr><td colSpan={5} className='p-12 text-center'><Repeat className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma comissão recorrente cadastrada.</p></td></tr>
                                    : items.map(r => (
                                        <tr key={r.id} className='hover:bg-surface-50 transition-colors'>
                                            <td className='px-4 py-3 font-medium text-surface-900'>{r.user_name}</td>
                                            <td className='px-4 py-3 text-surface-600'>{r.rule_name} ({r.rule_value})</td>
                                            <td className='px-4 py-3 text-surface-600'>{r.contract_name ?? `#${r.recurring_contract_id}`}</td>
                                            <td className='px-4 py-3 text-center'><Badge variant={r.status === 'active' ? 'success' : r.status === 'paused' ? 'secondary' : 'danger'}>{r.status === 'active' ? 'Ativa' : r.status === 'paused' ? 'Pausada' : 'Encerrada'}</Badge></td>
                                            <td className='px-4 py-3 text-right'>
                                                <div className='flex justify-end gap-1'>
                                                    {r.status === 'active' && canUpdate && <Button size='sm' variant='outline' className='h-7 text-xs px-2' onClick={() => statusMut.mutate({ id: r.id, status: 'paused' })} icon={<Pause className='h-3 w-3' />}>Pausar</Button>}
                                                    {r.status === 'paused' && canUpdate && <Button size='sm' variant='outline' className='h-7 text-xs px-2' onClick={() => statusMut.mutate({ id: r.id, status: 'active' })} icon={<Play className='h-3 w-3' />}>Ativar</Button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Process Confirm Modal */}
            <Modal open={showProcessConfirm} onOpenChange={setShowProcessConfirm} title='Processar Geração Mensal'>
                <p className='text-sm text-surface-600 py-2'>Deseja processar a geração mensal de comissões recorrentes? Eventos serão criados para todos os contratos ativos.</p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setShowProcessConfirm(false)}>Cancelar</Button>
                    <Button className='bg-emerald-600 hover:bg-emerald-700 text-white' loading={processMut.isPending}
                        onClick={() => { processMut.mutate(); setShowProcessConfirm(false) }}>Processar</Button>
                </div>
            </Modal>
        </div>
    )
}
