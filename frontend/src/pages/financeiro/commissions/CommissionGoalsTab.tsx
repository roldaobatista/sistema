import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Trash2, Target } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { CommissionGoal, UserOption } from './types'
import { fmtBRL } from './utils'

export function CommissionGoalsTab() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.goal.create')
    const canDelete = hasPermission('commissions.goal.delete')
    const [showModal, setShowModal] = useState(false)
    const [deleteGoalId, setDeleteGoalId] = useState<number | null>(null)
    const { data: res, isLoading } = useQuery({ queryKey: ['commission-goals'], queryFn: () => api.get('/commission-goals') })
    const goals: CommissionGoal[] = res?.data ?? []
    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users: UserOption[] = usersRes?.data ?? []

    const storeMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => api.post('/commission-goals', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-goals'] }); setShowModal(false); toast.success('Meta criada') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao criar meta')
    })
    const refreshMut = useMutation({
        mutationFn: (id: number) => api.post(`/commission-goals/${id}/refresh`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-goals'] }); toast.success('Meta atualizada') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao atualizar')
    })
    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/commission-goals/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-goals'] }); toast.success('Meta excluída') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir')
    })

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-default shadow-card'>
                <div><h2 className='font-semibold text-surface-900'>Metas de Comissão</h2><p className='text-xs text-surface-500'>Defina metas mensais para os beneficiários.</p></div>
                {canCreate && <Button onClick={() => setShowModal(true)} icon={<Plus className='h-4 w-4' />}>Nova Meta</Button>}
            </div>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {isLoading ? <p className='text-center col-span-full text-surface-500'>Carregando...</p> : goals.length === 0 ? <div className='text-center col-span-full py-8'><Target className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma meta cadastrada.</p></div> : goals.map(g => {
                    const pct = g.achievement_pct ?? 0
                    return (
                        <div key={g.id} className='bg-surface-0 border border-default p-4 rounded-xl shadow-card relative group'>
                            <div className='absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
                                {canCreate && <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => refreshMut.mutate(g.id)}><RefreshCw className='h-3.5 w-3.5' /></Button>}
                                {canDelete && <Button size='icon' variant='ghost' className='h-7 w-7 text-red-600' onClick={() => setDeleteGoalId(g.id)}><Trash2 className='h-3.5 w-3.5' /></Button>}
                            </div>
                            <div className='flex justify-between items-start'>
                                <p className='text-sm font-bold text-surface-900'>{g.user_name}</p>
                                <Badge variant='outline' className='text-xs'>{g.type === 'os_count' ? 'Nº OS' : g.type === 'new_clients' ? 'Novos Clientes' : 'Faturamento'}</Badge>
                            </div>
                            <p className='text-xs text-surface-500 mb-3'>{g.period}</p>
                            <div className='flex justify-between text-xs mb-1'><span>Alcançado: {fmtBRL(g.achieved_amount)}</span><span>Meta: {fmtBRL(g.target_amount)}</span></div>
                            <div className='h-2 rounded-full bg-surface-100'><div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400')} title={`${pct}% atingido`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                            <p className='text-xs text-surface-500 mt-1 text-right'>{pct}%</p>
                        </div>
                    )
                })}
            </div>
            <Modal open={showModal} onOpenChange={setShowModal} title='Nova Meta'>
                <form onSubmit={(e) => {
                    e.preventDefault(); const fd = new FormData(e.currentTarget)
                    storeMut.mutate({
                        user_id: fd.get('user_id'), period: fd.get('period'),
                        target_amount: fd.get('target_amount'), type: fd.get('type'),
                        bonus_percentage: fd.get('bonus_percentage') || null,
                        bonus_amount: fd.get('bonus_amount') || null,
                        notes: fd.get('notes') || null,
                    })
                }} className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                        <div><label className='text-xs font-medium text-surface-700 mb-1 block'>Usuário</label><select name='user_id' title='Selecionar usuário' required className='w-full rounded-lg border-default text-sm'><option value=''>Selecione...</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                        <div><label className='text-xs font-medium text-surface-700 mb-1 block'>Tipo de Meta</label><select name='type' title='Tipo de meta' className='w-full rounded-lg border-default text-sm'><option value='revenue'>Faturamento (R$)</option><option value='os_count'>Nº de OS</option><option value='new_clients'>Novos Clientes</option></select></div>
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                        <Input label='Período' name='period' type='month' required defaultValue={new Date().toISOString().slice(0, 7)} />
                        <Input label='Meta (valor)' name='target_amount' type='number' step='0.01' required />
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                        <Input label='Bônus (% se atingir)' name='bonus_percentage' type='number' step='0.01' min='0' max='100' placeholder='Ex: 5' />
                        <Input label='Bônus Fixo (R$)' name='bonus_amount' type='number' step='0.01' min='0' placeholder='Ex: 500' />
                    </div>
                    <Input label='Observações' name='notes' placeholder='Observações sobre a meta...' />
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'><Button variant='outline' type='button' onClick={() => setShowModal(false)}>Cancelar</Button><Button type='submit' loading={storeMut.isPending}>Criar Meta</Button></div>
                </form>
            </Modal>

            <Modal open={!!deleteGoalId} onOpenChange={() => setDeleteGoalId(null)} title='Excluir Meta'>
                <p className='text-sm text-surface-600 py-2'>Deseja excluir esta meta? Esta ação não pode ser desfeita.</p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setDeleteGoalId(null)}>Cancelar</Button>
                    <Button className='bg-red-600 hover:bg-red-700 text-white' loading={delMut.isPending}
                        onClick={() => { if (deleteGoalId) delMut.mutate(deleteGoalId); setDeleteGoalId(null) }}>Excluir</Button>
                </div>
            </Modal>
        </div>
    )
}
