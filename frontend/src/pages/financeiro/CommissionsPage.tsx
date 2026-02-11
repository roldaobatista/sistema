import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus, Search, Filter, CheckCircle, XCircle, AlertCircle, Calendar,
    DollarSign, Percent, TrendingUp, Users, ChevronDown, ChevronRight,
    ArrowRight, Wallet, Split, Play, RefreshCw, FileText, Trash2, Edit
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

const fmtBRL = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

export function CommissionsPage() {
    const [activeTab, setActiveTab] = useState('overview')

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <h1 className='text-xl font-bold text-surface-900 tracking-tight'>Gestão de Comissões</h1>
                    <p className='text-sm text-surface-500'>Configure regras, acompanhe eventos e realize fechamentos.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className='space-y-4'>
                <TabsList>
                    <TabsTrigger value='overview'>Visão Geral</TabsTrigger>
                    <TabsTrigger value='events'>Eventos</TabsTrigger>
                    <TabsTrigger value='rules'>Regras de Comissão</TabsTrigger>
                    <TabsTrigger value='settlements'>Fechamentos</TabsTrigger>
                </TabsList>

                <TabsContent value='overview'>
                    <CommissionOverview />
                </TabsContent>

                <TabsContent value='events'>
                    <CommissionEvents />
                </TabsContent>

                <TabsContent value='rules'>
                    <CommissionRules />
                </TabsContent>

                <TabsContent value='settlements'>
                    <CommissionSettlements />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function CommissionOverview() {
    const { data: overviewRes } = useQuery({ queryKey: ['commission-overview'], queryFn: () => api.get('/commission-dashboard/overview') })
    const overview = overviewRes?.data?.data ?? overviewRes?.data ?? {}

    return (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                <div className='flex items-center gap-4'>
                    <div className='h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600'>
                        <TrendingUp className='h-6 w-6' />
                    </div>
                    <div>
                        <p className='text-sm font-medium text-surface-500'>Pago (Mês)</p>
                        <h3 className='text-2xl font-bold text-surface-900'>{fmtBRL(overview.paid_this_month ?? 0)}</h3>
                    </div>
                </div>
            </div>
            <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                <div className='flex items-center gap-4'>
                    <div className='h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600'>
                        <AlertCircle className='h-6 w-6' />
                    </div>
                    <div>
                        <p className='text-sm font-medium text-surface-500'>Pendente</p>
                        <h3 className='text-2xl font-bold text-surface-900'>{fmtBRL(overview.pending ?? 0)}</h3>
                    </div>
                </div>
            </div>
            <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                <div className='flex items-center gap-4'>
                    <div className='h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-600'>
                        <CheckCircle className='h-6 w-6' />
                    </div>
                    <div>
                        <p className='text-sm font-medium text-surface-500'>Aprovado</p>
                        <h3 className='text-2xl font-bold text-surface-900'>{fmtBRL(overview.approved ?? 0)}</h3>
                    </div>
                </div>
            </div>
        </div>
    )
}

function CommissionRules() {
    const qc = useQueryClient()
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<any>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [delError, setDelError] = useState<string | null>(null)

    const { data: rulesRes, isLoading } = useQuery({ queryKey: ['commission-rules'], queryFn: () => api.get('/commission-rules') })
    const rules = rulesRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: any) => editing ? api.put(`/commission-rules/${editing.id}`, data) : api.post('/commission-rules', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-rules'] }); setShowModal(false); setEditing(null) },
        onError: (err: any) => setSaveError(err?.response?.data?.message ?? 'Erro ao salvar regra')
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/commission-rules/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-rules'] }),
        onError: (err: any) => setDelError(err?.response?.data?.message ?? 'Erro ao excluir regra')
    })

    // Usuários para select
    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users = usersRes?.data ?? []

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-surface-200 shadow-sm'>
                <div>
                    <h2 className='font-semibold text-surface-900'>Regras de Comissão</h2>
                    <p className='text-xs text-surface-500'>Defina como as comissões são calculadas.</p>
                </div>
                <Button onClick={() => { setEditing(null); setShowModal(true) }} icon={<Plus className='h-4 w-4' />}>Nova Regra</Button>
            </div>

            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {isLoading ? <p className='text-center col-span-full text-surface-500'>Carregando...</p> : rules.map((rule: any) => (
                    <div key={rule.id} className='bg-surface-0 border border-surface-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group'>
                        <div className='absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
                            <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => { setEditing(rule); setShowModal(true) }}><Edit className='h-3.5 w-3.5' /></Button>
                            <Button size='icon' variant='ghost' className='h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50' onClick={() => { if (confirm('Excluir?')) delMut.mutate(rule.id) }}><Trash2 className='h-3.5 w-3.5' /></Button>
                        </div>

                        <div className='flex justify-between items-start mb-2 pr-12'>
                            <Badge variant='secondary' className='uppercase text-[10px]'>{rule.applies_to_role}</Badge>
                        </div>

                        <h3 className='font-bold text-base text-surface-900 mb-1 truncate' title={rule.name}>{rule.name}</h3>

                        <div className='flex items-baseline gap-1 mb-3'>
                            <span className='text-lg font-bold text-brand-600'>
                                {rule.calculation_type?.includes('fixed')
                                    ? fmtBRL(rule.value)
                                    : `${rule.value}%`}
                            </span>
                            <span className='text-xs text-surface-500'>
                                {rule.calculation_type?.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className='pt-3 border-t border-surface-100 text-xs text-surface-500 grid grid-cols-2 gap-2'>
                            <div>
                                <span className='block text-[10px] uppercase text-surface-400 font-semibold'>Prioridade</span>
                                {rule.priority}
                            </div>
                            <div>
                                <span className='block text-[10px] uppercase text-surface-400 font-semibold'>Aplica-se</span>
                                {rule.applies_to}
                            </div>
                            <div className='col-span-2'>
                                <span className='block text-[10px] uppercase text-surface-400 font-semibold'>Quando</span>
                                {rule.applies_when?.replace(/_/g, ' ')}
                            </div>
                            <div className='col-span-2'>
                                <span className='block text-[10px] uppercase text-surface-400 font-semibold'>Beneficiário</span>
                                {rule.user?.name ?? 'Todos do cargo'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {delError && <p className='text-sm text-red-600 bg-red-50 rounded-lg p-3'>{delError} <button className='underline ml-2' onClick={() => setDelError(null)}>Fechar</button></p>}

            <Modal open={showModal} onOpenChange={setShowModal} title={editing ? 'Editar Regra' : 'Nova Regra'}>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    saveMut.mutate({
                        name: fd.get('name'),
                        user_id: fd.get('user_id') || null,
                        applies_to_role: fd.get('applies_to_role'),
                        calculation_type: fd.get('calculation_type'),
                        value: fd.get('value'),
                        priority: fd.get('priority'),
                        applies_to: 'all',
                        applies_when: fd.get('applies_when'),
                        active: true
                    })
                }} className='space-y-4'>
                    <Input label='Nome da Regra' name='name' defaultValue={editing?.name} required placeholder='Ex: Comissão Vendas Padrão' />

                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Papel (Cargo)</label>
                            <select name='applies_to_role' defaultValue={editing?.applies_to_role} className='w-full rounded-lg border-surface-300 text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value='technician'>Técnico</option>
                                <option value='seller'>Vendedor</option>
                                <option value='driver'>Motorista</option>
                            </select>
                        </div>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Usuário Específico (Opcional)</label>
                            <select name='user_id' defaultValue={editing?.user_id} className='w-full rounded-lg border-surface-300 text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value=''>Todos do cargo</option>
                                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Tipo de Cálculo</label>
                            <select name='calculation_type' defaultValue={editing?.calculation_type} className='w-full rounded-lg border-surface-300 text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value='percent_gross'>% Bruto</option>
                                <option value='percent_net'>% Líquido</option>
                                <option value='percent_services_only'>% Apenas Serviços</option>
                                <option value='percent_products_only'>% Apenas Produtos</option>
                                <option value='percent_profit'>% Lucro</option>
                                <option value='percent_gross_minus_displacement'>% Bruto − Deslocamento</option>
                                <option value='percent_gross_minus_expenses'>% Bruto − Despesas</option>
                                <option value='fixed_per_os'>Valor Fixo por OS</option>
                                <option value='tiered_gross'>Escalonado</option>
                                <option value='custom_formula'>Fórmula Customizada</option>
                            </select>
                        </div>
                        <Input label='Valor / Percentual' name='value' type='number' step='0.01' defaultValue={editing?.value} required />
                    </div>

                    <div>
                        <Input label='Prioridade (Maior = Executa Primeiro)' name='priority' type='number' defaultValue={editing?.priority ?? 0} />
                    </div>

                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Quando Disparar</label>
                        <select name='applies_when' defaultValue={editing?.applies_when ?? 'os_completed'} className='w-full rounded-lg border-surface-300 text-sm focus:ring-brand-500 focus:border-brand-500'>
                            <option value='os_completed'>Ao Concluir OS</option>
                            <option value='installment_paid'>Ao Receber Pagamento</option>
                            <option value='os_invoiced'>Ao Faturar OS</option>
                        </select>
                    </div>

                    {saveError && <p className='text-sm text-red-600 bg-red-50 rounded-lg p-3'>{saveError}</p>}

                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' type='button' onClick={() => { setShowModal(false); setSaveError(null) }}>Cancelar</Button>
                        <Button type='submit' loading={saveMut.isPending}>Salvar Regra</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

function CommissionEvents() {
    const qc = useQueryClient()
    const [eventError, setEventError] = useState<string | null>(null)
    const { data: eventsRes, isLoading } = useQuery({ queryKey: ['commission-events'], queryFn: () => api.get('/commission-events') })
    const events = eventsRes?.data?.data ?? []

    const approveMut = useMutation({
        mutationFn: (id: number) => api.put(`/commission-events/${id}/status`, { status: 'approved' }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] }); qc.invalidateQueries({ queryKey: ['commission-overview'] }); setEventError(null) },
        onError: (err: any) => setEventError(err?.response?.data?.message ?? 'Erro ao aprovar evento')
    })

    const reverseMut = useMutation({
        mutationFn: (id: number) => api.put(`/commission-events/${id}/status`, { status: 'reversed' }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] }); qc.invalidateQueries({ queryKey: ['commission-overview'] }); setEventError(null) },
        onError: (err: any) => setEventError(err?.response?.data?.message ?? 'Erro ao estornar evento')
    })

    return (
        <div className='bg-surface-0 border border-surface-200 rounded-xl overflow-hidden shadow-sm'>
            <div className='p-4 border-b border-surface-200 flex justify-between items-center'>
                <h2 className='font-semibold text-surface-900'>Eventos de Comissão</h2>
                <Button variant='outline' size='sm' onClick={() => qc.invalidateQueries({ queryKey: ['commission-events'] })} icon={<RefreshCw className='h-3 w-3' />}>Atualizar</Button>
            </div>

            {eventError && <div className='mx-4 mt-2 text-sm text-red-600 bg-red-50 rounded-lg p-3'>{eventError} <button className='underline ml-2' onClick={() => setEventError(null)}>Fechar</button></div>}

            <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead className='bg-surface-50 text-surface-500 border-b border-surface-200'>
                        <tr>
                            <th className='px-4 py-3 text-left font-medium'>Data</th>
                            <th className='px-4 py-3 text-left font-medium'>Beneficiário</th>
                            <th className='px-4 py-3 text-left font-medium'>Origem</th>
                            <th className='px-4 py-3 text-right font-medium'>Valor</th>
                            <th className='px-4 py-3 text-center font-medium'>Status</th>
                            <th className='px-4 py-3 text-right font-medium'>Ações</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-surface-100'>
                        {isLoading ? (
                            <tr><td colSpan={6} className='p-8 text-center text-surface-500'>Carregando eventos...</td></tr>
                        ) : events.length === 0 ? (
                            <tr><td colSpan={6} className='p-8 text-center text-surface-500'>Nenhum evento registrado.</td></tr>
                        ) : events.map((ev: any) => (
                            <tr key={ev.id} className='hover:bg-surface-50 transition-colors'>
                                <td className='px-4 py-3 text-surface-600 whitespace-nowrap'>
                                    {fmtDate(ev.created_at)}
                                    <span className='block text-[10px] text-surface-400'>
                                        {new Date(ev.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </td>
                                <td className='px-4 py-3 font-medium text-surface-900'>{ev.user?.name}</td>
                                <td className='px-4 py-3'>
                                    <div className='flex items-center gap-1.5'>
                                        <Badge variant='outline' className='text-[10px]'>{ev.rule?.name ?? 'Manual'}</Badge>
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
                                <td className='px-4 py-3 text-right'>
                                    <div className='flex justify-end gap-1'>
                                        {ev.status === 'pending' && (
                                            <>
                                                <Button
                                                    size='sm'
                                                    className='bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2'
                                                    onClick={() => approveMut.mutate(ev.id)}
                                                    loading={approveMut.isPending}
                                                >
                                                    Aprovar
                                                </Button>
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    className='text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-2'
                                                    onClick={() => { if (confirm('Rejeitar/Estornar este evento?')) reverseMut.mutate(ev.id) }}
                                                >
                                                    Rejeitar
                                                </Button>
                                            </>
                                        )}
                                        {ev.status === 'approved' && (
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                className='text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-2'
                                                onClick={() => { if (confirm('Estornar este evento aprovado?')) reverseMut.mutate(ev.id) }}
                                            >
                                                Estornar
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function CommissionSettlements() {
    const qc = useQueryClient()
    const [closePeriod, setClosePeriod] = useState(new Date().toISOString().slice(0, 7))
    const [closeUserId, setCloseUserId] = useState('')

    const { data: settRes, isLoading } = useQuery({ queryKey: ['commission-settlements'], queryFn: () => api.get('/commission-settlements') })
    const settlements = settRes?.data ?? []

    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users = usersRes?.data ?? []

    const [payError, setPayError] = useState<string | null>(null)

    const closeMut = useMutation({
        mutationFn: (data: any) => api.post('/commission-settlements/close', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-settlements'] }); qc.invalidateQueries({ queryKey: ['commission-events'] }); qc.invalidateQueries({ queryKey: ['commission-overview'] }) },
        onError: () => { }
    })

    const payMut = useMutation({
        mutationFn: (id: number) => api.post(`/commission-settlements/${id}/pay`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-settlements'] }); qc.invalidateQueries({ queryKey: ['commission-events'] }); qc.invalidateQueries({ queryKey: ['commission-overview'] }); setPayError(null) },
        onError: (err: any) => setPayError(err?.response?.data?.message ?? 'Erro ao pagar fechamento')
    })

    return (
        <div className='space-y-4'>
            <div className='bg-surface-0 border border-surface-200 rounded-xl p-4 shadow-sm space-y-4'>
                <h2 className='font-semibold text-surface-900'>Fechar Período</h2>
                <div className='flex flex-wrap gap-3 items-end'>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Período</label>
                        <Input
                            type='month'
                            value={closePeriod}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClosePeriod(e.target.value)}
                            className='w-40'
                        />
                    </div>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Usuário</label>
                        <select
                            value={closeUserId}
                            onChange={(e) => setCloseUserId(e.target.value)}
                            className='w-48 rounded-lg border-surface-300 text-sm focus:ring-brand-500 focus:border-brand-500 h-9 px-2'
                        >
                            <option value=''>Selecione...</option>
                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <Button
                        onClick={() => {
                            if (!closeUserId) return alert('Selecione um usuário')
                            closeMut.mutate({ user_id: closeUserId, period: closePeriod })
                        }}
                        loading={closeMut.isPending}
                        icon={<Calendar className='h-4 w-4' />}
                    >
                        Fechar Período
                    </Button>
                </div>
                {closeMut.isError && <p className='text-sm text-red-600 bg-red-50 rounded-lg p-3'>Erro: {(closeMut.error as any)?.response?.data?.message || 'Falha ao fechar'}</p>}
                {closeMut.isSuccess && <p className='text-sm text-emerald-600 bg-emerald-50 rounded-lg p-3'>Período fechado com sucesso!</p>}
                {payError && <p className='text-sm text-red-600 bg-red-50 rounded-lg p-3'>{payError} <button className='underline ml-2' onClick={() => setPayError(null)}>Fechar</button></p>}
            </div>

            <div className='bg-surface-0 border border-surface-200 rounded-xl overflow-hidden shadow-sm'>
                <div className='p-4 border-b border-surface-200'>
                    <h2 className='font-semibold text-surface-900'>Fechamentos Realizados</h2>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-surface-50 text-surface-500 border-b border-surface-200'>
                            <tr>
                                <th className='px-4 py-3 text-left font-medium'>Período</th>
                                <th className='px-4 py-3 text-left font-medium'>Beneficiário</th>
                                <th className='px-4 py-3 text-right font-medium'>Eventos</th>
                                <th className='px-4 py-3 text-right font-medium'>Total</th>
                                <th className='px-4 py-3 text-center font-medium'>Status</th>
                                <th className='px-4 py-3 text-center font-medium'>Pago Em</th>
                                <th className='px-4 py-3 text-right font-medium'>Ações</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-surface-100'>
                            {isLoading ? (
                                <tr><td colSpan={7} className='p-8 text-center text-surface-500'>Carregando...</td></tr>
                            ) : settlements.length === 0 ? (
                                <tr><td colSpan={7} className='p-8 text-center text-surface-500'>Nenhum fechamento realizado.</td></tr>
                            ) : settlements.map((s: any) => (
                                <tr key={s.id} className='hover:bg-surface-50 transition-colors'>
                                    <td className='px-4 py-3 font-medium text-surface-900'>{s.period}</td>
                                    <td className='px-4 py-3 text-surface-700'>{s.user?.name}</td>
                                    <td className='px-4 py-3 text-right text-surface-600'>{s.events_count}</td>
                                    <td className='px-4 py-3 text-right font-semibold text-emerald-600'>{fmtBRL(s.total_amount)}</td>
                                    <td className='px-4 py-3 text-center'>
                                        <Badge variant={s.status === 'paid' ? 'success' : s.status === 'closed' ? 'default' : 'secondary'}>
                                            {s.status === 'paid' ? 'Pago' : s.status === 'closed' ? 'Fechado' : 'Aberto'}
                                        </Badge>
                                    </td>
                                    <td className='px-4 py-3 text-center text-surface-500'>
                                        {s.paid_at ? fmtDate(s.paid_at) : '—'}
                                    </td>
                                    <td className='px-4 py-3 text-right'>
                                        {s.status === 'closed' && (
                                            <Button
                                                size='sm'
                                                className='bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2'
                                                onClick={() => { if (confirm('Marcar como pago?')) payMut.mutate(s.id) }}
                                                loading={payMut.isPending}
                                                icon={<Wallet className='h-3 w-3' />}
                                            >
                                                Pagar
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
