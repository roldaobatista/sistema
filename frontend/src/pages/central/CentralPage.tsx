import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Inbox, Plus, Search, CheckCircle, Clock, AlertTriangle,
    MessageSquare, UserCheck, Play, Flag, Calendar,
    FileText, Phone, DollarSign, Wrench, BarChart3, ExternalLink, CalendarClock,
    ArrowUp, ArrowDown, LayoutGrid, Download, X, Trash2,
    Paperclip, Upload, ListChecks, Bookmark, Star, Timer, Tag, Repeat, Link2, AtSign, CalendarDays,
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

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const toggleSelect = (id: number) => setSelectedIds(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
    })
    const toggleAll = () => {
        if (selectedIds.size === items.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(items.map((i: any) => i.id)))
    }

    // Inline editing
    const [editingId, setEditingId] = useState<number | null>(null)

    // Subtask input
    const [newSubtask, setNewSubtask] = useState('')
    const [editTitle, setEditTitle] = useState('')

    // Saved filter presets
    type FilterPreset = { name: string; tab: string; tipo: string; prioridade: string; scope: string; responsavel: number | ''; sortBy: string; sortDir: string }
    const PRESETS_KEY = 'central-filter-presets'
    const loadPresets = (): FilterPreset[] => { try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]') } catch { return [] } }
    const [savedPresets, setSavedPresets] = useState<FilterPreset[]>(loadPresets)
    const [showSavePreset, setShowSavePreset] = useState(false)
    const [presetName, setPresetName] = useState('')
    const savePreset = () => {
        if (!presetName.trim()) return
        const preset: FilterPreset = { name: presetName.trim(), tab, tipo: tipoFilter, prioridade: prioridadeFilter, scope, responsavel: responsavelFilter, sortBy, sortDir }
        const updated = [...savedPresets.filter(p => p.name !== preset.name), preset]
        localStorage.setItem(PRESETS_KEY, JSON.stringify(updated))
        setSavedPresets(updated); setPresetName(''); setShowSavePreset(false)
    }
    const applyPreset = (p: FilterPreset) => {
        setTab(p.tab); setTipoFilter(p.tipo); setPrioridadeFilter(p.prioridade)
        setScope(p.scope as 'todas' | 'minhas'); setResponsavelFilter(p.responsavel)
        setSortBy(p.sortBy as 'due_at' | 'prioridade' | 'created_at'); setSortDir(p.sortDir as 'asc' | 'desc')
    }
    const deletePreset = (name: string) => {
        const updated = savedPresets.filter(p => p.name !== name)
        localStorage.setItem(PRESETS_KEY, JSON.stringify(updated))
        setSavedPresets(updated)
    }

    // Form state
    const [form, setForm] = useState({
        titulo: '', descricao_curta: '', tipo: 'tarefa',
        prioridade: 'media', due_at: '', visibilidade: 'equipe',
        responsavel_user_id: '' as number | '',
        remind_at: '', tags: '' as string,
        recurrence_pattern: '' as string,
        recurrence_interval: 1,
        escalation_hours: '' as number | '',
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
            tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            recurrence_pattern: form.recurrence_pattern || undefined,
            recurrence_interval: form.recurrence_pattern ? form.recurrence_interval : undefined,
            escalation_hours: form.escalation_hours || undefined,
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

    const bulkMut = useMutation({
        mutationFn: (payload: { ids: number[]; action: string; value?: string }) =>
            api.post('/central/items/bulk-update', payload),
        onSuccess: () => {
            toast.success('Ação em massa realizada')
            setSelectedIds(new Set())
            qc.invalidateQueries({ queryKey: ['central-items'] })
            qc.invalidateQueries({ queryKey: ['central-summary'] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro na ação em massa'),
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

    const addSubtaskMut = useMutation({
        mutationFn: ({ itemId, titulo }: { itemId: number; titulo: string }) =>
            api.post(`/central/items/${itemId}/subtasks`, { titulo }),
        onSuccess: (_d, vars) => { setNewSubtask(''); fetchDetail(vars.itemId) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao adicionar subtarefa'),
    })

    const toggleSubtaskMut = useMutation({
        mutationFn: ({ itemId, subtaskId, concluido }: { itemId: number; subtaskId: number; concluido: boolean }) =>
            api.patch(`/central/items/${itemId}/subtasks/${subtaskId}`, { concluido }),
        onSuccess: (_d, vars) => fetchDetail(vars.itemId),
    })

    const deleteSubtaskMut = useMutation({
        mutationFn: ({ itemId, subtaskId }: { itemId: number; subtaskId: number }) =>
            api.delete(`/central/items/${itemId}/subtasks/${subtaskId}`),
        onSuccess: (_d, vars) => fetchDetail(vars.itemId),
    })

    const uploadAttachMut = useMutation({
        mutationFn: ({ itemId, file }: { itemId: number; file: File }) => {
            const fd = new FormData(); fd.append('file', file)
            return api.post(`/central/items/${itemId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        },
        onSuccess: (_d, vars) => { toast.success('Arquivo anexado'); fetchDetail(vars.itemId) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao anexar arquivo'),
    })

    const deleteAttachMut = useMutation({
        mutationFn: ({ itemId, attachId }: { itemId: number; attachId: number }) =>
            api.delete(`/central/items/${itemId}/attachments/${attachId}`),
        onSuccess: (_d, vars) => { toast.success('Anexo removido'); fetchDetail(vars.itemId) },
    })

    const startTimerMut = useMutation({
        mutationFn: (itemId: number) => api.post(`/central/items/${itemId}/timer/start`),
        onSuccess: (_d, itemId) => { toast.success('Timer iniciado'); fetchDetail(itemId) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao iniciar timer'),
    })

    const stopTimerMut = useMutation({
        mutationFn: (itemId: number) => api.post(`/central/items/${itemId}/timer/stop`),
        onSuccess: (_d, itemId) => { toast.success('Timer parado'); fetchDetail(itemId) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao parar timer'),
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
                    <Link to="/central/kanban">
                        <Button variant="outline" icon={<LayoutGrid className="h-4 w-4" />}>Kanban</Button>
                    </Link>
                    <Button icon={<Download className="h-4 w-4" />} variant="outline"
                        onClick={() => { window.open(`${api.defaults.baseURL}/central/items-export?${new URLSearchParams({ search: search || '', aba: tab !== 'todas' ? tab : '', tipo: tipoFilter || '', prioridade: prioridadeFilter || '' }).toString()}`, '_blank') }}>
                        Exportar
                    </Button>
                    <Button icon={<CalendarDays className="h-4 w-4" />} variant="outline"
                        onClick={() => { window.open(`${api.defaults.baseURL}/central/ical-feed`, '_blank') }}
                        title="Download agenda iCal (.ics)">
                        iCal
                    </Button>
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

            {/* Mini Distribution Chart */}
            {(summary.total ?? 0) > 0 && (() => {
                const total = summary.total ?? 1
                const concluidas = (summary.concluidas ?? 0)
                const atrasadas = (summary.atrasadas ?? 0)
                const abertas = (summary.abertas ?? 0) - atrasadas
                const pctConcl = Math.round((concluidas / total) * 100)
                const pctAbert = Math.round((abertas / total) * 100)
                const pctAtras = Math.round((atrasadas / total) * 100)
                return (
                    <div className="rounded-xl border border-default bg-surface-0 p-3 shadow-card">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-surface-600">Distribuição</span>
                            <span className="text-xs text-surface-400">{total} itens total</span>
                        </div>
                        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-100">
                            {pctConcl > 0 && <div className="bg-emerald-500 transition-all" title={`${pctConcl}% concluídas`} aria-label={`${pctConcl}% concluídas`} role="img" style={{ width: `${pctConcl}%` }} />}
                            {pctAbert > 0 && <div className="bg-blue-400 transition-all" title={`${pctAbert}% abertas`} aria-label={`${pctAbert}% abertas`} role="img" style={{ width: `${pctAbert}%` }} />}
                            {pctAtras > 0 && <div className="bg-red-500 transition-all" title={`${pctAtras}% atrasadas`} aria-label={`${pctAtras}% atrasadas`} role="img" style={{ width: `${pctAtras}%` }} />}
                        </div>
                        <div className="flex gap-4 mt-1.5 text-[10px] text-surface-500">
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{pctConcl}% Concluídas</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" />{pctAbert}% Abertas</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />{pctAtras}% Atrasadas</span>
                        </div>
                    </div>
                )
            })()}

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

                    {/* Saved Presets */}
                    <div className="flex items-center gap-1 flex-wrap">
                        {savedPresets.map(p => (
                            <div key={p.name} className="group relative">
                                <button onClick={() => applyPreset(p)}
                                    className="flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors">
                                    <Star className="h-3 w-3" />{p.name}
                                </button>
                                <button onClick={() => deletePreset(p.name)}
                                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex text-[10px]" aria-label={`Remover filtro ${p.name}`}>
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </div>
                        ))}
                        {showSavePreset ? (
                            <div className="flex items-center gap-1">
                                <input value={presetName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPresetName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setShowSavePreset(false) }}
                                    placeholder="Nome do filtro..." autoFocus aria-label="Nome do filtro salvo"
                                    className="rounded-lg border border-default px-2 py-1 text-xs w-28" />
                                <Button size="sm" variant="outline" onClick={savePreset} disabled={!presetName.trim()}>
                                    <Bookmark className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <button onClick={() => setShowSavePreset(true)} title="Salvar filtros atuais"
                                className="rounded-lg border border-dashed border-surface-300 px-2 py-1.5 text-xs text-surface-400 hover:border-brand-300 hover:text-brand-500 transition-colors">
                                <Bookmark className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
                    <span className="text-sm font-medium text-brand-700">{selectedIds.size} selecionado(s)</span>
                    <div className="ml-auto flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => bulkMut.mutate({ ids: [...selectedIds], action: 'complete' })}>
                            <CheckCircle className="mr-1 h-3.5 w-3.5" /> Concluir
                        </Button>
                        <select className="rounded-lg border border-default bg-surface-0 px-2 py-1 text-xs"
                            onChange={(e) => { if (e.target.value) bulkMut.mutate({ ids: [...selectedIds], action: 'set_status', value: e.target.value }); e.target.value = '' }}
                            defaultValue="" aria-label="Alterar status em massa">
                            <option value="" disabled>Status...</option>
                            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select className="rounded-lg border border-default bg-surface-0 px-2 py-1 text-xs"
                            onChange={(e) => { if (e.target.value) bulkMut.mutate({ ids: [...selectedIds], action: 'set_priority', value: e.target.value }); e.target.value = '' }}
                            defaultValue="" aria-label="Alterar prioridade em massa">
                            <option value="" disabled>Prioridade...</option>
                            {Object.entries(prioridadeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select className="rounded-lg border border-default bg-surface-0 px-2 py-1 text-xs min-w-[120px]"
                            onChange={(e) => { if (e.target.value) bulkMut.mutate({ ids: [...selectedIds], action: 'assign', value: e.target.value }); e.target.value = '' }}
                            defaultValue="" aria-label="Atribuir em massa">
                            <option value="" disabled>Atribuir...</option>
                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => bulkMut.mutate({ ids: [...selectedIds], action: 'cancel' })}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Cancelar
                        </Button>
                        <button onClick={() => setSelectedIds(new Set())} className="p-1 text-surface-400 hover:text-surface-600" aria-label="Limpar seleção">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {/* Select all checkbox */}
                {!isLoading && !isError && items.length > 0 && (
                    <label className="flex items-center gap-2 px-1 py-1 text-xs text-surface-500 cursor-pointer select-none">
                        <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0}
                            onChange={toggleAll} className="rounded border-surface-300" />
                        Selecionar todos
                    </label>
                )}
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
                        <div key={item.id}
                            className={`group cursor-pointer rounded-xl border bg-surface-0 p-4 shadow-card transition-all hover:shadow-elevated hover:border-brand-200 ${overdue ? 'border-red-200 bg-red-50/30' : 'border-default'} ${prio.bg} ${selectedIds.has(item.id) ? 'ring-2 ring-brand-400' : ''}`}>
                            <div className="flex items-start gap-3">
                                <input type="checkbox" checked={selectedIds.has(item.id)}
                                    onChange={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`Selecionar ${item.titulo}`}
                                    className="mt-1.5 rounded border-surface-300 cursor-pointer" />
                                <div className={`mt-0.5 rounded-lg p-2 ${tipo.color}`} onClick={() => fetchDetail(item.id)}>
                                    <TipoIcon className="h-4 w-4" />
                                </div>

                                <div className="flex-1 min-w-0" onClick={() => fetchDetail(item.id)}>
                                    <div className="flex items-center gap-2">
                                        {editingId === item.id ? (
                                            <input autoFocus value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                onBlur={() => { if (editTitle.trim() && editTitle !== item.titulo) updateMut.mutate({ id: item.id, data: { titulo: editTitle } }); setEditingId(null) }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingId(null) }}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label="Editar título"
                                                className="flex-1 rounded border border-brand-300 bg-surface-0 px-2 py-0.5 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                                        ) : (
                                            <h3 className="text-sm font-semibold text-surface-900 truncate"
                                                onDoubleClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditTitle(item.titulo) }}>{item.titulo}</h3>
                                        )}
                                        <Badge variant={status.variant}>{status.label}</Badge>
                                        {overdue && <Badge variant="danger">Atrasado</Badge>}
                                    </div>
                                    {item.descricao_curta && (
                                        <p className="mt-0.5 text-xs text-surface-500 truncate">{item.descricao_curta}</p>
                                    )}
                                    {(item.tags ?? []).length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {(item.tags as string[]).map((t: string) => (
                                                <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                                                    <Tag className="h-2.5 w-2.5" />{t}
                                                </span>
                                            ))}
                                        </div>
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
                                        {item.recurrence_pattern && (
                                            <span className="flex items-center gap-1 text-brand-500"><Repeat className="h-3 w-3" />{item.recurrence_pattern === 'daily' ? 'Diária' : item.recurrence_pattern === 'weekly' ? 'Semanal' : 'Mensal'}</span>
                                        )}
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
                    <Input label="Tags (separadas por vírgula)" value={form.tags} onChange={(e: any) => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="ex: urgente, financeiro, TI" />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="central-form-recurrence" className="text-sm font-medium text-surface-700">Recorrência</label>
                            <select id="central-form-recurrence" aria-label="Padrão de recorrência" value={form.recurrence_pattern}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, recurrence_pattern: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-default px-3 py-2 text-sm">
                                <option value="">Nenhuma</option>
                                <option value="daily">Diária</option>
                                <option value="weekly">Semanal</option>
                                <option value="monthly">Mensal</option>
                            </select>
                        </div>
                        {form.recurrence_pattern && (
                            <Input label="Intervalo" type="number" min={1} value={form.recurrence_interval}
                                onChange={(e: any) => setForm(f => ({ ...f, recurrence_interval: parseInt(e.target.value) || 1 }))} />
                        )}
                    </div>
                    <Input label="Auto-Escalação (horas sem ação)" type="number" min={1}
                        value={form.escalation_hours === '' ? '' : form.escalation_hours}
                        onChange={(e: any) => setForm(f => ({ ...f, escalation_hours: e.target.value ? parseInt(e.target.value) : '' }))}
                        placeholder="ex: 24 (escala prioridade após 24h)" />
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

                        {/* Subtarefas / Checklist */}
                        <div className="border-t border-subtle pt-3">
                            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-surface-700 mb-2">
                                <ListChecks className="h-4 w-4" /> Subtarefas
                                {(showDetail.subtasks ?? []).length > 0 && (
                                    <span className="text-xs font-normal text-surface-400">
                                        ({(showDetail.subtasks ?? []).filter((s: any) => s.concluido).length}/{(showDetail.subtasks ?? []).length})
                                    </span>
                                )}
                            </h4>
                            {(showDetail.subtasks ?? []).length > 0 && (
                                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-100">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${Math.round(((showDetail.subtasks ?? []).filter((s: any) => s.concluido).length / (showDetail.subtasks ?? []).length) * 100)}%` }} />
                                </div>
                            )}
                            <div className="space-y-1">
                                {(showDetail.subtasks ?? []).map((sub: any) => (
                                    <div key={sub.id} className="group flex items-center gap-2">
                                        <input type="checkbox" checked={sub.concluido}
                                            onChange={() => toggleSubtaskMut.mutate({ itemId: showDetail.id, subtaskId: sub.id, concluido: !sub.concluido })}
                                            aria-label={`Marcar ${sub.titulo}`}
                                            className="rounded border-surface-300" />
                                        <span className={`flex-1 text-sm ${sub.concluido ? 'line-through text-surface-400' : 'text-surface-700'}`}>{sub.titulo}</span>
                                        <button onClick={() => deleteSubtaskMut.mutate({ itemId: showDetail.id, subtaskId: sub.id })}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 text-surface-300 hover:text-red-500 transition-opacity" aria-label="Remover subtarefa">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                                <input value={newSubtask} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSubtask(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && newSubtask.trim()) addSubtaskMut.mutate({ itemId: showDetail.id, titulo: newSubtask }) }}
                                    placeholder="Nova subtarefa..." aria-label="Nova subtarefa"
                                    className="flex-1 rounded-lg border border-default px-3 py-1.5 text-sm" />
                                <Button size="sm" variant="outline" disabled={!newSubtask.trim()}
                                    onClick={() => addSubtaskMut.mutate({ itemId: showDetail.id, titulo: newSubtask })}>
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Anexos */}
                        <div className="border-t border-subtle pt-3">
                            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-surface-700 mb-2">
                                <Paperclip className="h-4 w-4" /> Anexos
                                {(showDetail.attachments ?? []).length > 0 && (
                                    <span className="text-xs font-normal text-surface-400">({(showDetail.attachments ?? []).length})</span>
                                )}
                            </h4>
                            <div className="space-y-1">
                                {(showDetail.attachments ?? []).map((att: any) => (
                                    <div key={att.id} className="group flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-1.5">
                                        <FileText className="h-4 w-4 text-surface-400 flex-shrink-0" />
                                        <a href={`/storage/${att.path}`} target="_blank" rel="noreferrer"
                                            className="flex-1 text-sm text-brand-600 hover:underline truncate">{att.nome}</a>
                                        <span className="text-xs text-surface-400">{att.uploader?.name}</span>
                                        <span className="text-xs text-surface-300">{att.size ? `${(att.size / 1024).toFixed(0)} KB` : ''}</span>
                                        <button onClick={() => deleteAttachMut.mutate({ itemId: showDetail.id, attachId: att.id })}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 text-surface-300 hover:text-red-500 transition-opacity" aria-label="Remover anexo">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-surface-200 px-4 py-3 text-sm text-surface-500 hover:border-brand-300 hover:text-brand-600 transition-colors">
                                <Upload className="h-4 w-4" />
                                Clique para anexar arquivo
                                <input type="file" className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachMut.mutate({ itemId: showDetail.id, file: f }); e.target.value = '' }} />
                            </label>
                        </div>

                        {/* Timer / Tempo Gasto */}
                        <div className="border-t border-subtle pt-3">
                            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-surface-700 mb-2">
                                <Timer className="h-4 w-4" /> Tempo Gasto
                            </h4>
                            {(() => {
                                const entries = showDetail.time_entries ?? []
                                const runningEntry = entries.find((e: any) => !e.stopped_at)
                                const totalSeconds = entries.reduce((acc: number, e: any) => acc + (e.duration_seconds || 0), 0)
                                const fmt = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m` }
                                return (
                                    <>
                                        <div className="flex items-center gap-2 mb-2">
                                            {runningEntry ? (
                                                <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                                                    onClick={() => stopTimerMut.mutate(showDetail.id)}>
                                                    <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse mr-1.5" /> Parar
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                                    onClick={() => startTimerMut.mutate(showDetail.id)}>
                                                    <Play className="h-3.5 w-3.5 mr-1" /> Iniciar
                                                </Button>
                                            )}
                                            {totalSeconds > 0 && (
                                                <span className="text-xs text-surface-500">Total: <strong>{fmt(totalSeconds)}</strong></span>
                                            )}
                                        </div>
                                        {entries.length > 0 && (
                                            <div className="space-y-1 max-h-24 overflow-y-auto">
                                                {entries.map((e: any) => (
                                                    <div key={e.id} className="flex items-center gap-2 text-xs text-surface-500">
                                                        <span>{e.user?.name}</span>
                                                        <span className="text-surface-300">•</span>
                                                        <span>{e.stopped_at ? fmt(e.duration_seconds) : 'Em andamento...'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )
                            })()}
                        </div>

                        {/* Dependências */}
                        <div className="border-t border-subtle pt-3">
                            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-surface-700 mb-2">
                                <Link2 className="h-4 w-4" /> Dependências
                            </h4>
                            {(showDetail.depends_on ?? []).length > 0 && (
                                <div className="space-y-1 mb-2">
                                    {(showDetail.depends_on as any[]).map((dep: any) => (
                                        <div key={dep.id} className="group flex items-center gap-2 text-xs">
                                            <Link2 className="h-3 w-3 text-surface-400" />
                                            <span className={dep.status === 'concluido' ? 'line-through text-surface-400' : 'text-surface-700'}>{dep.titulo}</span>
                                            <Badge variant={dep.status === 'concluido' ? 'success' : 'default'}>{dep.status}</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-surface-400">Use a API para adicionar dependências entre itens.</p>
                        </div>

                        <div className="border-t border-subtle pt-3">
                            <h4 className="text-sm font-semibold text-surface-700 mb-2">Comentários</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {(showDetail.comments ?? []).map((c: any) => (
                                    <div key={c.id} className="rounded-lg bg-surface-50 p-2">
                                        <p className="text-xs text-surface-900">
                                            {c.body.split(/(@\w+)/g).map((part: string, i: number) =>
                                                part.startsWith('@') ? <span key={i} className="font-semibold text-brand-600">{part}</span> : part
                                            )}
                                        </p>
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
