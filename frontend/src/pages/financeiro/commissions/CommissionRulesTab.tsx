import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Wallet } from 'lucide-react'
import api from '@/lib/api'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { CommissionRule, UserOption } from './types'
import { fmtBRL } from './utils'
import { commissionRuleSchema, getFieldErrors } from './schemas'

export function CommissionRulesTab() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.rule.create')
    const canUpdate = hasPermission('commissions.rule.update')
    const canDelete = hasPermission('commissions.rule.delete')
    const [showModal, setShowModal] = useState(false)
    const [deleteRuleId, setDeleteRuleId] = useState<number | null>(null)
    const [editing, setEditing] = useState<CommissionRule | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [delError, setDelError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    const { data: rulesRes, isLoading } = useQuery({ queryKey: ['commission-rules'], queryFn: () => api.get('/commission-rules') })
    const rules: CommissionRule[] = rulesRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => editing ? api.put(`/commission-rules/${editing.id}`, data) : api.post('/commission-rules', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-rules'] }); broadcastQueryInvalidation(['commission-rules'], 'Regra de Comissão'); setShowModal(false); setEditing(null); toast.success('Regra salva com sucesso') },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao salvar regra'; setSaveError(msg); toast.error(msg) }
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/commission-rules/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-rules'] }); broadcastQueryInvalidation(['commission-rules'], 'Regra de Comissão'); toast.success('Regra excluída') },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao excluir regra'; setDelError(msg); toast.error(msg) }
    })

    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users: UserOption[] = usersRes?.data ?? []

    const { data: calcTypesRes } = useQuery({ queryKey: ['commission-calculation-types'], queryFn: () => api.get('/commission-calculation-types') })
    const calcTypes: Record<string, string> = calcTypesRes?.data ?? {}

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-default shadow-card'>
                <div>
                    <h2 className='font-semibold text-surface-900'>Regras de Comissão</h2>
                    <p className='text-xs text-surface-500'>Defina como as comissões são calculadas.</p>
                </div>
                {canCreate && <Button onClick={() => { setEditing(null); setShowModal(true) }} icon={<Plus className='h-4 w-4' />}>Nova Regra</Button>}
            </div>

            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {isLoading ? <p className='text-center col-span-full text-surface-500'>Carregando...</p> : rules.length === 0 ? <div className='text-center col-span-full py-8'><Wallet className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma regra cadastrada.</p></div> : rules.map((rule) => (
                    <div key={rule.id} className='bg-surface-0 border border-default p-4 rounded-xl shadow-card transition-shadow relative group'>
                        <div className='absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
                            {canUpdate && <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => { setEditing(rule); setShowModal(true) }}><Edit className='h-3.5 w-3.5' /></Button>}
                            {canDelete && <Button size='icon' variant='ghost' className='h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50' onClick={() => setDeleteRuleId(rule.id)}><Trash2 className='h-3.5 w-3.5' /></Button>}
                        </div>

                        <div className='flex justify-between items-start mb-2 pr-12'>
                            <Badge variant='secondary' className='uppercase text-xs'>{{ tecnico: 'Técnico', vendedor: 'Vendedor', motorista: 'Motorista' }[rule.applies_to_role] ?? rule.applies_to_role}</Badge>
                        </div>

                        <h3 className='font-bold text-base text-surface-900 mb-1 truncate' title={rule.name}>{rule.name}</h3>

                        <div className='flex items-baseline gap-1 mb-3'>
                            <span className='text-lg font-bold text-brand-600'>
                                {rule.calculation_type?.includes('fixed') ? fmtBRL(rule.value) : `${rule.value}%`}
                            </span>
                            <span className='text-xs text-surface-500'>{rule.calculation_type?.replace(/_/g, ' ')}</span>
                        </div>

                        <div className='pt-3 border-t border-surface-100 text-xs text-surface-500 grid grid-cols-2 gap-2'>
                            <div><span className='block text-xs uppercase text-surface-400 font-semibold'>Prioridade</span>{rule.priority}</div>
                            <div><span className='block text-xs uppercase text-surface-400 font-semibold'>Aplica-se</span>{rule.applies_to}</div>
                            <div className='col-span-2'>
                                <span className='block text-xs uppercase text-surface-400 font-semibold'>Quando</span>
                                {{ os_completed: 'Ao Concluir OS', installment_paid: 'Ao Receber Pagamento', os_invoiced: 'Ao Faturar OS' }[rule.applies_when] ?? rule.applies_when?.replace(/_/g, ' ')}
                            </div>
                            <div className='col-span-2'>
                                <span className='block text-xs uppercase text-surface-400 font-semibold'>Beneficiário</span>
                                {rule.user?.name ?? 'Todos do cargo'}
                            </div>
                            {rule.source_filter && (
                                <div className='col-span-2'>
                                    <span className='block text-xs uppercase text-surface-400 font-semibold'>Filtro de Origem</span>
                                    {rule.source_filter}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {delError && <p className='text-sm text-red-600 bg-red-50 rounded-lg p-3'>{delError} <button className='underline ml-2' onClick={() => setDelError(null)}>Fechar</button></p>}

            <Modal open={showModal} onOpenChange={setShowModal} title={editing ? 'Editar Regra' : 'Nova Regra'}>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    setSaveError(null); setFieldErrors({})
                    const fd = new FormData(e.currentTarget)
                    const raw = {
                        name: fd.get('name') as string,
                        user_id: fd.get('user_id') ? Number(fd.get('user_id')) : null,
                        applies_to_role: fd.get('applies_to_role') as string,
                        calculation_type: fd.get('calculation_type') as string,
                        value: fd.get('value') as string,
                        priority: fd.get('priority') as string,
                        applies_to: fd.get('applies_to') as string,
                        applies_when: fd.get('applies_when') as string,
                        source_filter: (fd.get('source_filter') as string) || null,
                        active: editing ? (fd.get('active') === 'true') : true
                    }
                    const result = commissionRuleSchema.safeParse(raw)
                    if (!result.success) {
                        setFieldErrors(getFieldErrors(result.error))
                        toast.error('Corrija os campos em destaque')
                        return
                    }
                    saveMut.mutate({ ...raw, value: result.data.value })
                }} className='space-y-4'>
                    <div>
                        <Input label='Nome da Regra' name='name' defaultValue={editing?.name} required placeholder='Ex: Comissão Vendas Padrão' />
                        {fieldErrors.name && <p className='text-xs text-red-500 mt-1'>{fieldErrors.name}</p>}
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Papel (Cargo)</label>
                            <select name='applies_to_role' title='Papel (Cargo)' defaultValue={editing?.applies_to_role} className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value='tecnico'>Técnico</option>
                                <option value='vendedor'>Vendedor</option>
                                <option value='motorista'>Motorista</option>
                            </select>
                        </div>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Usuário Específico (Opcional)</label>
                            <select name='user_id' title='Usuário Específico' defaultValue={editing?.user_id ?? ''} className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value=''>Todos do cargo</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Tipo de Cálculo</label>
                            <select name='calculation_type' title='Tipo de Cálculo' defaultValue={editing?.calculation_type} className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500'>
                                {Object.keys(calcTypes).length > 0 ? (
                                    Object.entries(calcTypes).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))
                                ) : (
                                    <>
                                        <option value='percent_gross'>% Bruto</option>
                                        <option value='percent_net'>% Líquido</option>
                                        <option value='fixed_per_os'>Valor Fixo por OS</option>
                                        <option value='fixed_per_item'>Valor Fixo por Item</option>
                                    </>
                                )}
                            </select>
                        </div>
                        <div>
                            <Input label='Valor / Percentual' name='value' type='number' step='0.01' defaultValue={editing?.value} required />
                            {fieldErrors.value && <p className='text-xs text-red-500 mt-1'>{fieldErrors.value}</p>}
                        </div>
                    </div>

                    <div>
                        <Input label='Prioridade (Maior = Executa Primeiro)' name='priority' type='number' defaultValue={editing?.priority ?? 0} />
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Quando Disparar</label>
                            <select name='applies_when' title='Quando Disparar' defaultValue={editing?.applies_when ?? 'os_completed'} className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value='os_completed'>Ao Concluir OS</option>
                                <option value='installment_paid'>Ao Receber Pagamento</option>
                                <option value='os_invoiced'>Ao Faturar OS</option>
                            </select>
                        </div>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Aplica-se a</label>
                            <select name='applies_to' title='Aplica-se a' defaultValue={editing?.applies_to ?? 'all'} className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value='all'>Todos os Itens</option>
                                <option value='products'>Somente Produtos</option>
                                <option value='services'>Somente Serviços</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <Input label='Filtro de Origem (Opcional)' name='source_filter' defaultValue={editing?.source_filter ?? ''} placeholder='Ex: site, indicação, telemarketing' />
                        <p className='text-[10px] text-surface-400 mt-1'>Aplica regra somente a OS originadas desta fonte</p>
                    </div>

                    {editing && (
                        <div className='flex items-center gap-2'>
                            <label className='text-xs font-medium text-surface-700'>Status</label>
                            <select name='active' title='Status da Regra' defaultValue={editing?.active ? 'true' : 'false'} className='rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value='true'>Ativa</option>
                                <option value='false'>Inativa</option>
                            </select>
                        </div>
                    )}

                    {saveError && <p className='text-sm text-red-600 bg-red-50 rounded-lg p-3'>{saveError}</p>}

                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' type='button' onClick={() => { setShowModal(false); setSaveError(null) }}>Cancelar</Button>
                        <Button type='submit' loading={saveMut.isPending}>Salvar Regra</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirm Modal */}
            <Modal open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)} title='Excluir Regra'>
                <p className='text-sm text-surface-600 py-2'>Deseja excluir esta regra de comissão? Esta ação não pode ser desfeita.</p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setDeleteRuleId(null)}>Cancelar</Button>
                    <Button className='bg-red-600 hover:bg-red-700 text-white' loading={delMut.isPending}
                        onClick={() => { if (deleteRuleId) delMut.mutate(deleteRuleId); setDeleteRuleId(null) }}>Excluir</Button>
                </div>
            </Modal>
        </div>
    )
}
