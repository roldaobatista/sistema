import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search, Plus, Star, DollarSign, FileText, MapPin, Tag,
    ChevronLeft, ChevronRight, CalendarClock, UserCheck, BookOpen,
    Pencil, Trash2, X
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'

const tabs = ['followups', 'price-tables', 'documents', 'cost-centers', 'routes', 'ratings'] as const
type Tab = typeof tabs[number]
const tabLabels: Record<Tab, string> = {
    followups: 'Follow-ups', 'price-tables': 'Tabelas de Preco', documents: 'Documentos',
    'cost-centers': 'Centros de Custo', routes: 'Rotas', ratings: 'Avaliacoes OS'
}

type ModalType = 'followup' | 'price-table' | 'cost-center' | null
const emptyFollowup = { type: 'call', scheduled_at: '', notes: '', status: 'pending' }
const emptyPriceTable = { name: '', type: 'markup', modifier_percent: 0, valid_until: '', is_active: true }
const emptyCostCenter = { code: '', name: '', is_active: true }

export default function AdvancedFeaturesPage() {
    const { hasPermission } = useAuthStore()

    const [tab, setTab] = useState<Tab>('followups')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const queryClient = useQueryClient()

    // Modal state
    const [modalType, setModalType] = useState<ModalType>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [followupForm, setFollowupForm] = useState(emptyFollowup)
    const [priceTableForm, setPriceTableForm] = useState(emptyPriceTable)
    const [costCenterForm, setCostCenterForm] = useState(emptyCostCenter)

    const openCreate = (type: ModalType) => {
        setEditingId(null)
        if (type === 'followup') setFollowupForm(emptyFollowup)
        if (type === 'price-table') setPriceTableForm(emptyPriceTable)
        if (type === 'cost-center') setCostCenterForm(emptyCostCenter)
        setModalType(type)
    }

    const openEditFollowup = (item: any) => { setEditingId(item.id); setFollowupForm({ type: item.type || 'call', scheduled_at: item.scheduled_at?.substring(0, 16) || '', notes: item.notes || '', status: item.status || 'pending' }); setModalType('followup') }
    const openEditPriceTable = (item: any) => { setEditingId(item.id); setPriceTableForm({ name: item.name || '', type: item.type || 'markup', modifier_percent: item.modifier_percent ?? 0, valid_until: item.valid_until?.substring(0, 10) || '', is_active: item.is_active ?? true }); setModalType('price-table') }
    const openEditCostCenter = (item: any) => { setEditingId(item.id); setCostCenterForm({ code: item.code || '', name: item.name || '', is_active: item.is_active ?? true }); setModalType('cost-center') }

    const saveFollowup = useMutation({
        mutationFn: (data: typeof followupForm) => editingId ? api.put(`/advanced/follow-ups/${editingId}`, data) : api.post('/advanced/follow-ups', data),
        onSuccess: () => { toast.success(editingId ? 'Follow-up atualizado' : 'Follow-up criado'); setModalType(null); queryClient.invalidateQueries({ queryKey: ['followups'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar'),
    })

    const savePriceTable = useMutation({
        mutationFn: (data: typeof priceTableForm) => editingId ? api.put(`/advanced/price-tables/${editingId}`, data) : api.post('/advanced/price-tables', data),
        onSuccess: () => { toast.success(editingId ? 'Tabela atualizada' : 'Tabela criada'); setModalType(null); queryClient.invalidateQueries({ queryKey: ['price-tables'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar'),
    })

    const saveCostCenter = useMutation({
        mutationFn: (data: typeof costCenterForm) => editingId ? api.put(`/advanced/cost-centers/${editingId}`, data) : api.post('/advanced/cost-centers', data),
        onSuccess: () => { toast.success(editingId ? 'Centro de custo atualizado' : 'Centro de custo criado'); setModalType(null); queryClient.invalidateQueries({ queryKey: ['cost-centers'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar'),
    })

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }: { entity: string; id: number }) => api.delete(`/advanced/${entity}/${id}`),
        onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: [tab] }) },
        onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
    })
    const handleDelete = (entity: string, id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate({ entity, id }) }

    const { data: followupsData, isLoading: loadingFollowups } = useQuery({ queryKey: ['followups', search, page], queryFn: () => api.get('/advanced/follow-ups', { params: { search: search || undefined, page, per_page: 20 } }).then(r => r.data), enabled: tab === 'followups' })
    const { data: priceTablesData, isLoading: loadingPT } = useQuery({ queryKey: ['price-tables', page], queryFn: () => api.get('/advanced/price-tables', { params: { page, per_page: 20 } }).then(r => r.data), enabled: tab === 'price-tables' })
    const { data: documentsData, isLoading: loadingDocs } = useQuery({ queryKey: ['customer-documents', search, page], queryFn: () => api.get('/advanced/customer-documents', { params: { search: search || undefined, page, per_page: 20 } }).then(r => r.data), enabled: tab === 'documents' })
    const { data: costCentersData, isLoading: loadingCC } = useQuery({ queryKey: ['cost-centers', page], queryFn: () => api.get('/advanced/cost-centers', { params: { page, per_page: 20 } }).then(r => r.data), enabled: tab === 'cost-centers' })
    const { data: routesData, isLoading: loadingRoutes } = useQuery({ queryKey: ['route-plans', page], queryFn: () => api.get('/advanced/route-plans', { params: { page, per_page: 20 } }).then(r => r.data), enabled: tab === 'routes' })
    const { data: ratingsData, isLoading: loadingRatings } = useQuery({ queryKey: ['ratings', page], queryFn: () => api.get('/advanced/ratings', { params: { page, per_page: 20 } }).then(r => r.data), enabled: tab === 'ratings' })

    const followups = followupsData?.data ?? []
    const priceTables = priceTablesData?.data ?? []
    const documents = documentsData?.data ?? []
    const costCenters = costCentersData?.data ?? []
    const routes = routesData?.data ?? []
    const ratings = ratingsData?.data ?? []

    return (
        <div className="space-y-5">
            <PageHeader title="Recursos Avancados" subtitle="Follow-ups, tabelas de preco, documentos, centros de custo e rotas" />

            <div className="flex gap-1 rounded-xl border border-default bg-surface-50 p-1 overflow-x-auto">
                {tabs.map(t => (
                    <button key={t} onClick={() => { setTab(t); setPage(1); setSearch('') }}
                        className={cn('whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            tab === t ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                        )}>{tabLabels[t]}</button>
                ))}
            </div>

            {['followups', 'documents'].includes(tab) && (
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input type="text" placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="w-full rounded-lg border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                    </div>
                    {tab === 'followups' && <button onClick={() => openCreate('followup')} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors whitespace-nowrap"><Plus size={16} /> Novo</button>}
                </div>
            )}

            {tab === 'price-tables' && <div className="flex justify-end"><button onClick={() => openCreate('price-table')} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"><Plus size={16} /> Nova Tabela</button></div>}
            {tab === 'cost-centers' && <div className="flex justify-end"><button onClick={() => openCreate('cost-center')} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"><Plus size={16} /> Novo Centro</button></div>}

            {tab === 'followups' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Cliente</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data Agendada</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Responsavel</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Acoes</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingFollowups && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingFollowups && followups.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhum follow-up</td></tr>}
                            {followups.map((f: any) => (
                                <tr key={f.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{f.customer?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">{f.type === 'call' ? 'Ligacao' : f.type === 'email' ? 'E-mail' : f.type === 'visit' ? 'Visita' : f.type}</td>
                                    <td className="px-4 py-3 text-surface-600">{f.scheduled_at ? new Date(f.scheduled_at).toLocaleString('pt-BR') : '—'}</td>
                                    <td className="px-4 py-3 text-surface-600">{f.responsible?.name ?? '—'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', f.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : f.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{f.status === 'completed' ? 'Concluido' : f.status === 'overdue' ? 'Atrasado' : 'Pendente'}</span></td>
                                    <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                                        <button onClick={() => openEditFollowup(f)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil size={14} /></button>
                                        <button onClick={() => handleDelete('follow-ups', f.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                    </div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'price-tables' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Modificador</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Validade</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Acoes</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingPT && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingPT && priceTables.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhuma tabela de preco</td></tr>}
                            {priceTables.map((pt: any) => (
                                <tr key={pt.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{pt.name}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">{pt.type === 'markup' ? 'Markup' : 'Desconto'}</td>
                                    <td className="px-4 py-3 font-mono text-surface-700">{pt.modifier_percent}%</td>
                                    <td className="px-4 py-3 text-surface-600">{pt.valid_until ? new Date(pt.valid_until).toLocaleDateString('pt-BR') : 'Sem prazo'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', pt.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600')}>{pt.is_active ? 'Ativa' : 'Inativa'}</span></td>
                                    <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                                        <button onClick={() => openEditPriceTable(pt)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil size={14} /></button>
                                        <button onClick={() => handleDelete('price-tables', pt.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                    </div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'documents' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Cliente</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Arquivo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Validade</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingDocs && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingDocs && documents.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Nenhum documento</td></tr>}
                            {documents.map((d: any) => (
                                <tr key={d.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{d.customer?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">{d.document_type}</td>
                                    <td className="px-4 py-3"><span className="text-xs text-brand-600 font-mono">{d.original_filename ?? d.file_path?.split('/').pop() ?? '—'}</span></td>
                                    <td className="px-4 py-3 text-surface-600">{d.expires_at ? new Date(d.expires_at).toLocaleDateString('pt-BR') : 'Sem validade'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'cost-centers' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Codigo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Pai</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Acoes</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingCC && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingCC && costCenters.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhum centro de custo</td></tr>}
                            {costCenters.map((cc: any) => (
                                <tr key={cc.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-mono text-xs font-medium text-brand-600">{cc.code}</td>
                                    <td className="px-4 py-3 font-medium text-surface-900">{cc.name}</td>
                                    <td className="px-4 py-3 text-surface-600">{cc.parent?.name ?? '—'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', cc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600')}>{cc.is_active ? 'Ativo' : 'Inativo'}</span></td>
                                    <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                                        <button onClick={() => openEditCostCenter(cc)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil size={14} /></button>
                                        <button onClick={() => handleDelete('cost-centers', cc.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                    </div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'routes' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tecnico</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Paradas</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Distancia</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingRoutes && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingRoutes && routes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhuma rota planejada</td></tr>}
                            {routes.map((r: any) => (
                                <tr key={r.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{r.name}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.technician?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.planned_date ? new Date(r.planned_date).toLocaleDateString('pt-BR') : '—'}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.stops_count ?? 0}</td>
                                    <td className="px-4 py-3 font-mono text-surface-600">{r.total_distance_km ? `${r.total_distance_km} km` : '—'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}>{r.status === 'completed' ? 'Concluida' : r.status === 'in_progress' ? 'Em Andamento' : 'Planejada'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'ratings' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">OS</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nota</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Comentario</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingRatings && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingRatings && ratings.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Nenhuma avaliacao</td></tr>}
                            {ratings.map((r: any) => (
                                <tr key={r.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-mono text-xs font-medium text-brand-600">OS #{r.work_order_id}</td>
                                    <td className="px-4 py-3"><span className="text-lg font-medium text-amber-500">{r.rating ?? 0}/5</span></td>
                                    <td className="px-4 py-3 max-w-[300px] truncate text-surface-600">{r.comment ?? '—'}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modalType === 'followup' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalType(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">{editingId ? 'Editar Follow-up' : 'Novo Follow-up'}</h3>
                            <button onClick={() => setModalType(null)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveFollowup.mutate(followupForm) }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Tipo</label>
                                    <select value={followupForm.type} onChange={e => setFollowupForm({ ...followupForm, type: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="call">Ligacao</option><option value="email">E-mail</option><option value="visit">Visita</option><option value="whatsapp">WhatsApp</option>
                                    </select></div>
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Status</label>
                                    <select value={followupForm.status} onChange={e => setFollowupForm({ ...followupForm, status: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="pending">Pendente</option><option value="completed">Concluido</option><option value="overdue">Atrasado</option>
                                    </select></div>
                            </div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Data/Hora Agendada</label>
                                <input type="datetime-local" value={followupForm.scheduled_at} onChange={e => setFollowupForm({ ...followupForm, scheduled_at: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Notas</label>
                                <textarea rows={3} value={followupForm.notes} onChange={e => setFollowupForm({ ...followupForm, notes: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Observacoes do follow-up..." /></div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setModalType(null)} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancelar</button>
                                <button type="submit" disabled={saveFollowup.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saveFollowup.isPending ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalType === 'price-table' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalType(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">{editingId ? 'Editar Tabela de Preco' : 'Nova Tabela de Preco'}</h3>
                            <button onClick={() => setModalType(null)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); savePriceTable.mutate(priceTableForm) }} className="space-y-4">
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Nome *</label>
                                <input required value={priceTableForm.name} onChange={e => setPriceTableForm({ ...priceTableForm, name: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Tabela Premium" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Tipo</label>
                                    <select value={priceTableForm.type} onChange={e => setPriceTableForm({ ...priceTableForm, type: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="markup">Markup</option><option value="discount">Desconto</option>
                                    </select></div>
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Modificador (%)</label>
                                    <input type="number" step="0.01" value={priceTableForm.modifier_percent} onChange={e => setPriceTableForm({ ...priceTableForm, modifier_percent: Number(e.target.value) })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-surface-700 mb-1">Validade</label>
                                <input type="date" value={priceTableForm.valid_until} onChange={e => setPriceTableForm({ ...priceTableForm, valid_until: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="pt-active" checked={priceTableForm.is_active} onChange={e => setPriceTableForm({ ...priceTableForm, is_active: e.target.checked })} className="rounded border-default" />
                                <label htmlFor="pt-active" className="text-sm text-surface-700">Ativa</label>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setModalType(null)} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancelar</button>
                                <button type="submit" disabled={savePriceTable.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{savePriceTable.isPending ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalType === 'cost-center' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalType(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">{editingId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}</h3>
                            <button onClick={() => setModalType(null)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveCostCenter.mutate(costCenterForm) }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Codigo *</label>
                                    <input required value={costCenterForm.code} onChange={e => setCostCenterForm({ ...costCenterForm, code: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="CC-001" /></div>
                                <div><label className="block text-sm font-medium text-surface-700 mb-1">Nome *</label>
                                    <input required value={costCenterForm.name} onChange={e => setCostCenterForm({ ...costCenterForm, name: e.target.value })} className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Operacional" /></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="cc-active" checked={costCenterForm.is_active} onChange={e => setCostCenterForm({ ...costCenterForm, is_active: e.target.checked })} className="rounded border-default" />
                                <label htmlFor="cc-active" className="text-sm text-surface-700">Ativo</label>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setModalType(null)} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancelar</button>
                                <button type="submit" disabled={saveCostCenter.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saveCostCenter.isPending ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
