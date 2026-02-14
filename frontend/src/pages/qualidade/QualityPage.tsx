import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import {
    Search, ClipboardCheck, AlertTriangle, MessageSquare, ThumbsUp,
    ChevronLeft, ChevronRight, BarChart3, CheckCircle2, Clock
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'

const tabs = ['procedures', 'actions', 'complaints', 'surveys', 'dashboard'] as const
type Tab = typeof tabs[number]
const tabLabels: Record<Tab, string> = {
    procedures: 'Procedimentos', actions: 'Ações Corretivas', complaints: 'Reclamações',
    surveys: 'Pesquisas NPS', dashboard: 'Dashboard'
}

export default function QualityPage() {
    const [tab, setTab] = useState<Tab>('dashboard')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')

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
            <PageHeader title="Qualidade & SGQ" subtitle="Procedimentos ISO, ações corretivas, NPS e satisfação" />

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
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input type="text" placeholder="Buscar procedimento..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="w-full rounded-lg border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                    </div>
                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-subtle bg-surface-50">
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Código</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Título</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Revisão</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Próxima Revisão</th>
                            </tr></thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingProc && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                                {!loadingProc && procedures.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhum procedimento</td></tr>}
                                {procedures.map((p: any) => (
                                    <tr key={p.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-600">{p.code}</td>
                                        <td className="px-4 py-3 font-medium text-surface-900">{p.title}</td>
                                        <td className="px-4 py-3 text-surface-600">Rev. {p.revision}</td>
                                        <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                            p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : p.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-600'
                                        )}>{p.status === 'active' ? 'Ativo' : p.status === 'draft' ? 'Rascunho' : 'Obsoleto'}</span></td>
                                        <td className="px-4 py-3 text-surface-600">{p.next_review_date ? new Date(p.next_review_date).toLocaleDateString('pt-BR') : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {tab === 'actions' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Não Conformidade</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Responsável</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Prazo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingActions && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingActions && actions.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhuma ação</td></tr>}
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'complaints' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Cliente</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Descrição</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Severidade</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingComplaints && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingComplaints && complaints.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhuma reclamação</td></tr>}
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
                                    <td className="px-4 py-3 text-surface-600">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
                    {/* NPS Card */}
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

                    {/* KPIs */}
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
        </div>
    )
}
