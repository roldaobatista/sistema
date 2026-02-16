import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search, ClipboardCheck, AlertTriangle, MessageSquare, ThumbsUp,
    ChevronLeft, ChevronRight, BarChart3, CheckCircle2, Clock,
    Plus, Pencil, Trash2, X, Wrench
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'

const tabs = ['procedures', 'actions', 'complaints', 'surveys', 'dashboard'] as const
type Tab = typeof tabs[number]
const tabLabels: Record<Tab, string> = {
    procedures: 'Procedimentos', actions: 'Ações Corretivas', complaints: 'Reclamações',
    surveys: 'Pesquisas NPS', dashboard: 'Dashboard'
}

type ModalEntity = 'procedure' | 'action' | 'complaint' | null

const emptyProcedure = { code: '', title: '', revision: 1, status: 'draft', next_review_date: '' }
const emptyAction = { type: 'corrective', nonconformity_description: '', root_cause: '', action_plan: '', deadline: '', status: 'open' }
const emptyComplaint = { description: '', severity: 'medium', status: 'open', resolution: '', response_due_at: '', responded_at: '' }

export default function QualityPage() {
    const { hasPermission } = useAuthStore()

    const [tab, setTab] = useState<Tab>('dashboard')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const queryClient = useQueryClient()

    // Modal state
    const [modalEntity, setModalEntity] = useState<ModalEntity>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [fromComplaintId, setFromComplaintId] = useState<number | null>(null)
    const [procForm, setProcForm] = useState(emptyProcedure)
    const [actionForm, setActionForm] = useState(emptyAction)
    const [complaintForm, setComplaintForm] = useState(emptyComplaint)

    const openCreate = (entity: ModalEntity) => {
        setEditingId(null)
        setFromComplaintId(null)
        if (entity === 'procedure') setProcForm(emptyProcedure)
        if (entity === 'action') setActionForm(emptyAction)
        if (entity === 'complaint') setComplaintForm(emptyComplaint)
        setModalEntity(entity)
    }

    const openActionFromComplaint = (c: any) => {
        setFromComplaintId(c.id)
        setEditingId(null)
        setActionForm({ ...emptyAction, nonconformity_description: c.description || '' })
        setModalEntity('action')
    }

    const openEdit = (entity: ModalEntity, item: any) => {
        setEditingId(item.id)
        if (entity === 'procedure') setProcForm({ code: item.code || '', title: item.title || '', revision: item.revision || 1, status: item.status || 'draft', next_review_date: item.next_review_date?.substring(0, 10) || '' })
        if (entity === 'action') setActionForm({ type: item.type || 'corrective', nonconformity_description: item.nonconformity_description || '', root_cause: item.root_cause || '', action_plan: item.action_plan || '', deadline: item.deadline?.substring(0, 10) || '', status: item.status || 'open' })
        if (entity === 'complaint') setComplaintForm({ description: item.description || '', severity: item.severity || 'medium', status: item.status || 'open', resolution: item.resolution || '', response_due_at: item.response_due_at?.toString().slice(0, 10) || '', responded_at: item.responded_at ? new Date(item.responded_at).toISOString().slice(0, 10) : '' })
        setModalEntity(entity)
    }

    // Mutations
    const saveProcedure = useMutation({
        mutationFn: (data: typeof procForm) => editingId ? api.put(`/quality/procedures/${editingId}`, data) : api.post('/quality/procedures', data),
        onSuccess: () => { toast.success(editingId ? 'Procedimento atualizado' : 'Procedimento criado'); setModalEntity(null); queryClient.invalidateQueries({ queryKey: ['quality-procedures'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar procedimento'),
    })

    const saveAction = useMutation({
        mutationFn: (data: typeof actionForm) => {
            if (fromComplaintId) {
                return api.post('/quality/corrective-actions', {
                    type: data.type,
                    source: 'complaint',
                    sourceable_type: 'App\\Models\\CustomerComplaint',
                    sourceable_id: fromComplaintId,
                    nonconformity_description: data.nonconformity_description,
                    root_cause: data.root_cause || undefined,
                    action_plan: data.action_plan || undefined,
                    deadline: data.deadline || undefined,
                })
            }
            return editingId ? api.put(`/quality/corrective-actions/${editingId}`, data) : api.post('/quality/corrective-actions', data)
        },
        onSuccess: () => { toast.success(editingId ? 'Ação atualizada' : 'Ação criada'); setModalEntity(null); setFromComplaintId(null); queryClient.invalidateQueries({ queryKey: ['quality-corrective-actions'] }); queryClient.invalidateQueries({ queryKey: ['quality-complaints'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar ação'),
    })

    const saveComplaint = useMutation({
        mutationFn: (data: typeof complaintForm) => editingId ? api.put(`/quality/complaints/${editingId}`, data) : api.post('/quality/complaints', data),
        onSuccess: () => { toast.success(editingId ? 'Reclamação atualizada' : 'Reclamação registrada'); setModalEntity(null); queryClient.invalidateQueries({ queryKey: ['quality-complaints'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar reclamação'),
    })

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }: { entity: string; id: number }) => api.delete(`/quality/${entity}/${id}`),
        onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['quality-procedures'] }); queryClient.invalidateQueries({ queryKey: ['quality-corrective-actions'] }); queryClient.invalidateQueries({ queryKey: ['quality-complaints'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover'),
    })
    const handleDelete = (entity: string, id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate({ entity, id }) }

    const { data: proceduresData, isLoading: loadingProc, isError: errorProc } = useQuery({
        queryKey: ['quality-procedures', search, page],
        queryFn: () => api.get('/quality/procedures', { params: { search: search || undefined, page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'procedures',
    })

    const { data: actionsData, isLoading: loadingActions, isError: errorActions } = useQuery({
        queryKey: ['quality-corrective-actions', page],
        queryFn: () => api.get('/quality/corrective-actions', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'actions',
    })

    const { data: complaintsData, isLoading: loadingComplaints } = useQuery({
        queryKey: ['quality-complaints', page],
        queryFn: () => api.get('/quality/complaints', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'complaints',
    })

    const { data: surveysData, isLoading: loadingSurveys } = useQuery({
        queryKey: ['quality-surveys', page],
        queryFn: () => api.get('/quality/surveys', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'surveys',
    })

    const { data: nps } = useQuery({
        queryKey: ['quality-nps'],
        queryFn: () => api.get('/quality/nps').then(r => r.data?.data),
        enabled: tab === 'dashboard',
    })

    const { data: dashboard } = useQuery({
        queryKey: ['quality-dashboard'],
        queryFn: () => api.get('/quality/dashboard').then(r => r.data?.data),
        enabled: tab === 'dashboard',
    })

    const procedures = proceduresData?.data ?? []
    const actions = actionsData?.data ?? []
    const complaints = complaintsData?.data ?? []
    const surveys = surveysData?.data ?? []

    useEffect(() => {
        if (errorProc) toast.error('Erro ao carregar procedimentos')
        if (errorActions) toast.error('Erro ao carregar ações corretivas')
    }, [errorProc, errorActions])

    return (
        <div className="space-y-5">
            <PageHeader title="Qualidade & SGQ" subtitle="Procedimentos, ações corretivas, NPS e satisfação" />

            <div className="flex gap-1 rounded-xl border border-default bg-surface-50 p-1">
                {tabs.map(t => (
                    <button key={t} onClick={() => { setTab(t); setPage(1) }}
                        className={cn('flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            tab === t ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                        )}>{tabLabels[t]}</button>
                ))}
            </div>

            {tab === 'procedures' && (
                <>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                            <input type="text" placeholder="Buscar procedimento..." value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1) }}
                                className="w-full rounded-lg border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                        </div>
                        <button onClick={() => openCreate('procedure')} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
                            <Plus size={16} /> Novo
                        </button>
                    </div>
                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-subtle bg-surface-50">
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Código</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Título</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Revisão</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Próxima Revisão</th>
                                <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>
                            </tr></thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingProc && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                                {!loadingProc && procedures.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhum procedimento</td></tr>}
                                {procedures.map((p: any) => (
                                    <tr key={p.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-600">{p.code}</td>
                                        <td className="px-4 py-3 font-medium text-surface-900">{p.title}</td>
                                        <td className="px-4 py-3 text-surface-600">Rev. {p.revision}</td>
                                        <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                            p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : p.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-600'
                                        )}>{p.status === 'active' ? 'Ativo' : p.status === 'draft' ? 'Rascunho' : 'Obsoleto'}</span></td>
                                        <td className="px-4 py-3 text-surface-600">{p.next_review_date ? new Date(p.next_review_date).toLocaleDateString('pt-BR') : '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEdit('procedure', p)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil size={14} /></button>
                                                <button onClick={() => handleDelete('procedures', p.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {tab === 'actions' && (
                <>
                    <div className="flex justify-end">
                        <button onClick={() => openCreate('action')} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
                            <Plus size={16} /> Nova Ação
                        </button>
                    </div>
                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-subtle bg-surface-50">
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Não Conformidade</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Responsável</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Prazo</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                                <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>
                            </tr></thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingActions && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                                {!loadingActions && actions.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhuma ação</td></tr>}
                                {actions.map((a: any) => (
                                    <tr key={a.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                            a.type === 'corrective' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        )}>{a.type === 'corrective' ? 'Corretiva' : 'Preventiva'}</span></td>
                                        <td className="px-4 py-3 max-w-[300px] truncate text-surface-800">{a.nonconformity_description}</td>
                                        <td className="px-4 py-3 text-surface-600">{a.responsible?.name ?? '—'}</td>
                                        <td className="px-4 py-3 text-surface-600">{a.deadline ? new Date(a.deadline).toLocaleDateString('pt-BR') : '—'}</td>
                                        <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                            a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : a.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                        )}>{a.status === 'completed' ? 'Concluída' : a.status === 'in_progress' ? 'Em Andamento' : 'Aberta'}</span></td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEdit('action', a)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil size={14} /></button>
                                                <button onClick={() => handleDelete('corrective-actions', a.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {tab === 'complaints' && (
                <>
                    <div className="flex justify-end">
                        <button onClick={() => openCreate('complaint')} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
                            <Plus size={16} /> Nova Reclamação
                        </button>
                    </div>
                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-subtle bg-surface-50">
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Cliente</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Descrição</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Severidade</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Prazo resposta</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                                <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>
                            </tr></thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingComplaints && <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                                {!loadingComplaints && complaints.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">Nenhuma reclamação</td></tr>}
                                {complaints.map((c: any) => (
                                    <tr key={c.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3 font-medium text-surface-900">{c.customer?.name ?? '—'}</td>
                                        <td className="px-4 py-3 max-w-[300px] truncate text-surface-700">{c.description}</td>
                                        <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                            c.severity === 'critical' ? 'bg-red-100 text-red-700' : c.severity === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-600'
                                        )}>{c.severity === 'critical' ? 'Crítica' : c.severity === 'high' ? 'Alta' : c.severity === 'medium' ? 'Média' : 'Baixa'}</span></td>
                                        <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                            c.status === 'resolved' || c.status === 'closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                        )}>{c.status === 'resolved' ? 'Resolvida' : c.status === 'closed' ? 'Fechada' : c.status === 'investigating' ? 'Investigando' : 'Aberta'}</span></td>
                                        <td className="px-4 py-3 text-surface-600">{c.response_due_at ? new Date(c.response_due_at).toLocaleDateString('pt-BR') : '—'}</td>
                                        <td className="px-4 py-3 text-surface-600">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openActionFromComplaint(c)} className="rounded-lg p-1.5 text-surface-400 hover:bg-brand-50 hover:text-brand-600" title="Abrir ação corretiva"><Wrench size={14} /></button>
                                                <button onClick={() => openEdit('complaint', c)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil size={14} /></button>
                                                <button onClick={() => handleDelete('complaints', c.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {tab === 'surveys' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Cliente</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">NPS</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Serviço</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Técnico</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Comentário</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingSurveys && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingSurveys && surveys.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhuma pesquisa</td></tr>}
                            {surveys.map((s: any) => (
                                <tr key={s.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{s.customer?.name ?? '—'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-1 text-xs font-bold',
                                        (s.nps_score ?? 0) >= 9 ? 'bg-emerald-100 text-emerald-700' : (s.nps_score ?? 0) >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                    )}>{s.nps_score ?? '—'}</span></td>
                                    <td className="px-4 py-3 text-surface-600">{'⭐'.repeat(s.service_rating ?? 0)}</td>
                                    <td className="px-4 py-3 text-surface-600">{'⭐'.repeat(s.technician_rating ?? 0)}</td>
                                    <td className="px-4 py-3 max-w-[250px] truncate text-surface-500">{s.comment ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'dashboard' && (
                <div className="space-y-5">
                    {nps && (
                        <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                            <h3 className="text-lg font-semibold text-surface-900 mb-4">Net Promoter Score</h3>
                            <div className="flex items-center gap-8">
                                <div className="text-center">
                                    <p className={cn('text-5xl font-bold', (nps.nps ?? 0) >= 50 ? 'text-emerald-600' : (nps.nps ?? 0) >= 0 ? 'text-amber-600' : 'text-red-600')}>{nps.nps ?? '—'}</p>
                                    <p className="text-sm text-surface-500 mt-1">NPS Score</p>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-surface-500 w-24">Promotores</span>
                                        <div className="flex-1 h-3 rounded-full bg-surface-100 overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${nps.total ? (nps.promoters / nps.total) * 100 : 0}%` }} />
                                        </div>
                                        <span className="text-xs font-medium text-surface-700 w-8">{nps.promoters}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-surface-500 w-24">Passivos</span>
                                        <div className="flex-1 h-3 rounded-full bg-surface-100 overflow-hidden">
                                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${nps.total ? (nps.passives / nps.total) * 100 : 0}%` }} />
                                        </div>
                                        <span className="text-xs font-medium text-surface-700 w-8">{nps.passives}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-surface-500 w-24">Detratores</span>
                                        <div className="flex-1 h-3 rounded-full bg-surface-100 overflow-hidden">
                                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${nps.total ? (nps.detractors / nps.total) * 100 : 0}%` }} />
                                        </div>
                                        <span className="text-xs font-medium text-surface-700 w-8">{nps.detractors}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {dashboard && (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-emerald-50 p-2"><ClipboardCheck size={20} className="text-emerald-600" /></div>
                                    <div><p className="text-2xl font-bold text-surface-900">{dashboard.active_procedures}</p><p className="text-xs text-surface-500">Procedimentos Ativos</p></div>
                                </div>
                            </div>
                            <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-card">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-red-100 p-2"><AlertTriangle size={20} className="text-red-600" /></div>
                                    <div><p className="text-2xl font-bold text-red-700">{dashboard.overdue_actions}</p><p className="text-xs text-red-600">Ações Vencidas</p></div>
                                </div>
                            </div>
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-card">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-amber-100 p-2"><MessageSquare size={20} className="text-amber-600" /></div>
                                    <div><p className="text-2xl font-bold text-amber-700">{dashboard.open_complaints}</p><p className="text-xs text-amber-600">Reclamações Abertas</p></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {modalEntity === 'procedure' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalEntity(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">{editingId ? 'Editar Procedimento' : 'Novo Procedimento'}</h3>
                            <button onClick={() => setModalEntity(null)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveProcedure.mutate(procForm) }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Código *</label>
                                    <input required value={procForm.code} onChange={e => setProcForm({ ...procForm, code: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="PQ-001" /></div>
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Revisão</label>
                                    <input type="number" min={1} value={procForm.revision} onChange={e => setProcForm({ ...procForm, revision: Number(e.target.value) })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Título *</label>
                                <input required value={procForm.title} onChange={e => setProcForm({ ...procForm, title: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Procedimento de calibração" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Status</label>
                                    <select value={procForm.status} onChange={e => setProcForm({ ...procForm, status: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="draft">Rascunho</option><option value="active">Ativo</option><option value="obsolete">Obsoleto</option>
                                    </select></div>
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Próxima Revisão</label>
                                    <input type="date" value={procForm.next_review_date} onChange={e => setProcForm({ ...procForm, next_review_date: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setModalEntity(null)} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancelar</button>
                                <button type="submit" disabled={saveProcedure.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saveProcedure.isPending ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalEntity === 'action' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalEntity(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">{editingId ? 'Editar Ação' : 'Nova Ação Corretiva/Preventiva'}</h3>
                            <button onClick={() => setModalEntity(null)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveAction.mutate(actionForm) }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Tipo</label>
                                    <select value={actionForm.type} onChange={e => setActionForm({ ...actionForm, type: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="corrective">Corretiva</option><option value="preventive">Preventiva</option>
                                    </select></div>
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Status</label>
                                    <select value={actionForm.status} onChange={e => setActionForm({ ...actionForm, status: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="open">Aberta</option><option value="in_progress">Em Andamento</option><option value="completed">Concluída</option>
                                    </select></div>
                            </div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Não Conformidade *</label>
                                <textarea required rows={2} value={actionForm.nonconformity_description} onChange={e => setActionForm({ ...actionForm, nonconformity_description: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Descreva a não conformidade..." /></div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Causa Raiz</label>
                                <textarea rows={2} value={actionForm.root_cause} onChange={e => setActionForm({ ...actionForm, root_cause: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Análise da causa raiz..." /></div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Plano de Ação</label>
                                <textarea rows={2} value={actionForm.action_plan} onChange={e => setActionForm({ ...actionForm, action_plan: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Ações a serem tomadas..." /></div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Prazo</label>
                                <input type="date" value={actionForm.deadline} onChange={e => setActionForm({ ...actionForm, deadline: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setModalEntity(null)} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancelar</button>
                                <button type="submit" disabled={saveAction.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saveAction.isPending ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalEntity === 'complaint' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalEntity(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">{editingId ? 'Editar Reclamação' : 'Nova Reclamação'}</h3>
                            <button onClick={() => setModalEntity(null)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveComplaint.mutate(complaintForm) }} className="space-y-4">
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Descrição *</label>
                                <textarea required rows={3} value={complaintForm.description} onChange={e => setComplaintForm({ ...complaintForm, description: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Descreva a reclamação..." /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Severidade</label>
                                    <select value={complaintForm.severity} onChange={e => setComplaintForm({ ...complaintForm, severity: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option>
                                    </select></div>
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Status</label>
                                    <select value={complaintForm.status} onChange={e => setComplaintForm({ ...complaintForm, status: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="open">Aberta</option><option value="investigating">Investigando</option><option value="resolved">Resolvida</option><option value="closed">Fechada</option>
                                    </select></div>
                            </div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Resolução</label>
                                <textarea rows={2} value={complaintForm.resolution} onChange={e => setComplaintForm({ ...complaintForm, resolution: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Resolução adotada..." /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Prazo para resposta</label>
                                    <input type="date" value={complaintForm.response_due_at} onChange={e => setComplaintForm({ ...complaintForm, response_due_at: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div>
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Respondido em</label>
                                    <input type="date" value={complaintForm.responded_at} onChange={e => setComplaintForm({ ...complaintForm, responded_at: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setModalEntity(null)} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancelar</button>
                                <button type="submit" disabled={saveComplaint.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saveComplaint.isPending ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
