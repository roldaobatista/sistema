import React, { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Inbox, Plus, Search, CheckCircle, Clock, AlertTriangle, ArrowRight,
    MessageSquare, UserCheck, Pause, Play, Flag, Filter, Calendar,
    FileText, Phone, DollarSign, Wrench, BarChart3, X,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'

// â”€â”€ ConfiguraÃ§Ãµes visuais â”€â”€

const tipoConfig: Record<string, { label: string; icon: any; color: string }> = {
    os: { label: 'OS', icon: Wrench, color: 'text-blue-600 bg-blue-50' },
    chamado: { label: 'Chamado', icon: Phone, color: 'text-cyan-600 bg-cyan-50' },
    orcamento: { label: 'OrÃ§amento', icon: FileText, color: 'text-amber-600 bg-amber-50' },
    financeiro: { label: 'Financeiro', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    calibracao: { label: 'CalibraÃ§Ã£o', icon: BarChart3, color: 'text-indigo-600 bg-indigo-50' },
    contrato: { label: 'Contrato', icon: FileText, color: 'text-rose-600 bg-rose-50' },
    tarefa: { label: 'Tarefa', icon: CheckCircle, color: 'text-surface-600 bg-surface-50' },
    lembrete: { label: 'Lembrete', icon: Clock, color: 'text-surface-500 bg-surface-50' },
}

const statusConfig: Record<string, { label: string; variant: any }> = {
    aberto: { label: 'Aberto', variant: 'info' },
    em_andamento: { label: 'Em Andamento', variant: 'warning' },
    concluido: { label: 'ConcluÃ­do', variant: 'success' },
    cancelado: { label: 'Cancelado', variant: 'danger' },
    aguardando: { label: 'Aguardando', variant: 'default' },
}

const prioridadeConfig: Record<string, { label: string; color: string; bg: string }> = {
    baixa: { label: 'Baixa', color: 'text-surface-500', bg: '' },
    media: { label: 'MÃ©dia', color: 'text-blue-600', bg: '' },
    alta: { label: 'Alta', color: 'text-amber-600', bg: 'bg-amber-50' },
    urgente: { label: 'Urgente', color: 'text-red-600', bg: 'bg-red-50' },
}

const tabs = [
    { key: 'todas', label: 'Todas' },
    { key: 'hoje', label: 'Hoje' },
    { key: 'atrasadas', label: 'Atrasadas' },
    { key: 'sem_prazo', label: 'Sem Prazo' },
]

export function CentralPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [tab, setTab] = useState('todas')
    const [tipoFilter, setTipoFilter] = useState('')
    const [prioridadeFilter, setPrioridadeFilter] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [showDetail, setShowDetail] = useState<any>(null)
    const [comment, setComment] = useState('')

    // Form state
    const [form, setForm] = useState({
        titulo: '', descricao_curta: '', tipo: 'tarefa',
        prioridade: 'media', due_at: '', visibilidade: 'equipe',
    })

    // â”€â”€ Queries â”€â”€

    const { data: summaryRes } = useQuery({
        queryKey: ['central-summary'],
        queryFn: () => api.get('/central/summary'),
        refetchInterval: 30000,
    })
    const summary = summaryRes?.data?.data ?? {}

    const { data: itemsRes, isLoading } = useQuery({
        queryKey: ['central-items', search, tab, tipoFilter, prioridadeFilter],
        queryFn: () => api.get('/central/items', {
            params: {
                search: search || undefined,
                aba: tab !== 'todas' ? tab : undefined,
                tipo: tipoFilter || undefined,
                prioridade: prioridadeFilter || undefined,
                per_page: 50,
            },
        }),
    })
    const items = itemsRes?.data?.data ?? []

    const { data: usersRes } = useQuery({
        queryKey: ['users-central'],
        queryFn: () => api.get('/users', { params: { per_page: 100 } }),
    })
    const users = usersRes?.data?.data ?? []

    // â”€â”€ Mutations â”€â”€

    const createMut = useMutation({
        mutationFn: () => api.post('/central/items', form),
        onSuccess: () => {
            toast.success('OperaÃ§Ã£o realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['central-items'] })
            qc.invalidateQueries({ queryKey: ['central-summary'] })
            setShowCreate(false)
            setForm({ titulo: '', descricao_curta: '', tipo: 'tarefa', prioridade: 'media', due_at: '', visibilidade: 'equipe' })
        },
    })

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/central/items/${id}`, data),
        onSuccess: () => {
            toast.success('OperaÃ§Ã£o realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['central-items'] })
            qc.invalidateQueries({ queryKey: ['central-summary'] })
        },
    })

    const assignMut = useMutation({
        mutationFn: ({ id, userId }: { id: number; userId: number }) =>
            api.post(`/central/items/${id}/assign`, { responsavel_user_id: userId }),
        onSuccess: () => { toast.success('OperaÃ§Ã£o realizada com sucesso'); qc.invalidateQueries({ queryKey: ['central-items'] }),
    })

    const commentMut = useMutation({
        mutationFn: ({ id, body }: { id: number; body: string }) =>
            api.post(`/central/items/${id}/comments`, { body }),
        onSuccess: () => {
            toast.success('OperaÃ§Ã£o realizada com sucesso') setComment(''); if (showDetail) fetchDetail(showDetail.id) },
    })

    // â”€â”€ Detail â”€â”€

    const fetchDetail = async (id: number) => {
        const res = await api.get(`/central/items/${id}`)
        setShowDetail(res.data?.data ?? res.data)
    }

    // â”€â”€ Helpers â”€â”€

    const formatDate = (d: string | null) => {
        if (!d) return 'â€”'
        return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }

    const isOverdue = (item: any) => {
        if (!item.due_at || item.status === 'concluido' || item.status === 'cancelado') return false
        return new Date(item.due_at) < new Date()
    }

    const stats = [
        { label: 'Abertas', value: summary.abertas ?? 0, icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Hoje', value: summary.hoje ?? 0, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Atrasadas', value: summary.atrasadas ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Urgentes', value: summary.urgentes ?? 0, icon: Flag, color: 'text-rose-600', bg: 'bg-rose-50' },
    ]

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Central</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Inbox unificado de trabalho â€” OS, Chamados, Tarefas e mais</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>Nova Tarefa</Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="rounded-xl border border-default bg-surface-0 p-4 shadow-card hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-lg p-2 ${s.bg}`}><Icon className={`h-5 w-5 ${s.color}`} /></div>
                                <div><p className="text-xs text-surface-500">{s.label}</p><p className="text-xl font-bold text-surface-900">{s.value}</p></div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Tabs + Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-1 rounded-lg bg-surface-100 p-1">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
                            {t.label}
                            {t.key === 'atrasadas' && (summary.atrasadas ?? 0) > 0 && (
                                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                    {summary.atrasadas}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                        <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar..."
                            className="w-full rounded-lg border border-default bg-surface-50 py-2 pl-10 pr-3 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <select value={tipoFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipoFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm">
                        <option value="">Tipo</option>
                        {Object.entries(tipoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select value={prioridadeFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrioridadeFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm">
                        <option value="">Prioridade</option>
                        {Object.entries(prioridadeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Items List */}
            <div className="space-y-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-xl border border-default bg-surface-0 py-16 text-center">
                        <Inbox className="mx-auto h-12 w-12 text-surface-300" />
                        <p className="mt-3 text-[13px] text-surface-500">Nenhum item encontrado</p>
                    </div>
                ) : items.map((item: any) => {
                    const tipo = tipoConfig[item.tipo] ?? tipoConfig.tarefa
                    const status = statusConfig[item.status] ?? statusConfig.aberto
                    const prio = prioridadeConfig[item.prioridade] ?? prioridadeConfig.media
                    const TipoIcon = tipo.icon
                    const overdue = isOverdue(item)

                    return (
                        <div key={item.id} onClick={() => fetchDetail(item.id)}
                            className={`group cursor-pointer rounded-xl border bg-white p-4 shadow-card transition-all hover:shadow-md hover:border-brand-200 ${overdue ? 'border-red-200 bg-red-50/30' : 'border-surface-200'} ${prio.bg}`}>
                            <div className="flex items-start gap-3">
                                {/* Type icon */}
                                <div className={`mt-0.5 rounded-lg p-2 ${tipo.color}`}>
                                    <TipoIcon className="h-4 w-4" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold text-surface-900 truncate">{item.titulo}</h3>
                                        <Badge variant={status.variant}>{status.label}</Badge>
                                        {overdue && <Badge variant="danger">Atrasado</Badge>}
                                    </div>
                                    {item.descricao_curta && (
                                        <p className="mt-0.5 text-xs text-surface-500 truncate">{item.descricao_curta}</p>
                                    )}
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-surface-400">
                                        <span className={`font-medium ${prio.color}`}>{prio.label}</span>
                                        {item.due_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(item.due_at)}</span>}
                                        {item.responsavel && <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{item.responsavel.name}</span>}
                                        {(item.comments_count ?? 0) > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{item.comments_count}</span>}
                                    </div>
                                </div>

                                {/* Quick actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.status === 'aberto' && (
                                        <button onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: item.id, data: { status: 'em_andamento' } }) }}
                                            title="Iniciar" className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><Play className="h-4 w-4" /></button>
                                    )}
                                    {(item.status === 'aberto' || item.status === 'em_andamento') && (
                                        <button onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: item.id, data: { status: 'concluido' } }) }}
                                            title="Concluir" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle className="h-4 w-4" /></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* â”€â”€ Modal Criar Tarefa â”€â”€ */}
            <Modal open={showCreate} onOpenChange={(v) => { if (!v) setShowCreate(false) }} title="Nova Tarefa">
                <div className="space-y-4">
                    <Input label="TÃ­tulo" value={form.titulo} onChange={(e: any) => setForm(f => ({ ...f, titulo: e.target.value }))} />
                    <Input label="DescriÃ§Ã£o" value={form.descricao_curta} onChange={(e: any) => setForm(f => ({ ...f, descricao_curta: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[13px] font-medium text-surface-700">Tipo</label>
                            <select value={form.tipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, tipo: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                <option value="tarefa">Tarefa</option>
                                <option value="lembrete">Lembrete</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[13px] font-medium text-surface-700">Prioridade</label>
                            <select value={form.prioridade} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, prioridade: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                {Object.entries(prioridadeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Prazo" type="datetime-local" value={form.due_at} onChange={(e: any) => setForm(f => ({ ...f, due_at: e.target.value }))} />
                        <div>
                            <label className="text-[13px] font-medium text-surface-700">Visibilidade</label>
                            <select value={form.visibilidade} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, visibilidade: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                <option value="privado">Privado</option>
                                <option value="equipe">Equipe</option>
                                <option value="empresa">Empresa</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                        <Button onClick={() => createMut.mutate()} loading={createMut.isPending}>Criar</Button>
                    </div>
                </div>
            </Modal>

            {/* â”€â”€ Modal Detalhes â”€â”€ */}
            <Modal open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null) }} title={showDetail?.titulo ?? 'Detalhes'}>
                {showDetail && (
                    <div className="space-y-4">
                        {/* Info */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-surface-500">Status:</span> <Badge variant={statusConfig[showDetail.status]?.variant ?? 'default'}>{statusConfig[showDetail.status]?.label ?? showDetail.status}</Badge></div>
                            <div><span className="text-surface-500">Prioridade:</span> <span className={`font-medium ${prioridadeConfig[showDetail.prioridade]?.color ?? ''}`}>{prioridadeConfig[showDetail.prioridade]?.label ?? showDetail.prioridade}</span></div>
                            <div><span className="text-surface-500">Tipo:</span> {tipoConfig[showDetail.tipo]?.label ?? showDetail.tipo}</div>
                            <div><span className="text-surface-500">Prazo:</span> {formatDate(showDetail.due_at)}</div>
                            <div><span className="text-surface-500">ResponsÃ¡vel:</span> {showDetail.responsavel?.name ?? 'â€”'}</div>
                            <div><span className="text-surface-500">Criado em:</span> {formatDate(showDetail.created_at)}</div>
                        </div>

                        {showDetail.descricao_curta && (
                            <p className="text-[13px] text-surface-600 bg-surface-50 rounded-lg p-3">{showDetail.descricao_curta}</p>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 border-t border-subtle pt-3">
                            {showDetail.status !== 'concluido' && showDetail.status !== 'cancelado' && (
                                <Button size="sm" variant="outline" icon={<CheckCircle className="h-4 w-4" />}
                                    onClick={() => { updateMut.mutate({ id: showDetail.id, data: { status: 'concluido' } }); setShowDetail(null) }}>
                                    Concluir
                                </Button>
                            )}
                            <div className="flex-1" />
                            <select onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { if (e.target.value) assignMut.mutate({ id: showDetail.id, userId: +e.target.value }) }}
                                className="rounded-lg border border-default bg-surface-50 px-2 py-1.5 text-xs">
                                <option value="">Reatribuir...</option>
                                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>

                        {/* Comments */}
                        <div className="border-t border-subtle pt-3">
                            <h4 className="text-sm font-semibold text-surface-700 mb-2">ComentÃ¡rios</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {(showDetail.comments ?? []).map((c: any) => (
                                    <div key={c.id} className="rounded-lg bg-surface-50 p-2">
                                        <p className="text-xs text-surface-900">{c.body}</p>
                                        <p className="text-[10px] text-surface-400 mt-1">{c.user?.name ?? 'Sistema'} â€¢ {formatDate(c.created_at)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                                <input value={comment} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComment(e.target.value)} placeholder="Adicionar comentÃ¡rio..."
                                    className="flex-1 rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                                <Button size="sm" onClick={() => commentMut.mutate({ id: showDetail.id, body: comment })} loading={commentMut.isPending}
                                    disabled={!comment.trim()}>Enviar</Button>
                            </div>
                        </div>

                        {/* History */}
                        {(showDetail.history ?? []).length > 0 && (
                            <div className="border-t border-subtle pt-3">
                                <h4 className="text-sm font-semibold text-surface-700 mb-2">HistÃ³rico</h4>
                                <div className="space-y-1 text-xs text-surface-500 max-h-32 overflow-y-auto">
                                    {(showDetail.history ?? []).map((h: any) => (
                                        <div key={h.id} className="flex gap-2">
                                            <span className="text-surface-400">{formatDate(h.created_at)}</span>
                                            <span>{h.action}: {h.from_value ?? ''} â†’ {h.to_value ?? ''}</span>
                                            <span className="text-surface-300">{h.user?.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}