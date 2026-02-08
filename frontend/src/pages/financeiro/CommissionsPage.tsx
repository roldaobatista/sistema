import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Award, Plus, Users, Settings, FileText,
    CheckCircle, Clock, Trash2, Percent, DollarSign,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

const eventStatusConfig: Record<string, { label: string; variant: any }> = {
    pending: { label: 'Pendente', variant: 'warning' },
    approved: { label: 'Aprovado', variant: 'info' },
    paid: { label: 'Pago', variant: 'success' },
    reversed: { label: 'Estornado', variant: 'danger' },
}

const settlementStatusConfig: Record<string, { label: string; variant: any }> = {
    open: { label: 'Aberto', variant: 'warning' },
    closed: { label: 'Fechado', variant: 'info' },
    paid: { label: 'Pago', variant: 'success' },
}

const calcTypeLabels: Record<string, string> = {
    percent_gross: '% Bruto',
    percent_net: '% Líquido',
    percent_gross_minus_displacement: '% (Bruto−Desloc.)',
    percent_services_only: '% Serviços',
    percent_products_only: '% Produtos',
    fixed_per_os: 'Fixo/OS',
    percent_profit: '% Lucro',
    percent_gross_minus_expenses: '% (Bruto−Desp.)',
    tiered_gross: '% Escalonado',
    custom_formula: 'Fórmula',
}

const roleLabels: Record<string, string> = {
    technician: 'Técnico',
    seller: 'Vendedor',
    driver: 'Motorista',
}

const whenLabels: Record<string, string> = {
    os_completed: 'OS Concluída',
    installment_paid: 'Parcela Paga',
    os_invoiced: 'OS Faturada',
}

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Tab = 'rules' | 'events' | 'settlements'

export function CommissionsPage() {
    const qc = useQueryClient()
    const [tab, setTab] = useState<Tab>('events')
    const [showRuleForm, setShowRuleForm] = useState(false)
    const [ruleForm, setRuleForm] = useState({
        user_id: '' as string | number, name: '', type: 'percentage', value: '', applies_to: 'all',
        calculation_type: 'percent_gross', applies_to_role: 'technician', applies_when: 'os_completed',
    })
    const [userFilter, setUserFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showGenerate, setShowGenerate] = useState(false)
    const [genWoId, setGenWoId] = useState<string | number>('')
    const [showClose, setShowClose] = useState(false)
    const [closeForm, setCloseForm] = useState({ user_id: '' as string | number, period: '' })

    const { data: techsRes } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => api.get('/users', { params: { per_page: 50 } }),
    })
    const technicians = techsRes?.data?.data ?? []

    const { data: summaryRes } = useQuery({
        queryKey: ['commission-summary'],
        queryFn: () => api.get('/commission-summary'),
    })
    const summary = summaryRes?.data ?? {}

    // Rules
    const { data: rulesRes } = useQuery({
        queryKey: ['commission-rules', userFilter],
        queryFn: () => api.get('/commission-rules', { params: { user_id: userFilter || undefined } }),
        enabled: tab === 'rules',
    })
    const rules = rulesRes?.data ?? []

    // Events
    const { data: eventsRes } = useQuery({
        queryKey: ['commission-events', userFilter, statusFilter],
        queryFn: () => api.get('/commission-events', {
            params: { user_id: userFilter || undefined, status: statusFilter || undefined, per_page: 50 },
        }),
        enabled: tab === 'events',
    })
    const events = eventsRes?.data?.data ?? []

    // Settlements
    const { data: settRes } = useQuery({
        queryKey: ['commission-settlements', userFilter],
        queryFn: () => api.get('/commission-settlements', { params: { user_id: userFilter || undefined } }),
        enabled: tab === 'settlements',
    })
    const settlements = settRes?.data ?? []

    const { data: wosRes } = useQuery({
        queryKey: ['work-orders-commission'],
        queryFn: () => api.get('/work-orders', { params: { per_page: 50 } }),
        enabled: showGenerate,
    })

    const saveRuleMut = useMutation({
        mutationFn: (data: typeof ruleForm) => api.post('/commission-rules', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-rules'] }); setShowRuleForm(false) },
    })

    const delRuleMut = useMutation({
        mutationFn: (id: number) => api.delete(`/commission-rules/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-rules'] }),
    })

    const genMut = useMutation({
        mutationFn: (woId: string | number) => api.post('/commission-events/generate', { work_order_id: woId }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] }); qc.invalidateQueries({ queryKey: ['commission-summary'] }); setShowGenerate(false) },
    })

    const updateStatusMut = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/commission-events/${id}/status`, { status }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-events'] }); qc.invalidateQueries({ queryKey: ['commission-summary'] }) },
    })

    const closeMut = useMutation({
        mutationFn: (data: typeof closeForm) => api.post('/commission-settlements/close', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-settlements'] }); qc.invalidateQueries({ queryKey: ['commission-events'] }); qc.invalidateQueries({ queryKey: ['commission-summary'] }); setShowClose(false) },
    })

    const paySettMut = useMutation({
        mutationFn: (id: number) => api.post(`/commission-settlements/${id}/pay`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-settlements'] }); qc.invalidateQueries({ queryKey: ['commission-summary'] }) },
    })

    const tabs: { key: Tab; label: string; icon: any }[] = [
        { key: 'events', label: 'Eventos', icon: FileText },
        { key: 'rules', label: 'Regras', icon: Settings },
        { key: 'settlements', label: 'Fechamento', icon: CheckCircle },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Comissões</h1>
                    <p className="mt-1 text-sm text-surface-500">Regras, eventos e fechamento de comissões</p>
                </div>
                <div className="flex gap-2">
                    {tab === 'rules' && <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setRuleForm({ user_id: '', name: '', type: 'percentage', value: '', applies_to: 'all', calculation_type: 'percent_gross', applies_to_role: 'technician', applies_when: 'os_completed' }); setShowRuleForm(true) }}>Nova Regra</Button>}
                    {tab === 'events' && <Button icon={<Award className="h-4 w-4" />} onClick={() => { setGenWoId(''); setShowGenerate(true) }}>Gerar da OS</Button>}
                    {tab === 'settlements' && <Button icon={<CheckCircle className="h-4 w-4" />} onClick={() => { setCloseForm({ user_id: '', period: '' }); setShowClose(true) }}>Fechar Período</Button>}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-2 text-amber-600"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Pendente</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.pending ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sky-600"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Aprovado</span></div>
                    <p className="mt-1 text-xl font-bold text-sky-600">{fmtBRL(summary.approved ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-2 text-emerald-600"><DollarSign className="h-4 w-4" /><span className="text-xs font-medium">Pago (mês)</span></div>
                    <p className="mt-1 text-xl font-bold text-emerald-600">{fmtBRL(summary.paid_this_month ?? 0)}</p>
                </div>
            </div>

            {/* Tabs + Filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex rounded-lg border border-surface-200 bg-surface-50 p-0.5">
                    {tabs.map(t => {
                        const Icon = t.icon
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                                    tab === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
                                <Icon className="h-3.5 w-3.5" />{t.label}
                            </button>
                        )
                    })}
                </div>
                <select value={userFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUserFilter(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os técnicos</option>
                    {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {/* Tab: Rules */}
            {tab === 'rules' && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {rules.map((r: any) => (
                        <div key={r.id} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-surface-900">{r.name}</h3>
                                <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir?')) delRuleMut.mutate(r.id) }}>
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                            </div>
                            <p className="text-xs text-surface-500 mt-0.5">{r.user?.name}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                <div className="flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1">
                                    {r.calculation_type === 'fixed_per_os'
                                        ? <><DollarSign className="h-3.5 w-3.5 text-brand-600" /><span className="text-sm font-bold text-brand-700">{fmtBRL(r.value)}</span></>
                                        : <><Percent className="h-3.5 w-3.5 text-brand-600" /><span className="text-sm font-bold text-brand-700">{r.value}%</span></>
                                    }
                                </div>
                                <Badge variant={r.active ? 'success' : 'default'}>{r.active ? 'Ativa' : 'Inativa'}</Badge>
                                <Badge variant="brand">{calcTypeLabels[r.calculation_type] ?? r.calculation_type}</Badge>
                                <Badge variant="info">{roleLabels[r.applies_to_role] ?? r.applies_to_role}</Badge>
                            </div>
                        </div>
                    ))}
                    {rules.length === 0 && <p className="col-span-full text-center text-sm text-surface-500 py-8">Nenhuma regra cadastrada</p>}
                </div>
            )}

            {/* Tab: Events */}
            {tab === 'events' && (
                <>
                    <div className="flex gap-2">
                        <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                            className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                            <option value="">Todos os status</option>
                            {Object.entries(eventStatusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-50">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Técnico</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">OS</th>
                                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Regra</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Base</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Comissão</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {events.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum evento</td></tr>
                                ) : events.map((e: any) => (
                                    <tr key={e.id} className="hover:bg-surface-50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-surface-900">{e.user?.name}</td>
                                        <td className="px-4 py-3 text-xs text-brand-600 font-medium">{e.work_order?.number}</td>
                                        <td className="hidden px-4 py-3 text-xs text-surface-500 md:table-cell">{e.rule?.name}</td>
                                        <td className="px-4 py-3 text-right text-sm text-surface-600">{fmtBRL(e.base_amount)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-surface-900">{fmtBRL(e.commission_amount)}</td>
                                        <td className="px-4 py-3"><Badge variant={eventStatusConfig[e.status]?.variant}>{eventStatusConfig[e.status]?.label}</Badge></td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {e.status === 'pending' && (
                                                    <Button variant="ghost" size="sm" onClick={() => updateStatusMut.mutate({ id: e.id, status: 'approved' })}>
                                                        <CheckCircle className="h-4 w-4 text-sky-500" />
                                                    </Button>
                                                )}
                                                {e.status !== 'reversed' && e.status !== 'paid' && (
                                                    <Button variant="ghost" size="sm" onClick={() => updateStatusMut.mutate({ id: e.id, status: 'reversed' })}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Tab: Settlements */}
            {tab === 'settlements' && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {settlements.map((s: any) => (
                        <div key={s.id} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-surface-900">{s.user?.name}</h3>
                                    <p className="text-xs text-surface-500">{s.period} • {s.events_count} eventos</p>
                                </div>
                                <Badge variant={settlementStatusConfig[s.status]?.variant}>{settlementStatusConfig[s.status]?.label}</Badge>
                            </div>
                            <p className="mt-2 text-xl font-bold text-surface-900">{fmtBRL(s.total_amount)}</p>
                            {s.status === 'closed' && (
                                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => paySettMut.mutate(s.id)} loading={paySettMut.isPending}>
                                    Marcar como Pago
                                </Button>
                            )}
                        </div>
                    ))}
                    {settlements.length === 0 && <p className="col-span-full text-center text-sm text-surface-500 py-8">Nenhum fechamento</p>}
                </div>
            )}

            {/* Rule Modal */}
            <Modal open={showRuleForm} onOpenChange={setShowRuleForm} title="Nova Regra de Comissão">
                <form onSubmit={e => { e.preventDefault(); saveRuleMut.mutate(ruleForm) }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Pessoa *</label>
                            <select value={ruleForm.user_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRuleForm(p => ({ ...p, user_id: e.target.value }))} required
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">Selecionar</option>
                                {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Papel</label>
                            <select value={ruleForm.applies_to_role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRuleForm(p => ({ ...p, applies_to_role: e.target.value }))}
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>
                    <Input label="Nome da regra" value={ruleForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRuleForm(p => ({ ...p, name: e.target.value }))} required placeholder="Ex: 10% sobre serviços" />
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo de Cálculo *</label>
                        <select value={ruleForm.calculation_type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRuleForm(p => ({ ...p, calculation_type: e.target.value }))}
                            className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                            {Object.entries(calcTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label={ruleForm.calculation_type === 'fixed_per_os' ? 'Valor (R$)' : 'Percentual (%)'} type="number" step="0.01"
                            value={ruleForm.value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRuleForm(p => ({ ...p, value: e.target.value }))} required />
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Quando</label>
                            <select value={ruleForm.applies_when} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRuleForm(p => ({ ...p, applies_when: e.target.value }))}
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                {Object.entries(whenLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Aplica a</label>
                            <select value={ruleForm.applies_to} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRuleForm(p => ({ ...p, applies_to: e.target.value }))}
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="all">Tudo</option>
                                <option value="products">Produtos</option>
                                <option value="services">Serviços</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowRuleForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveRuleMut.isPending}>Criar</Button>
                    </div>
                </form>
            </Modal>

            {/* Generate Modal */}
            <Modal open={showGenerate} onOpenChange={setShowGenerate} title="Gerar Comissões da OS">
                <form onSubmit={e => { e.preventDefault(); genMut.mutate(genWoId) }} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">OS *</label>
                        <select value={genWoId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGenWoId(e.target.value)} required
                            className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                            <option value="">Selecionar</option>
                            {(wosRes?.data?.data ?? []).map((wo: any) => <option key={wo.id} value={wo.id}>{wo.number} — {wo.customer?.name} — {fmtBRL(wo.total)}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowGenerate(false)}>Cancelar</Button>
                        <Button type="submit" loading={genMut.isPending}>Gerar</Button>
                    </div>
                </form>
            </Modal>

            {/* Close Settlement Modal */}
            <Modal open={showClose} onOpenChange={setShowClose} title="Fechar Período">
                <form onSubmit={e => { e.preventDefault(); closeMut.mutate(closeForm) }} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Técnico *</label>
                        <select value={closeForm.user_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCloseForm(p => ({ ...p, user_id: e.target.value }))} required
                            className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                            <option value="">Selecionar</option>
                            {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <Input label="Período (YYYY-MM)" value={closeForm.period} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCloseForm(p => ({ ...p, period: e.target.value }))} required placeholder="2026-02" />
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowClose(false)}>Cancelar</Button>
                        <Button type="submit" loading={closeMut.isPending}>Fechar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
