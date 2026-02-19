import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Megaphone } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { CommissionCampaign } from './types'
import { fmtDate } from './utils'

export function CommissionCampaignsTab() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.campaign.create')
    const canDelete = hasPermission('commissions.campaign.delete')
    const [showModal, setShowModal] = useState(false)
    const [deleteCampId, setDeleteCampId] = useState<number | null>(null)
    const { data: res, isLoading } = useQuery({ queryKey: ['commission-campaigns'], queryFn: () => api.get('/commission-campaigns') })
    const campaigns: CommissionCampaign[] = res?.data ?? []

    const [editingCampaign, setEditingCampaign] = useState<CommissionCampaign | null>(null)
    const storeMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => editingCampaign ? api.put(`/commission-campaigns/${editingCampaign.id}`, data) : api.post('/commission-campaigns', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-campaigns'] }); setShowModal(false); setEditingCampaign(null); toast.success(editingCampaign ? 'Campanha atualizada' : 'Campanha criada') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar campanha')
    })
    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/commission-campaigns/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-campaigns'] }); toast.success('Campanha excluída') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir')
    })

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-default shadow-card'>
                <div><h2 className='font-semibold text-surface-900'>Campanhas de Comissão</h2><p className='text-xs text-surface-500'>Multiplicadores temporários para comissões.</p></div>
                {canCreate && <Button onClick={() => { setEditingCampaign(null); setShowModal(true) }} icon={<Plus className='h-4 w-4' />}>Nova Campanha</Button>}
            </div>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {isLoading ? <p className='text-center col-span-full text-surface-500'>Carregando...</p> : campaigns.length === 0 ? <div className='text-center col-span-full py-8'><Megaphone className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma campanha cadastrada.</p></div> : campaigns.map(c => (
                    <div key={c.id} className='bg-surface-0 border border-default p-4 rounded-xl shadow-card relative group'>
                        <div className='absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
                            {canCreate && <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => { setEditingCampaign(c); setShowModal(true) }}><Edit className='h-3.5 w-3.5' /></Button>}
                            {canDelete && <Button size='icon' variant='ghost' className='h-7 w-7 text-red-600' onClick={() => setDeleteCampId(c.id)}><Trash2 className='h-3.5 w-3.5' /></Button>}
                        </div>
                        <h3 className='font-bold text-base text-surface-900 mb-1'>{c.name}</h3>
                        <span className='text-lg font-bold text-brand-600'>x{c.multiplier}</span>
                        <div className='pt-3 mt-3 border-t border-surface-100 text-xs text-surface-500 grid grid-cols-2 gap-2'>
                            <div><span className='block text-xs uppercase text-surface-400 font-semibold'>Início</span>{fmtDate(c.starts_at)}</div>
                            <div><span className='block text-xs uppercase text-surface-400 font-semibold'>Fim</span>{fmtDate(c.ends_at)}</div>
                            {c.applies_to_role && <div className='col-span-2'><span className='block text-xs uppercase text-surface-400 font-semibold'>Papel</span>{c.applies_to_role}</div>}
                        </div>
                        <Badge variant={c.active ? 'success' : 'secondary'} className='mt-2'>{c.active ? 'Ativa' : 'Inativa'}</Badge>
                    </div>
                ))}
            </div>
            <Modal open={showModal} onOpenChange={setShowModal} title={editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); storeMut.mutate({ name: fd.get('name'), multiplier: fd.get('multiplier'), starts_at: fd.get('starts_at'), ends_at: fd.get('ends_at'), applies_to_role: fd.get('applies_to_role') || null }) }} className='space-y-4'>
                    <Input label='Nome' name='name' required defaultValue={editingCampaign?.name} />
                    <Input label='Multiplicador' name='multiplier' type='number' step='0.01' min='1.01' max='5' required defaultValue={editingCampaign?.multiplier ?? '1.5'} />
                    <div className='grid grid-cols-2 gap-4'>
                        <Input label='Início' name='starts_at' type='date' required defaultValue={editingCampaign?.starts_at?.slice(0, 10)} />
                        <Input label='Fim' name='ends_at' type='date' required defaultValue={editingCampaign?.ends_at?.slice(0, 10)} />
                    </div>
                    <div><label className='text-xs font-medium text-surface-700 mb-1 block'>Papel (opcional)</label><select name='applies_to_role' title='Papel da campanha' defaultValue={editingCampaign?.applies_to_role ?? ''} className='w-full rounded-lg border-default text-sm'><option value=''>Todos</option><option value='tecnico'>Técnico</option><option value='vendedor'>Vendedor</option><option value='motorista'>Motorista</option></select></div>
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'><Button variant='outline' type='button' onClick={() => { setShowModal(false); setEditingCampaign(null) }}>Cancelar</Button><Button type='submit' loading={storeMut.isPending}>{editingCampaign ? 'Salvar' : 'Criar Campanha'}</Button></div>
                </form>
            </Modal>

            <Modal open={!!deleteCampId} onOpenChange={() => setDeleteCampId(null)} title='Excluir Campanha'>
                <p className='text-sm text-surface-600 py-2'>Deseja excluir esta campanha? Esta ação não pode ser desfeita.</p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setDeleteCampId(null)}>Cancelar</Button>
                    <Button className='bg-red-600 hover:bg-red-700 text-white' loading={delMut.isPending}
                        onClick={() => { if (deleteCampId) delMut.mutate(deleteCampId); setDeleteCampId(null) }}>Excluir</Button>
                </div>
            </Modal>
        </div>
    )
}
