import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Inbox, Plus, Search, CheckCircle, Clock, AlertTriangle,
    MessageSquare, UserCheck, Play, Flag, Calendar,
    FileText, Phone, DollarSign, Wrench, BarChart3, ExternalLink, CalendarClock,
    ArrowUp, ArrowDown,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'

// â”€â”€ Configurações visuais â”€â”€

const tipoConfig: Record<string, { label: string; icon: any; color: string }> = {
    os: { label: 'OS', icon: Wrench, color: 'text-blue-600 bg-blue-50' },
    chamado: { label: 'Chamado', icon: Phone, color: 'text-cyan-600 bg-cyan-50' },
    orçamento: { label: 'Orçamento', icon: FileText, color: 'text-amber-600 bg-amber-50' },
    financeiro: { label: 'Financeiro', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    calibracao: { label: 'Calibração', icon: BarChart3, color: 'text-indigo-600 bg-indigo-50' },
    contrato: { label: 'Contrato', icon: FileText, color: 'text-rose-600 bg-rose-50' },
    tarefa: { label: 'Tarefa', icon: CheckCircle, color: 'text-surface-600 bg-surface-50' },
    lembrete: { label: 'Lembrete', icon: Clock, color: 'text-surface-500 bg-surface-50' },
    outro: { label: 'Outro', icon: Inbox, color: 'text-surface-500 bg-surface-50' },
}

const statusConfig: Record<string, { label: string; variant: any }> = {
    aberto: { label: 'Aberto', variant: 'info' },
    em_andamento: { label: 'Em Andamento', variant: 'warning' },
    concluido: { label: 'Concluído', variant: 'success' },
    cancelado: { label: 'Cancelado', variant: 'danger' },
    aguardando: { label: 'Aguardando', variant: 'default' },
}

const prioridadeConfig: Record<string, { label: string; color: string; bg: string }> = {
    baixa: { label: 'Baixa', color: 'text-surface-500', bg: '' },
    media: { label: 'Média', color: 'text-blue-600', bg: '' },
    alta: { label: 'Alta', color: 'text-amber-600', bg: 'bg-amber-50' },
    urgente: { label: 'Urgente', color: 'text-red-600', bg: 'bg-red-50' },
}

/** Normaliza valores da API (UPPERCASE) para chaves do frontend */
function tipoKey(t: string | undefined): string {
    if (!t) return 'tarefa'
    const map: Record<string, string> = {
        OS: 'os', CHAMADO: 'chamado', ORCAMENTO: 'orçamento', FINANCEIRO: 'financeiro',
        CALIBRACAO: 'calibracao', CONTRATO: 'contrato', TAREFA: 'tarefa', LEMBRETE: 'lembrete', OUTRO: 'outro',
    }
    return map[t.toUpperCase()] ?? t.toLowerCase() ?? 'tarefa'
}
function statusKey(s: string | undefined): string {
    if (!s) return 'aberto'
    const map: Record<string, string> = {
        ABERTO: 'aberto', EM_ANDAMENTO: 'em_andamento', AGUARDANDO: 'aguardando',
        CONCLUIDO: 'concluido', CANCELADO: 'cancelado',
    }
    return map[s.toUpperCase()] ?? s.toLowerCase() ?? 'aberto'
}
function prioridadeKey(p: string | undefined): string {
    if (!p) return 'media'
    return p.toLowerCase()
}

/** Link para a entidade de origem (OS, Chamado, etc.) */
function sourceLink(refTipo: string | undefined, refId: number | undefined): string | null {
    if (!refTipo || !refId) return null
    const t = refTipo.split('\\').pop() ?? ''
    const map: Record<string, string> = {
        WorkOrder: '/os',
        ServiceCall: '/chamados',
        Quote: '/orcamentos',
        Equipment: '/equipamentos',
    }
    const base = map[t]
    return base ? `${base}/${refId}` : null
}

const tabs = [
    { key: 'todas', label: 'Todas' },
    { key: 'hoje', label: 'Hoje' },
    { key: 'atrasadas', label: 'Atrasadas' },
    { key: 'sem_prazo', label: 'Sem Prazo' },
]

export function CentralPage() {
    const { hasPermission, user: authUser } = useAuthStore()

    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [tab, setTab] = useState('todas')
    const [tipoFilter, setTipoFilter] = useState('')
    const [prioridadeFilter, setPrioridadeFilter] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [showDetail, setShowDetail] = useState<any>(null)
    const [comment, setComment] = useState('')

    const [scope, setScope] = useState<'todas' | 'minhas'>('todas')
    const [page, setPage] = useState(1)
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchInput, setSearchInput] = useState('')
    const [sortBy, setSortBy] = useState<'due_at' | 'prioridade' | 'created_at'>('due_at')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const [responsavelFilter, setResponsavelFilter] = useState<number | ''>('')
    const [showSnoozePicker, setShowSnoozePicker] = useState(false)
    const [snoozeCustomDate, setSnoozeCustomDate] = useState('')

    // Form state
    const [form, setForm] = useState({
        titulo: '', descricao_curta: '', tipo: 'tarefa',
        prioridade: 'media', due_at: '', visibilidade: 'equipe',
        responsavel_user_id: '' as number | '',
        remind_at: '',
    })

    // â”€â”€ Queries â”€â”€

    const { data: summaryRes } = useQuery({
        queryKey: ['central-summary'],
        queryFn: () => api.get('/central/summary'),
        refetchInterval: 30000,
    })
    const summary = summaryRes?.data?.data ?? summaryRes?.data ?? {}

    const { data: itemsRes, isLoading, isError, refetch } = useQuery({
        queryKey: ['central-items', search, tab, tipoFilter, prioridadeFilter, scope, page, sortBy, sortDir, responsavelFilter],
        queryFn: () => api.get('/central/items', {
            params: {
                search: search || undefined,
                aba: tab !== 'todas' ? tab : undefined,
                tipo: tipoFilter || undefined,
                prioridade: prioridadeFilter || undefined,
                scope: scope === 'minhas' ? 'minhas' : undefined,
                responsavel_user_id: responsavelFilter || undefined,
                sort_by: sortBy,
                sort_dir: sortDir,
                per_page: 20,
                page,
            },
        }),
    })
    const paginator = itemsRes?.data
    const items = paginator?.data ?? []
    const currentPage = paginator?.current_page ?? 1
    const lastPage = paginator?.last_page ?? 1
    const total = paginator?.total ?? 0

    const { data: usersRes } = useQuery({
        queryKey: ['users-central'],
        queryFn: () => api.get('/users', { params: { per_page: 100 } }),
    })
    const users = usersRes?.data?.data ?? []

    // â”€â”€ Mutations â”€â”€

    const createMut = useMutation({
        mutationFn: () => api.post('/central/items', {
            ...form,
            responsavel_user_id: form.responsavel_user_id || undefined,
            remind_at: form.remind_at || undefined,
        }),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['central-items'] })
            qc.invalidateQueries({ queryKey: ['central-summary'] })
            setShowCreate(false)
            setForm({
                titulo: '', descricao_curta: '', tipo: 'tarefa', prioridade: 'media',
                due_at: '', visibilidade: 'equipe', responsavel_user_id: '', remind_at: '',
            })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao criar item'),
    })

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/central/items/${id}`, data),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['central-items'] })
            qc.invalidateQueries({ queryKey: ['central-summary'] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao atualizar item'),
    })

    const assignMut = useMutation({
        mutationFn: ({ id, userId }: { id: number; userId: number }) =>
            api.post(`/central/items/${id}/assign`, { responsavel_user_id: userId }),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['central-items'] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao atribuir'),
    })

    const commentMut = useMutation({
        mutationFn: ({ id, body }: { id: number; body: string }) =>
            api.post(`/central/items/${id}/comments`, { body }),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                setComment('')
            if (showDetail) fetchDetail(showDetail.id)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao comentar'),
    })

    // â”€â”€ Detail â”€â”€

    const fetchDetail = async (id: number) => {
        const res = await api.get(`/central/items/${id}`)
        setShowDetail(res.data?.data ?? res.data)
    }

    useEffect(() => {
        const itemId = searchParams.get('item')
        if (itemId && /^\d+$/.test(itemId)) {
            fetchDetail(Number(itemId))
            setSearchParams((p) => {
                p.delete('item')
                return p
            }, { replace: true })
        }
    }, [searchParams.get('item')])

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 300)
        return () => clearTimeout(t)
    }, [searchInput])

    useEffect(() => {
        setPage(1)
    }, [tab, tipoFilter, prioridadeFilter, scope, sortBy, sortDir, responsavelFilter])

    // â”€â”€ Helpers â”€â”€

    const formatDate = (d: string | null, options?: { showTimeIfToday?: boolean }) => {
        if (!d) return '—'
        const dt = new Date(d)
        const today = new Date()
        const isToday = dt.toDateString() === today.toDateString()
        if (options?.showTimeIfToday && isToday) {
            return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        }
        return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }

    const formatDateFull = (d: string | null) => {
        if (!d) return '—'
        return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Central</h1>
                    <p className="mt-0.5 text-sm text-surface-500">Inbox unificado de trabalho — OS, Chamados, Tarefas e mais</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" icon={<Clock className="h-4 w-4" />} onClick={() => { setForm(f => ({ ...f, tipo: 'lembrete' })); setShowCreate(true) }}>
                        Novo lembrete
                    </Button>
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setForm(f => ({ ...f, tipo: 'tarefa' })); setShowCreate(true) }}>Nova Tarefa</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="rounded-xl border border-default bg-surface-0 p-4 shadow-card transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-lg p-2 ${s.bg}`}><Icon className={`h-5 w-5 ${s.color}`} /></div>
                                <div><p className="text-xs text-surface-500">{s.label}</p><p className="text-xl font-bold text-surface-900">{s.value}</p></div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-1 rounded-lg bg-surface-100 p-1">
                        {tabs.map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-surface-0 text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
                                {t.label}
                                {t.key === 'atrasadas' && (summary.atrasadas ?? 0) > 0 && (
                                    <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                                        {summary.atrasadas}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-1 rounded-lg border border-default bg-surface-50 px-1 py-1">
                        <span className="px-2 py-1 text-xs text-surface-500 self-center">Escopo:</span>
                        <button
                            onClick={() => setScope('todas')}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${scope === 'todas' ? 'bg-brand-100 text-brand-700' : 'text-surface-600 hover:bg-surface-100'}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setScope('minhas')}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${scope === 'minhas' ? 'bg-brand-100 text-brand-700' : 'text-surface-600 hover:bg-surface-100'}`}
                        >
                            Só minhas
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                        <input value={searchInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)} placeholder="Buscar..."
                            className="w-full rounded-lg border border-default bg-surface-50 py-2 pl-10 pr-3 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <select value={tipoFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipoFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                        aria-label="Filtrar por tipo">
                        <option value="">Tipo</option>
                        {Object.entries(tipoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select value={prioridadeFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrioridadeFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                        aria-label="Filtrar por prioridade">
                        <option value="">Prioridade</option>
                        {Object.entries(prioridadeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select value={responsavelFilter === '' ? '' : responsavelFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setResponsavelFilter(e.target.value ? Number(e.target.value) : '')}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm min-w-[140px]"
                        aria-label="Filtrar por responsável">
                        <option value="">Responsável</option>
                        {users.map((u: any) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-1 rounded-lg border border-default bg-surface-50 px-2 py-1.5">
                        <select value={sortBy} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as 'due_at' | 'prioridade' | 'created_at')}
                            className="border-0 bg-transparent py-0 pr-5 text-sm focus:ring-0"
                            aria-label="Ordenar por">
                            <option value="due_at">Prazo</option>
                            <option value="prioridade">Prioridade</option>
                            <option value="created_at">Data criação</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                            className="p-1 text-surface-500 hover:text-surface-700"
                            title={sortDir === 'asc' ? 'Crescente (clique para decrescente)' : 'Decrescente (clique para crescente)'}
                            aria-label={sortDir === 'asc' ? 'Ordenação crescente' : 'Ordenação decrescente'}
                        >
                            {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    </div>
                ) : isError ? (
                    <div className="rounded-xl border border-default bg-surface-0 py-12 text-center">
                        <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
                        <p className="mt-2 text-sm text-surface-600">Erro ao carregar a lista.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-xl border border-default bg-surface-0 py-16 text-center">
                        <Inbox className="mx-auto h-12 w-12 text-surface-300" />
                        <p className="mt-3 text-sm text-surface-500">Nenhum item encontrado</p>
                        {hasPermission('central.create.task') && (
                            <Button variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>Criar primeira tarefa</Button>
                        )}
                    </div>
                ) : items.map((item: any) => {
                    const tipo = tipoConfig[tipoKey(item.tipo)] ?? tipoConfig.tarefa
                    const status = statusConfig[statusKey(item.status)] ?? statusConfig.aberto
                    const prio = prioridadeConfig[prioridadeKey(item.prioridade)] ?? prioridadeConfig.media
                    const TipoIcon = tipo.icon
                    const overdue = isOverdue(item)
                    const itemStatus = statusKey(item.status)

                    return (
                        <div key={item.id} onClick={() => fetchDetail(item.id)}
                            className={`group cursor-pointer rounded-xl border bg-surface-0 p-4 shadow-card transition-all hover:shadow-elevated hover:border-brand-200 ${overdue ? 'border-red-200 bg-red-50/30' : 'border-default'} ${prio.bg}`}>
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 rounded-lg p-2 ${tipo.color}`}>
                                    <TipoIcon className="h-4 w-4" />
                                </div>

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
                                        {item.due_at && (
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatDate(item.due_at, { showTimeIfToday: true })}
                                            </span>
                                        )}
                                        {item.responsavel && <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{item.responsavel.name}</span>}
                                        {(item.comments_count ?? 0) > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{item.comments_count}</span>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {itemStatus === 'aberto' && (
                                        <button onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: item.id, data: { status: 'em_andamento' } }) }}
                                            title="Iniciar" className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><Play className="h-4 w-4" /></button>
                                    )}
                                    {(itemStatus === 'aberto' || itemStatus === 'em_andamento') && (
                                        <button onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: item.id, data: { status: 'concluido' } }) }}
                                            title="Concluir" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle className="h-4 w-4" /></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {!isLoading && !isError && items.length > 0 && lastPage > 1 && (
                    <div className="flex items-center justify-center gap-2 py-4">
                        <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                            Anterior
                        </Button>
                        <span className="text-sm text-surface-500">
                            Página {currentPage} de {lastPage} ({total} itens)
                        </span>
                        <Button variant="outline" size="sm" disabled={currentPage >= lastPage} onClick={() => setPage(p => p + 1)}>
                            Próxima
                        </Button>
                    </div>
                )}
            </div>

            {/* Modal Criar */}
            <Modal open={showCreate} onOpenChange={(v) => { if (!v) setShowCreate(false) }} title={form.tipo === 'lembrete' ? 'Novo Lembrete' : 'Nova Tarefa'}>
                <div className="space-y-4">
                    <Input label="Título" value={form.titulo} onChange={(e: any) => setForm(f => ({ ...f, titulo: e.target.value }))} />
                    <Input label="Descrição" value={form.descricao_curta} onChange={(e: any) => setForm(f => ({ ...f, descricao_curta: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="central-form-tipo" className="text-sm font-medium text-surface-700">Tipo</label>
                            <select id="central-form-tipo" aria-label="Tipo do item" value={form.tipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, tipo: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-default px-3 py-2 text-sm">
                                <option value="tarefa">Tarefa</option>
                                <option value="lembrete">Lembrete</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="central-form-prioridade" className="text-sm font-medium text-surface-700">Prioridade</label>
                            <select id="central-form-prioridade" aria-label="Prioridade" value={form.prioridade} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, prioridade: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-default px-3 py-2 text-sm">
                                {Object.entries(prioridadeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="central-form-responsavel" className="text-sm font-medium text-surface-700">Responsável</label>
                        <select
                            id="central-form-responsavel"
                            aria-label="Responsável pela tarefa"
                            value={form.responsavel_user_id === '' ? '' : form.responsavel_user_id}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, responsavel_user_id: e.target.value ? Number(e.target.value) : '' }))}
                            className="mt-1 w-full rounded-lg border border-default px-3 py-2 text-sm"
                        >
                            <option value="">Eu</option>
                            {users.filter((u: any) => u.id !== authUser?.id).map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <p className="mt-0.5 text-xs text-surface-500">Atribua a um técnico ou deixe em &quot;Eu&quot; para lembrete próprio.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Prazo" type="datetime-local" value={form.due_at} onChange={(e: any) => setForm(f => ({ ...f, due_at: e.target.value }))} />
                        <Input label="Lembrete em" type="datetime-local" value={form.remind_at} onChange={(e: any) => setForm(f => ({ ...f, remind_at: e.target.value }))} />
                    </div>
                    <div>
                        <label htmlFor="central-form-visibilidade" className="text-sm font-medium text-surface-700">Visibilidade</label>
                        <select id="central-form-visibilidade" aria-label="Visibilidade" value={form.visibilidade} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, visibilidade: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-default px-3 py-2 text-sm">
                            <option value="privado">Privado</option>
                            <option value="equipe">Equipe</option>
                            <option value="empresa">Empresa</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                        <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.titulo.trim()}>Criar</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal Detalhes */}
            <Modal open={!!showDetail} onOpenChange={(v) => { if (!v) { setShowDetail(null); setShowSnoozePicker(false); setSnoozeCustomDate('') } }} title={showDetail?.titulo ?? 'Detalhes'}>
                {showDetail && (
                    <div className="space-y-4">
                        {sourceLink(showDetail.ref_tipo, showDetail.ref_id) && (
                            <Link
                                to={sourceLink(showDetail.ref_tipo, showDetail.ref_id)!}
                                className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Ver origem (OS / Chamado / Orçamento)
                            </Link>
                        )}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-surface-500">Status:</span> <Badge variant={statusConfig[statusKey(showDetail.status)]?.variant ?? 'default'}>{statusConfig[statusKey(showDetail.status)]?.label ?? showDetail.status}</Badge></div>
                            <div><span className="text-surface-500">Prioridade:</span> <span className={`font-medium ${prioridadeConfig[prioridadeKey(showDetail.prioridade)]?.color ?? ''}`}>{prioridadeConfig[prioridadeKey(showDetail.prioridade)]?.label ?? showDetail.prioridade}</span></div>
                            <div><span className="text-surface-500">Tipo:</span> {tipoConfig[tipoKey(showDetail.tipo)]?.label ?? showDetail.tipo}</div>
                            <div><span className="text-surface-500">Prazo:</span> {formatDateFull(showDetail.due_at)}</div>
                            {showDetail.remind_at && <div><span className="text-surface-500">Lembrete:</span> {formatDateFull(showDetail.remind_at)}</div>}
                            <div><span className="text-surface-500">Responsável:</span> {showDetail.responsavel?.name ?? '—'}</div>
                            <div><span className="text-surface-500">Criado em:</span> {formatDate(showDetail.created_at)}</div>
                        </div>

                        {showDetail.descricao_curta && (
                            <p className="text-sm text-surface-600 bg-surface-50 rounded-lg p-3">{showDetail.descricao_curta}</p>
                        )}

                        <div className="flex flex-wrap gap-2 border-t border-subtle pt-3">
                            {statusKey(showDetail.status) !== 'concluido' && statusKey(showDetail.status) !== 'cancelado' && (
                                <>
                                    <Button size="sm" variant="outline" icon={<CheckCircle className="h-4 w-4" />}
                                        onClick={() => { updateMut.mutate({ id: showDetail.id, data: { status: 'concluido' } }); setShowDetail(null) }}>
                                        Concluir
                                    </Button>
                                    <Button size="sm" variant="outline" icon={<CalendarClock className="h-4 w-4" />}
                                        onClick={() => {
                                            const d = new Date()
                                            d.setHours(d.getHours() + 1)
                                            updateMut.mutate(
                                                { id: showDetail.id, data: { snooze_until: d.toISOString() } },
                                                { onSuccess: () => fetchDetail(showDetail.id) }
                                            )
                                        }}
                                        title="Adiar 1 hora">
                                        Adiar 1h
                                    </Button>
                                    <Button size="sm" variant="outline"
                                        onClick={() => {
                                            const d = new Date()
                                            d.setDate(d.getDate() + 1)
                                            d.setHours(9, 0, 0, 0)
                                            updateMut.mutate(
                                                { id: showDetail.id, data: { snooze_until: d.toISOString() } },
                                                { onSuccess: () => fetchDetail(showDetail.id) }
                                            )
                                        }}
                                        title="Adiar para amanhã 9h">
                                        Amanhã
                                    </Button>
                                    <Button size="sm" variant="outline"
                                        onClick={() => {
                                            const d = new Date()
                                            d.setDate(d.getDate() + 7)
                                            d.setHours(9, 0, 0, 0)
                                            updateMut.mutate(
                                                { id: showDetail.id, data: { snooze_until: d.toISOString() } },
                                                { onSuccess: () => fetchDetail(showDetail.id) }
                                            )
                                        }}
                                        title="Adiar para daqui 7 dias, 9h">
                                        Próxima semana
                                    </Button>
                                    {showSnoozePicker ? (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <input
                                                type="datetime-local"
                                                value={snoozeCustomDate}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSnoozeCustomDate(e.target.value)}
                                                className="rounded-lg border border-default px-2 py-1 text-xs"
                                                aria-label="Data e hora para adiar"
                                            />
                                            <Button size="sm" variant="outline"
                                                disabled={!snoozeCustomDate}
                                                onClick={() => {
                                                    if (!snoozeCustomDate) return
                                                    const d = new Date(snoozeCustomDate)
                                                    updateMut.mutate(
                                                        { id: showDetail.id, data: { snooze_until: d.toISOString() } },
                                                        { onSuccess: () => { fetchDetail(showDetail.id); setShowSnoozePicker(false); setSnoozeCustomDate('') } }
                                                    )
                                                }}>
                                                Adiar
                                            </Button>
                                            <button type="button" onClick={() => { setShowSnoozePicker(false); setSnoozeCustomDate('') }} className="text-xs text-surface-500 hover:text-surface-700">
                                                Cancelar
                                            </button>
                                        </div>
                                    ) : (
                                        <Button size="sm" variant="outline"
                                            onClick={() => setShowSnoozePicker(true)}
                                            title="Escolher data e hora">
                                            Escolher data
                                        </Button>
                                    )}
                                </>
                            )}
                            <div className="flex-1" />
                            <select onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { if (e.target.value) assignMut.mutate({ id: showDetail.id, userId: +e.target.value }) }}
                                className="rounded-lg border border-default bg-surface-50 px-2 py-1.5 text-xs"
                                aria-label="Reatribuir responsável">
                                <option value="">Reatribuir...</option>
                                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>

                        <div className="border-t border-subtle pt-3">
                            <h4 className="text-sm font-semibold text-surface-700 mb-2">Comentários</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {(showDetail.comments ?? []).map((c: any) => (
                                    <div key={c.id} className="rounded-lg bg-surface-50 p-2">
                                        <p className="text-xs text-surface-900">{c.body}</p>
                                        <p className="text-xs text-surface-400 mt-1">{c.user?.name ?? 'Sistema'} • {formatDate(c.created_at)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                                <input value={comment} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComment(e.target.value)} placeholder="Adicionar comentário..."
                                    className="flex-1 rounded-lg border border-default px-3 py-2 text-sm" />
                                <Button size="sm" onClick={() => commentMut.mutate({ id: showDetail.id, body: comment })} loading={commentMut.isPending}
                                    disabled={!comment.trim()}>Enviar</Button>
                            </div>
                        </div>

                        {(showDetail.history ?? []).length > 0 && (
                            <div className="border-t border-subtle pt-3">
                                <h4 className="text-sm font-semibold text-surface-700 mb-2">Histórico</h4>
                                <div className="space-y-1 text-xs text-surface-500 max-h-32 overflow-y-auto">
                                    {(showDetail.history ?? []).map((h: any) => (
                                        <div key={h.id} className="flex gap-2">
                                            <span className="text-surface-400">{formatDate(h.created_at)}</span>
                                            <span>{h.action}: {h.from_value ?? ''} → {h.to_value ?? ''}</span>
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
