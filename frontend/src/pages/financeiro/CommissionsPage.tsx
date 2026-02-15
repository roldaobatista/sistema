import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus, Search, CheckCircle, XCircle, AlertCircle, Calendar,
    Wallet, RefreshCw, Trash2, Edit, TrendingUp, Target, Megaphone, Repeat, Pause, Play, Download, RotateCcw, Split, Calculator
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

const fmtBRL = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

export function CommissionsPage() {
    const [activeTab, setActiveTab] = useState('overview')

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Gestão de Comissões'
                subtitle='Configure regras, acompanhe eventos e realize fechamentos.'
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className='space-y-4'>
                <TabsList>
                    <TabsTrigger value='overview'>Visão Geral</TabsTrigger>
                    <TabsTrigger value='events'>Eventos</TabsTrigger>
                    <TabsTrigger value='rules'>Regras</TabsTrigger>
                    <TabsTrigger value='settlements'>Fechamentos</TabsTrigger>
                    <TabsTrigger value='disputes'>Contestações</TabsTrigger>
                    <TabsTrigger value='goals'>Metas</TabsTrigger>
                    <TabsTrigger value='campaigns'>Campanhas</TabsTrigger>
                    <TabsTrigger value='recurring'>Recorrentes</TabsTrigger>
                    <TabsTrigger value='simulator'>Simulador</TabsTrigger>
                </TabsList>

                <TabsContent value='overview'><CommissionOverview /></TabsContent>
                <TabsContent value='events'><CommissionEvents /></TabsContent>
                <TabsContent value='rules'><CommissionRules /></TabsContent>
                <TabsContent value='settlements'><CommissionSettlements /></TabsContent>
                <TabsContent value='disputes'><CommissionDisputes /></TabsContent>
                <TabsContent value='goals'><CommissionGoals /></TabsContent>
                <TabsContent value='campaigns'><CommissionCampaigns /></TabsContent>
                <TabsContent value='recurring'><CommissionRecurring /></TabsContent>
                <TabsContent value='simulator'><CommissionSimulator /></TabsContent>
            </Tabs>
        </div>
    )
}

function CommissionOverview() {
    const { data: overviewRes } = useQuery({ queryKey: ['commission-overview'], queryFn: () => api.get('/commission-dashboard/overview') })
    const overview = overviewRes?.data?.data ?? overviewRes?.data ?? {}

    const [rankPeriod, setRankPeriod] = useState(new Date().toISOString().slice(0, 7))
    const { data: rankRes } = useQuery({ queryKey: ['commission-ranking', rankPeriod], queryFn: () => api.get('/commission-dashboard/ranking', { params: { period: rankPeriod } }) })
    const ranking = rankRes?.data?.data ?? rankRes?.data ?? []

    const { data: evoRes } = useQuery({ queryKey: ['commission-evolution'], queryFn: () => api.get('/commission-dashboard/evolution', { params: { months: 6 } }) })
    const evolution = evoRes?.data?.data ?? evoRes?.data ?? []

    const { data: byRuleRes } = useQuery({ queryKey: ['commission-by-rule'], queryFn: () => api.get('/commission-dashboard/by-rule') })
    const byRuleData = byRuleRes?.data?.data ?? byRuleRes?.data ?? []

    const { data: byRoleRes } = useQuery({ queryKey: ['commission-by-role'], queryFn: () => api.get('/commission-dashboard/by-role') })
    const byRoleData = byRoleRes?.data?.data ?? byRoleRes?.data ?? []

    const evoMax = Math.max(...evolution.map((e: any) => e.total), 1)
    const byRuleMax = Math.max(...byRuleData.map((r: any) => Number(r.total)), 1)
    const byRoleMax = Math.max(...byRoleData.map((r: any) => Number(r.total)), 1)

    const roleLabels: Record<string, string> = { technician: 'Técnico', seller: 'Vendedor', driver: 'Motorista' }

    return (
        <div className='space-y-6'>
            {/* KPI Cards */}
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                    <div className='flex items-center gap-4'>
                        <div className='h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600'>
                            <TrendingUp className='h-6 w-6' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Pago (Mês)</p>
                            <h3 className='text-2xl font-bold text-surface-900'>{fmtBRL(overview.paid_this_month ?? 0)}</h3>
                            {overview.variation_pct !== null && overview.variation_pct !== undefined && (
                                <span className={cn('text-xs font-medium', overview.variation_pct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                    {overview.variation_pct >= 0 ? '+' : ''}{overview.variation_pct}% vs mês anterior
                                </span>
                            )}
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
                <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                    <div className='flex items-center gap-4'>
                        <div className='h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600'>
                            <Target className='h-6 w-6' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Eventos no Mês</p>
                            <h3 className='text-2xl font-bold text-surface-900'>{overview.events_count ?? 0}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className='grid gap-4 lg:grid-cols-2'>
                {/* Evolution Chart */}
                <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                    <h3 className='font-semibold text-surface-900 mb-4'>Evolução Mensal</h3>
                    {evolution.length === 0 ? (
                        <div className='text-center py-8'><TrendingUp className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Sem dados de evolução.</p></div>
                    ) : (
                        <div className='flex items-end gap-2 h-48'>
                            {evolution.map((e: any) => (
                                <div key={e.period} className='flex-1 flex flex-col items-center gap-1'>
                                    <span className='text-[10px] font-medium text-surface-600'>{fmtBRL(e.total)}</span>
                                    <div className='w-full bg-brand-500 rounded-t-md transition-all' style={{ height: `${Math.max((e.total / evoMax) * 100, 4)}%` }} />
                                    <span className='text-[10px] text-surface-500'>{e.label ?? e.period}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ranking */}
                <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                    <div className='flex justify-between items-center mb-4'>
                        <h3 className='font-semibold text-surface-900'>Ranking — Top 10</h3>
                        <Input type='month' value={rankPeriod} onChange={(e: any) => setRankPeriod(e.target.value)} className='h-8 text-xs w-36' />
                    </div>
                    {ranking.length === 0 ? (
                        <div className='text-center py-8'><Target className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Sem dados de ranking.</p></div>
                    ) : (
                        <div className='space-y-2 max-h-48 overflow-y-auto'>
                            {ranking.map((r: any) => (
                                <div key={r.id} className='flex items-center gap-3 text-sm'>
                                    <span className='w-6 text-center font-bold text-surface-400'>{r.medal ?? r.position}</span>
                                    <span className='flex-1 font-medium text-surface-900 truncate'>{r.name}</span>
                                    <span className='text-xs text-surface-500'>{r.events_count} ev.</span>
                                    <span className='font-semibold text-emerald-600 tabular-nums'>{fmtBRL(r.total)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Distribution Row */}
            <div className='grid gap-4 lg:grid-cols-2'>
                {/* By Rule */}
                <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                    <h3 className='font-semibold text-surface-900 mb-4'>Distribuição por Tipo de Cálculo</h3>
                    {byRuleData.length === 0 ? (
                        <div className='text-center py-8'><Wallet className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Sem dados.</p></div>
                    ) : (
                        <div className='space-y-3'>
                            {byRuleData.map((r: any) => (
                                <div key={r.calculation_type}>
                                    <div className='flex justify-between text-xs mb-1'>
                                        <span className='font-medium text-surface-700'>{r.calculation_type?.replace(/_/g, ' ')}</span>
                                        <span className='text-surface-500'>{r.count} eventos — {fmtBRL(r.total)}</span>
                                    </div>
                                    <div className='h-2 rounded-full bg-surface-100'>
                                        <div className='h-full rounded-full bg-brand-500 transition-all' style={{ width: `${(Number(r.total) / byRuleMax) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* By Role */}
                <div className='rounded-xl border border-surface-200 bg-surface-0 p-6 shadow-sm'>
                    <h3 className='font-semibold text-surface-900 mb-4'>Distribuição por Papel</h3>
                    {byRoleData.length === 0 ? (
                        <div className='text-center py-8'><Wallet className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Sem dados.</p></div>
                    ) : (
                        <div className='space-y-3'>
                            {byRoleData.map((r: any) => (
                                <div key={r.role}>
                                    <div className='flex justify-between text-xs mb-1'>
                                        <span className='font-medium text-surface-700'>{roleLabels[r.role] ?? r.role}</span>
                                        <span className='text-surface-500'>{r.count} eventos — {fmtBRL(r.total)}</span>
                                    </div>
                                    <div className='h-2 rounded-full bg-surface-100'>
                                        <div className='h-full rounded-full bg-emerald-500 transition-all' style={{ width: `${(Number(r.total) / byRoleMax) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function CommissionRules() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.rule.create')
    const canUpdate = hasPermission('commissions.rule.update')
    const canDelete = hasPermission('commissions.rule.delete')
    const [showModal, setShowModal] = useState(false)
    const [deleteRuleId, setDeleteRuleId] = useState<number | null>(null)
    const [editing, setEditing] = useState<any>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [delError, setDelError] = useState<string | null>(null)

    const { data: rulesRes, isLoading } = useQuery({ queryKey: ['commission-rules'], queryFn: () => api.get('/commission-rules') })
    const rules = rulesRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: any) => editing ? api.put(`/commission-rules/${editing.id}`, data) : api.post('/commission-rules', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-rules'] }); setShowModal(false); setEditing(null); toast.success('Regra salva com sucesso') },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao salvar regra'; setSaveError(msg); toast.error(msg) }
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/commission-rules/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-rules'] }); toast.success('Regra excluída') },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao excluir regra'; setDelError(msg); toast.error(msg) }
    })

    // Usuários para select
    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users = usersRes?.data ?? []

    // Calculation types dinâmicos do backend
    const { data: calcTypesRes } = useQuery({ queryKey: ['commission-calculation-types'], queryFn: () => api.get('/commission-calculation-types') })
    const calcTypes: Record<string, string> = calcTypesRes?.data ?? {}

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-surface-200 shadow-sm'>
                <div>
                    <h2 className='font-semibold text-surface-900'>Regras de Comissão</h2>
                    <p className='text-xs text-surface-500'>Defina como as comissões são calculadas.</p>
                </div>
                {canCreate && <Button onClick={() => { setEditing(null); setShowModal(true) }} icon={<Plus className='h-4 w-4' />}>Nova Regra</Button>}
            </div>

            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {isLoading ? <p className='text-center col-span-full text-surface-500'>Carregando...</p> : rules.length === 0 ? <div className='text-center col-span-full py-8'><Wallet className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma regra cadastrada.</p></div> : rules.map((rule: any) => (
                    <div key={rule.id} className='bg-surface-0 border border-surface-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group'>
                        <div className='absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
                            {canUpdate && <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => { setEditing(rule); setShowModal(true) }}><Edit className='h-3.5 w-3.5' /></Button>}
                            {canDelete && <Button size='icon' variant='ghost' className='h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50' onClick={() => setDeleteRuleId(rule.id)}><Trash2 className='h-3.5 w-3.5' /></Button>}
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
                                {Object.keys(calcTypes).length > 0 ? (
                                    Object.entries(calcTypes).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))
                                ) : (
                                    <>
                                        <option value='percent_gross'>% Bruto</option>
                                        <option value='percent_net'>% Líquido</option>
                                        <option value='fixed_per_os'>Valor Fixo por OS</option>
                                    </>
                                )}
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

function CommissionEvents() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canUpdate = hasPermission('commissions.rule.update')

    const [eventError, setEventError] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterPeriod, setFilterPeriod] = useState('')
    const [filterUserId, setFilterUserId] = useState('')
    const [filterOs, setFilterOs] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [splitEvent, setSplitEvent] = useState<any>(null)
    const [splitRows, setSplitRows] = useState<{ user_id: string; percentage: string }[]>([{ user_id: '', percentage: '50' }, { user_id: '', percentage: '50' }])

    const params: Record<string, string> = {}
    if (filterStatus) params.status = filterStatus
    if (filterPeriod) params.period = filterPeriod
    if (filterUserId) params.user_id = filterUserId
    if (filterOs) params.os_number = filterOs

    const { data: eventsRes, isLoading } = useQuery({
        queryKey: ['commission-events', params],
        const { data, isLoading, isError } = useQuery({
        queryFn: () => api.get('/commission-events', { params }),
    })
    const events = eventsRes?.data?.data ?? []

    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users = usersRes?.data ?? []

    const approveMut = useMutation({
        mutationFn: (id: number) => api.put(`/commission-events/${id}/status`, { status: 'approved' }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] });
                qc.invalidateQueries({ queryKey: ['commission-overview'] }); setEventError(null); toast.success('Evento aprovado') },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao aprovar evento'; setEventError(msg); toast.error(msg) }
    })

    const reverseMut = useMutation({
        mutationFn: (id: number) => api.put(`/commission-events/${id}/status`, { status: 'reversed' }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] });
                qc.invalidateQueries({ queryKey: ['commission-overview'] }); setEventError(null); toast.success('Evento estornado') },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao estornar evento'; setEventError(msg); toast.error(msg) }
    })

    const batchMut = useMutation({
        mutationFn: (data: { ids: number[]; status: string }) => api.post('/commission-events/batch-status', data),
        onSuccess: (_, vars) => {
            qc.invalidateQueries({ queryKey: ['commission-events'] })
            qc.invalidateQueries({ queryKey: ['commission-overview'] })
            setSelectedIds(new Set())
            toast.success(`${vars.ids.length} eventos ${vars.status === 'approved' ? 'aprovados' : 'estornados'}`)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao processar lote')
    })

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }
    const pendingEvents = events.filter((ev: any) => ev.status === 'pending')
    const toggleAll = () => {
        if (selectedIds.size === pendingEvents.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(pendingEvents.map((ev: any) => ev.id)))
        }
    }

    const handleExport = () => { window.open(`${api.defaults.baseURL}/commission-events/export?${new URLSearchParams(params).toString()}`, '_blank') }

    const splitMut = useMutation({
        mutationFn: ({ eventId, splits }: { eventId: number; splits: any[] }) => api.post(`/commission-events/${eventId}/splits`, { splits }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] }); setSplitEvent(null); toast.success('Comissão dividida com sucesso') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao dividir comissão')
    })

    const { data: splitDataRes } = useQuery({
        queryKey: ['commission-splits', splitEvent?.id],
        const { data, isLoading, isError } = useQuery({
        queryFn: () => api.get(`/commission-events/${splitEvent.id}/splits`),
        enabled: !!splitEvent,
    })
    const existingSplits = splitDataRes?.data ?? []

    const [confirmEvAction, setConfirmEvAction] = useState<{ type: 'reverse' | 'batch_reverse'; id?: number } | null>(null)

    const openSplitModal = (ev: any) => {
        setSplitEvent(ev)
        setSplitRows([{ user_id: '', percentage: '50' }, { user_id: '', percentage: '50' }])
    }

    return (<>
        <div className='bg-surface-0 border border-surface-200 rounded-xl overflow-hidden shadow-sm'>
            <div className='p-4 border-b border-surface-200 flex flex-col gap-3'>
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
                        <label className='text-[10px] font-medium text-surface-500 mb-0.5 block'>Status</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className='h-8 rounded-lg border-surface-300 text-xs px-2 w-28'>
                            <option value=''>Todos</option>
                            <option value='pending'>Pendente</option>
                            <option value='approved'>Aprovado</option>
                            <option value='paid'>Pago</option>
                            <option value='reversed'>Estornado</option>
                        </select>
                    </div>
                    <div>
                        <label className='text-[10px] font-medium text-surface-500 mb-0.5 block'>Período</label>
                        <Input type='month' value={filterPeriod} onChange={(e: any) => setFilterPeriod(e.target.value)} className='h-8 text-xs w-36' />
                    </div>
                    <div>
                        <label className='text-[10px] font-medium text-surface-500 mb-0.5 block'>Usuário</label>
                        <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className='h-8 rounded-lg border-surface-300 text-xs px-2 w-40'>
                            <option value=''>Todos</option>
                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className='text-[10px] font-medium text-surface-500 mb-0.5 block'>Nº OS</label>
                        <Input placeholder='Ex: 1234' value={filterOs} onChange={(e: any) => setFilterOs(e.target.value)} className='h-8 text-xs w-24' />
                    </div>
                    {(filterStatus || filterPeriod || filterUserId || filterOs) && (
                        <Button variant='ghost' size='sm' className='h-8 text-xs' onClick={() => { setFilterStatus(''); setFilterPeriod(''); setFilterUserId(''); setFilterOs('') }}>Limpar</Button>
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
                    <thead className='bg-surface-50 text-surface-500 border-b border-surface-200'>
                        <tr>
                            {canUpdate && (
                                <th className='px-3 py-3 w-8'>
                                    <input type='checkbox' checked={pendingEvents.length > 0 && selectedIds.size === pendingEvents.length} onChange={toggleAll} className='rounded border-surface-300' />
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
                    <tbody className='divide-y divide-surface-100'>
                        {isLoading ? (
                            <tr><td colSpan={canUpdate ? 7 : 5} className='p-8 text-center text-surface-500'>Carregando eventos...</td></tr>
                        ) : events.length === 0 ? (
                            <tr><td colSpan={canUpdate ? 7 : 5} className='p-12 text-center'><Wallet className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhum evento registrado.</p></td></tr>
                        ) : events.map((ev: any) => (
                            <tr key={ev.id} className='hover:bg-surface-50 transition-colors'>
                                {canUpdate && (
                                    <td className='px-3 py-3'>
                                        {ev.status === 'pending' && <input type='checkbox' checked={selectedIds.has(ev.id)} onChange={() => toggleSelect(ev.id)} className='rounded border-surface-300' />}
                                    </td>
                                )}
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
                                <label className='text-[10px] font-medium text-surface-500 block mb-0.5'>Usuário</label>
                                <select value={row.user_id} onChange={e => { const next = [...splitRows]; next[idx].user_id = e.target.value; setSplitRows(next) }} className='w-full h-8 rounded-lg border-surface-300 text-xs px-2'>
                                    <option value=''>Selecione...</option>
                                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className='w-24'>
                                <label className='text-[10px] font-medium text-surface-500 block mb-0.5'>%</label>
                                <Input type='number' min='0.01' max='100' step='0.01' value={row.percentage} onChange={(e: any) => { const next = [...splitRows]; next[idx].percentage = e.target.value; setSplitRows(next) }} className='h-8 text-xs' />
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
                        onClick={() => splitMut.mutate({ eventId: splitEvent.id, splits: splitRows.map(r => ({ user_id: Number(r.user_id), percentage: Number(r.percentage) })) })}
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

function CommissionSettlements() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canManage = hasPermission('commissions.settlement.create')

    const [closePeriod, setClosePeriod] = useState(new Date().toISOString().slice(0, 7))
    const [closeUserId, setCloseUserId] = useState('')

    const { data: settRes, isLoading } = useQuery({ queryKey: ['commission-settlements'], queryFn: () => api.get('/commission-settlements') })
    const settlements = settRes?.data ?? []

    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users = usersRes?.data ?? []

    const [payError, setPayError] = useState<string | null>(null)
    const [confirmAction, setConfirmAction] = useState<{ type: 'pay' | 'reopen'; id: number } | null>(null)

    const closeMut = useMutation({
        mutationFn: (data: any) => api.post('/commission-settlements/close', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-settlements'] });
                qc.invalidateQueries({ queryKey: ['commission-events'] });
                qc.invalidateQueries({ queryKey: ['commission-overview'] }); toast.success('Período fechado com sucesso') },
        onError: (err: any) => { toast.error(err?.response?.data?.message ?? 'Erro ao fechar período') }
    })

    const payMut = useMutation({
        mutationFn: (id: number) => api.post(`/commission-settlements/${id}/pay`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-settlements'] });
                qc.invalidateQueries({ queryKey: ['commission-events'] });
                qc.invalidateQueries({ queryKey: ['commission-overview'] }); setPayError(null); toast.success('Pagamento registrado') },
        onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Erro ao pagar fechamento'; setPayError(msg); toast.error(msg) }
    })

    const reopenMut = useMutation({
        mutationFn: (id: number) => api.post(`/commission-settlements/${id}/reopen`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-settlements'] });
                qc.invalidateQueries({ queryKey: ['commission-events'] }); toast.success('Fechamento reaberto') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao reabrir fechamento')
    })

    const handleExportSettlements = () => { window.open(`${api.defaults.baseURL}/commission-settlements/export`, '_blank') }
    const handleDownloadStatement = (userId: number, period: string) => { window.open(`${api.defaults.baseURL}/commission-statement/pdf?user_id=${userId}&period=${period}`, '_blank') }

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
                <div className='p-4 border-b border-surface-200 flex justify-between items-center'>
                    <h2 className='font-semibold text-surface-900'>Fechamentos Realizados</h2>
                    <div className='flex gap-2'>
                        <Button variant='outline' size='sm' onClick={handleExportSettlements} icon={<Download className='h-3 w-3' />}>Exportar CSV</Button>
                    </div>
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
                                <tr><td colSpan={7} className='p-12 text-center'><Calendar className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhum fechamento realizado.</p></td></tr>
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
                                        <div className='flex justify-end gap-1'>
                                            <Button size='sm' variant='outline' className='h-7 text-xs px-2'
                                                onClick={() => handleDownloadStatement(s.user_id, s.period)}
                                                icon={<Download className='h-3 w-3' />}>PDF</Button>
                                            {canManage && s.status === 'closed' && (
                                                <>
                                                    <Button size='sm' className='bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2'
                                                        onClick={() => setConfirmAction({ type: 'pay', id: s.id })}
                                                        loading={payMut.isPending} icon={<Wallet className='h-3 w-3' />}>Pagar</Button>
                                                    <Button size='sm' variant='outline' className='h-7 text-xs px-2'
                                                        onClick={() => setConfirmAction({ type: 'reopen', id: s.id })}
                                                        loading={reopenMut.isPending} icon={<RotateCcw className='h-3 w-3' />}>Reabrir</Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Confirm Modal */}
            <Modal open={!!confirmAction} onOpenChange={() => setConfirmAction(null)} title={confirmAction?.type === 'pay' ? 'Confirmar Pagamento' : 'Confirmar Reabertura'}>
                <p className='text-sm text-surface-600 py-2'>
                    {confirmAction?.type === 'pay'
                        ? 'Deseja marcar este fechamento como pago? Todos os eventos serão marcados como pagos.'
                        : 'Deseja reabrir este fechamento? Os eventos voltarão ao status pendente.'}
                </p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setConfirmAction(null)}>Cancelar</Button>
                    <Button
                        className={confirmAction?.type === 'pay' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                        loading={confirmAction?.type === 'pay' ? payMut.isPending : reopenMut.isPending}
                        onClick={() => {
                            if (confirmAction?.type === 'pay') payMut.mutate(confirmAction.id)
                            else if (confirmAction) reopenMut.mutate(confirmAction.id)
                            setConfirmAction(null)
                        }}
                    >{confirmAction?.type === 'pay' ? 'Confirmar Pagamento' : 'Confirmar Reabertura'}</Button>
                </div>
            </Modal>
        </div>
    )
}

function CommissionDisputes() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.dispute.create')
    const canResolve = hasPermission('commissions.dispute.resolve')
    const [showModal, setShowModal] = useState(false)
    const { data: res, isLoading } = useQuery({ queryKey: ['commission-disputes'], queryFn: () => api.get('/commission-disputes') })
    const disputes = res?.data ?? []
    const { data: eventsRes } = useQuery({ queryKey: ['commission-events'], queryFn: () => api.get('/commission-events') })
    const events = eventsRes?.data?.data ?? []

    const storeMut = useMutation({
        mutationFn: (data: any) => api.post('/commission-disputes', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-disputes'] }); setShowModal(false); toast.success('Contestação registrada') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao registrar contestação')
    })
    const resolveMut = useMutation({
        mutationFn: ({ id, data }: any) => api.put(`/commission-disputes/${id}/resolve`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-disputes'] });
                qc.invalidateQueries({ queryKey: ['commission-events'] }); toast.success('Contestação resolvida') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao resolver')
    })

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-surface-200 shadow-sm'>
                <div><h2 className='font-semibold text-surface-900'>Contestações</h2><p className='text-xs text-surface-500'>Abra e resolva disputas de comissões.</p></div>
                {canCreate && <Button onClick={() => setShowModal(true)} icon={<Plus className='h-4 w-4' />}>Nova Contestação</Button>}
            </div>
            <div className='bg-surface-0 border border-surface-200 rounded-xl overflow-hidden shadow-sm'>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-surface-50 text-surface-500 border-b border-surface-200'>
                            <tr><th className='px-4 py-3 text-left font-medium'>Data</th><th className='px-4 py-3 text-left font-medium'>Usuário</th><th className='px-4 py-3 text-left font-medium'>Motivo</th><th className='px-4 py-3 text-right font-medium'>Valor</th><th className='px-4 py-3 text-center font-medium'>Status</th><th className='px-4 py-3 text-right font-medium'>Ações</th></tr>
                        </thead>
                        <tbody className='divide-y divide-surface-100'>
                            {isLoading ? <tr><td colSpan={6} className='p-8 text-center text-surface-500'>Carregando...</td></tr>
                                : disputes.length === 0 ? <tr><td colSpan={6} className='p-12 text-center'><AlertCircle className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma contestação registrada.</p></td></tr>
                                    : disputes.map((d: any) => (
                                        <tr key={d.id} className='hover:bg-surface-50 transition-colors'>
                                            <td className='px-4 py-3 text-surface-600'>{fmtDate(d.created_at)}</td>
                                            <td className='px-4 py-3 font-medium text-surface-900'>{d.user_name}</td>
                                            <td className='px-4 py-3 text-surface-600 max-w-xs truncate' title={d.reason}>{d.reason}</td>
                                            <td className='px-4 py-3 text-right font-semibold text-emerald-600'>{fmtBRL(d.commission_amount)}</td>
                                            <td className='px-4 py-3 text-center'><Badge variant={d.status === 'accepted' ? 'success' : d.status === 'rejected' ? 'danger' : 'secondary'}>{d.status === 'accepted' ? 'Aceita' : d.status === 'rejected' ? 'Rejeitada' : 'Aberta'}</Badge></td>
                                            <td className='px-4 py-3 text-right'>
                                                {d.status === 'open' && canResolve && (
                                                    <div className='flex justify-end gap-1'>
                                                        <Button size='sm' className='bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2' onClick={() => resolveMut.mutate({ id: d.id, data: { status: 'accepted', resolution_notes: 'Aceita via painel' } })}>Aceitar</Button>
                                                        <Button size='sm' variant='outline' className='text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-2' onClick={() => resolveMut.mutate({ id: d.id, data: { status: 'rejected', resolution_notes: 'Rejeitada via painel' } })}>Rejeitar</Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Modal open={showModal} onOpenChange={setShowModal} title='Nova Contestação'>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); storeMut.mutate({ commission_event_id: fd.get('commission_event_id'), reason: fd.get('reason') }) }} className='space-y-4'>
                    <div><label className='text-xs font-medium text-surface-700 mb-1 block'>Evento</label>
                        <select name='commission_event_id' required className='w-full rounded-lg border-surface-300 text-sm'>
                            <option value=''>Selecione...</option>
                            {events.filter((e: any) => e.status === 'pending' || e.status === 'approved').map((e: any) => <option key={e.id} value={e.id}>#{e.id} — {e.user?.name} — {fmtBRL(e.commission_amount)}</option>)}
                        </select>
                    </div>
                    <Input label='Motivo (min 10 caracteres)' name='reason' required minLength={10} />
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' type='button' onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type='submit' loading={storeMut.isPending}>Registrar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

function CommissionGoals() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.goal.create')
    const canDelete = hasPermission('commissions.goal.delete')
    const [showModal, setShowModal] = useState(false)
    const [deleteGoalId, setDeleteGoalId] = useState<number | null>(null)
    const { data: res, isLoading } = useQuery({ queryKey: ['commission-goals'], queryFn: () => api.get('/commission-goals') })
    const goals = res?.data ?? []
    const { data: usersRes } = useQuery({ queryKey: ['users-select'], queryFn: () => api.get('/users') })
    const users = usersRes?.data ?? []

    const storeMut = useMutation({
        mutationFn: (data: any) => api.post('/commission-goals', data),
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
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-surface-200 shadow-sm'>
                <div><h2 className='font-semibold text-surface-900'>Metas de Comissão</h2><p className='text-xs text-surface-500'>Defina metas mensais para os beneficiários.</p></div>
                {canCreate && <Button onClick={() => setShowModal(true)} icon={<Plus className='h-4 w-4' />}>Nova Meta</Button>}
            </div>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {isLoading ? <p className='text-center col-span-full text-surface-500'>Carregando...</p> : goals.length === 0 ? <div className='text-center col-span-full py-8'><Target className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma meta cadastrada.</p></div> : goals.map((g: any) => {
                    const pct = g.achievement_pct ?? 0
                    return (
                        <div key={g.id} className='bg-surface-0 border border-surface-200 p-4 rounded-xl shadow-sm relative group'>
                            <div className='absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
                                {canCreate && <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => refreshMut.mutate(g.id)}><RefreshCw className='h-3.5 w-3.5' /></Button>}
                                {canDelete && <Button size='icon' variant='ghost' className='h-7 w-7 text-red-600' onClick={() => setDeleteGoalId(g.id)}><Trash2 className='h-3.5 w-3.5' /></Button>}
                            </div>
                            <p className='text-sm font-bold text-surface-900'>{g.user_name}</p>
                            <p className='text-xs text-surface-500 mb-3'>{g.period}</p>
                            <div className='flex justify-between text-xs mb-1'><span>Alcançado: {fmtBRL(g.achieved_amount)}</span><span>Meta: {fmtBRL(g.target_amount)}</span></div>
                            <div className='h-2 rounded-full bg-surface-100'><div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400')} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                            <p className='text-xs text-surface-500 mt-1 text-right'>{pct}%</p>
                        </div>
                    )
                })}
            </div>
            <Modal open={showModal} onOpenChange={setShowModal} title='Nova Meta'>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); storeMut.mutate({ user_id: fd.get('user_id'), period: fd.get('period'), target_amount: fd.get('target_amount') }) }} className='space-y-4'>
                    <div><label className='text-xs font-medium text-surface-700 mb-1 block'>Usuário</label><select name='user_id' required className='w-full rounded-lg border-surface-300 text-sm'><option value=''>Selecione...</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                    <Input label='Período (YYYY-MM)' name='period' required defaultValue={new Date().toISOString().slice(0, 7)} />
                    <Input label='Meta (R$)' name='target_amount' type='number' step='0.01' required />
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

function CommissionCampaigns() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.campaign.create')
    const canDelete = hasPermission('commissions.campaign.delete')
    const [showModal, setShowModal] = useState(false)
    const [deleteCampId, setDeleteCampId] = useState<number | null>(null)
    const { data: res, isLoading } = useQuery({ queryKey: ['commission-campaigns'], queryFn: () => api.get('/commission-campaigns') })
    const campaigns = res?.data ?? []

    const [editingCampaign, setEditingCampaign] = useState<any>(null)
    const storeMut = useMutation({
        mutationFn: (data: any) => editingCampaign ? api.put(`/commission-campaigns/${editingCampaign.id}`, data) : api.post('/commission-campaigns', data),
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
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-surface-200 shadow-sm'>
                <div><h2 className='font-semibold text-surface-900'>Campanhas de Comissão</h2><p className='text-xs text-surface-500'>Multiplicadores temporários para comissões.</p></div>
                {canCreate && <Button onClick={() => { setEditingCampaign(null); setShowModal(true) }} icon={<Plus className='h-4 w-4' />}>Nova Campanha</Button>}
            </div>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {isLoading ? <p className='text-center col-span-full text-surface-500'>Carregando...</p> : campaigns.length === 0 ? <div className='text-center col-span-full py-8'><Megaphone className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma campanha cadastrada.</p></div> : campaigns.map((c: any) => (
                    <div key={c.id} className='bg-surface-0 border border-surface-200 p-4 rounded-xl shadow-sm relative group'>
                        <div className='absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
                            {canCreate && <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => { setEditingCampaign(c); setShowModal(true) }}><Edit className='h-3.5 w-3.5' /></Button>}
                            {canDelete && <Button size='icon' variant='ghost' className='h-7 w-7 text-red-600' onClick={() => setDeleteCampId(c.id)}><Trash2 className='h-3.5 w-3.5' /></Button>}
                        </div>
                        <h3 className='font-bold text-base text-surface-900 mb-1'>{c.name}</h3>
                        <span className='text-lg font-bold text-brand-600'>x{c.multiplier}</span>
                        <div className='pt-3 mt-3 border-t border-surface-100 text-xs text-surface-500 grid grid-cols-2 gap-2'>
                            <div><span className='block text-[10px] uppercase text-surface-400 font-semibold'>Início</span>{fmtDate(c.starts_at)}</div>
                            <div><span className='block text-[10px] uppercase text-surface-400 font-semibold'>Fim</span>{fmtDate(c.ends_at)}</div>
                            {c.applies_to_role && <div className='col-span-2'><span className='block text-[10px] uppercase text-surface-400 font-semibold'>Papel</span>{c.applies_to_role}</div>}
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
                    <div><label className='text-xs font-medium text-surface-700 mb-1 block'>Papel (opcional)</label><select name='applies_to_role' defaultValue={editingCampaign?.applies_to_role ?? ''} className='w-full rounded-lg border-surface-300 text-sm'><option value=''>Todos</option><option value='technician'>Técnico</option><option value='seller'>Vendedor</option><option value='driver'>Motorista</option></select></div>
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

function CommissionRecurring() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.recurring.create')
    const canUpdate = hasPermission('commissions.recurring.update')
    const [showProcessConfirm, setShowProcessConfirm] = useState(false)
    const { data: res, isLoading } = useQuery({ queryKey: ['recurring-commissions'], queryFn: () => api.get('/recurring-commissions') })
    const items = res?.data ?? []

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: number, status: string }) => api.put(`/recurring-commissions/${id}/status`, { status }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-commissions'] }); toast.success('Status atualizado') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao atualizar status')
    })
    const processMut = useMutation({
        mutationFn: () => api.post('/recurring-commissions/process'),
        onSuccess: (res: any) => { qc.invalidateQueries({ queryKey: ['recurring-commissions'] });
                qc.invalidateQueries({ queryKey: ['commission-events'] }); toast.success(res?.data?.message ?? 'Processamento concluído') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao processar')
    })

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center bg-surface-0 p-4 rounded-xl border border-surface-200 shadow-sm'>
                <div><h2 className='font-semibold text-surface-900'>Comissões Recorrentes</h2><p className='text-xs text-surface-500'>Comissões vinculadas a contratos recorrentes.</p></div>
                {canCreate && <Button onClick={() => setShowProcessConfirm(true)} loading={processMut.isPending} icon={<Play className='h-4 w-4' />}>Processar Mês</Button>}
            </div>
            <div className='bg-surface-0 border border-surface-200 rounded-xl overflow-hidden shadow-sm'>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-surface-50 text-surface-500 border-b border-surface-200'>
                            <tr><th className='px-4 py-3 text-left font-medium'>Usuário</th><th className='px-4 py-3 text-left font-medium'>Regra</th><th className='px-4 py-3 text-left font-medium'>Contrato</th><th className='px-4 py-3 text-center font-medium'>Status</th><th className='px-4 py-3 text-right font-medium'>Ações</th></tr>
                        </thead>
                        <tbody className='divide-y divide-surface-100'>
                            {isLoading ? <tr><td colSpan={5} className='p-8 text-center text-surface-500'>Carregando...</td></tr>
                                : items.length === 0 ? <tr><td colSpan={5} className='p-12 text-center'><Repeat className='h-8 w-8 mx-auto text-surface-300 mb-2' /><p className='text-surface-500'>Nenhuma comissão recorrente cadastrada.</p></td></tr>
                                    : items.map((r: any) => (
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

function CommissionSimulator() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.rule.create')
    const [woId, setWoId] = useState('')
    const [showGenConfirm, setShowGenConfirm] = useState(false)
    const simMut = useMutation({
        mutationFn: (workOrderId: string) => api.post('/commission-simulate', { work_order_id: Number(workOrderId) }),
        onSuccess: () => { toast.success('Simulação concluída') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao simular comissão'),
    })
    const genMut = useMutation({
        mutationFn: (workOrderId: string) => api.post('/commission-events/generate', { work_order_id: Number(workOrderId) }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] });
                qc.invalidateQueries({ queryKey: ['commission-overview'] }); toast.success('Comissões geradas com sucesso!') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao gerar comissões')
    })
    const results = simMut.data?.data ?? []

    const content = (
        <div className='space-y-4'>
            <div className='bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm'>
                <div className='flex items-center gap-3 mb-4'>
                    <div className='h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600'>
                        <Calculator className='h-5 w-5' />
                    </div>
                    <div>
                        <h2 className='font-semibold text-surface-900'>Simulador de Comissão</h2>
                        <p className='text-xs text-surface-500'>Insira o ID da OS para pré-visualizar as comissões que seriam geradas — sem salvar no banco.</p>
                    </div>
                </div>
                <div className='flex gap-3 items-end'>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>ID da Ordem de Serviço</label>
                        <Input type='number' placeholder='Ex: 123' value={woId} onChange={(e: any) => setWoId(e.target.value)} className='w-40' />
                    </div>
                    <Button onClick={() => { if (woId) simMut.mutate(woId) }} loading={simMut.isPending} disabled={!woId} icon={<Calculator className='h-4 w-4' />}>Simular</Button>
                </div>
            </div>

            {simMut.isSuccess && (
                <div className='bg-surface-0 border border-surface-200 rounded-xl overflow-hidden shadow-sm'>
                    <div className='p-4 border-b border-surface-200'>
                        <h3 className='font-semibold text-surface-900'>Resultado da Simulação</h3>
                        <p className='text-xs text-surface-500'>OS #{woId} — {results.length} comissão(ões) simulada(s)</p>
                    </div>
                    {results.length === 0 ? (
                        <div className='p-12 text-center'>
                            <Calculator className='h-8 w-8 mx-auto text-surface-300 mb-2' />
                            <p className='text-surface-500'>Nenhuma regra de comissão se aplica a esta OS.</p>
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm'>
                                <thead className='bg-surface-50 text-surface-500 border-b border-surface-200'>
                                    <tr>
                                        <th className='px-4 py-3 text-left font-medium'>Regra</th>
                                        <th className='px-4 py-3 text-left font-medium'>Beneficiário</th>
                                        <th className='px-4 py-3 text-left font-medium'>Tipo Cálculo</th>
                                        <th className='px-4 py-3 text-right font-medium'>Base</th>
                                        <th className='px-4 py-3 text-right font-medium'>Taxa / Valor</th>
                                        <th className='px-4 py-3 text-right font-medium'>Comissão</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-surface-100'>
                                    {results.map((sim: any, idx: number) => (
                                        <tr key={idx} className='hover:bg-surface-50 transition-colors'>
                                            <td className='px-4 py-3 font-medium text-surface-900'>{sim.rule_name ?? sim.rule?.name ?? `Regra #${sim.rule_id}`}</td>
                                            <td className='px-4 py-3 text-surface-700'>{sim.user_name ?? sim.user?.name ?? `User #${sim.user_id}`}</td>
                                            <td className='px-4 py-3'>
                                                <Badge variant='outline' className='text-[10px]'>{sim.calculation_type?.replace(/_/g, ' ')}</Badge>
                                            </td>
                                            <td className='px-4 py-3 text-right text-surface-600'>{fmtBRL(sim.base_amount ?? 0)}</td>
                                            <td className='px-4 py-3 text-right text-surface-600'>{sim.rate ? `${sim.rate}%` : fmtBRL(sim.fixed_amount ?? 0)}</td>
                                            <td className='px-4 py-3 text-right font-semibold text-emerald-600'>{fmtBRL(sim.commission_amount ?? 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className='bg-surface-50 border-t border-surface-200'>
                                    <tr>
                                        <td colSpan={5} className='px-4 py-3 text-right font-semibold text-surface-700'>Total Simulado:</td>
                                        <td className='px-4 py-3 text-right font-bold text-emerald-600 text-base'>{fmtBRL(results.reduce((sum: number, s: any) => sum + Number(s.commission_amount ?? 0), 0))}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {results.length > 0 && canCreate && (
                        <div className='p-4 border-t border-surface-200 flex justify-end'>
                            <Button onClick={() => setShowGenConfirm(true)}
                                loading={genMut.isPending} className='bg-emerald-600 hover:bg-emerald-700 text-white'
                                icon={<CheckCircle className='h-4 w-4' />}>Gerar Comissões</Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )

    return (
        <>\r\n            {content}
            <Modal open={showGenConfirm} onOpenChange={setShowGenConfirm} title='Gerar Comissões'>
                <p className='text-sm text-surface-600 py-2'>
                    Deseja gerar {results.length} comissão(ões) para a OS #{woId}? Esta ação criará eventos reais no sistema.
                </p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setShowGenConfirm(false)}>Cancelar</Button>
                    <Button className='bg-emerald-600 hover:bg-emerald-700 text-white' loading={genMut.isPending}
                        onClick={() => { genMut.mutate(woId); setShowGenConfirm(false) }}>Confirmar Geração</Button>
                </div>
            </Modal>
        </>
    )
}
