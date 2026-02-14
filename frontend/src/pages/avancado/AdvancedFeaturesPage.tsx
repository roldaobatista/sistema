import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search, Plus, Star, DollarSign, FileText, MapPin, Tag,
    ChevronLeft, ChevronRight, CalendarClock, UserCheck, BookOpen
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'

const tabs = ['followups', 'price-tables', 'documents', 'cost-centers', 'routes', 'ratings'] as const
type Tab = typeof tabs[number]
const tabLabels: Record<Tab, string> = {
    followups: 'Follow-ups', 'price-tables': 'Tabelas de Preço', documents: 'Documentos',
    'cost-centers': 'Centros de Custo', routes: 'Rotas', ratings: 'Avaliações OS'
}

export default function AdvancedFeaturesPage() {
    const [tab, setTab] = useState<Tab>('followups')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')

    const { data: followupsData, isLoading: loadingFollowups } = useQuery({
        queryKey: ['followups', search, page],
        queryFn: () => api.get('/advanced/follow-ups', { params: { search: search || undefined, page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'followups',
    })

    const { data: priceTablesData, isLoading: loadingPT } = useQuery({
        queryKey: ['price-tables', page],
        queryFn: () => api.get('/advanced/price-tables', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'price-tables',
    })

    const { data: documentsData, isLoading: loadingDocs } = useQuery({
        queryKey: ['customer-documents', search, page],
        queryFn: () => api.get('/advanced/customer-documents', { params: { search: search || undefined, page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'documents',
    })

    const { data: costCentersData, isLoading: loadingCC } = useQuery({
        queryKey: ['cost-centers', page],
        queryFn: () => api.get('/advanced/cost-centers', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'cost-centers',
    })

    const { data: routesData, isLoading: loadingRoutes } = useQuery({
        queryKey: ['route-plans', page],
        queryFn: () => api.get('/advanced/route-plans', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'routes',
    })

    const { data: ratingsData, isLoading: loadingRatings } = useQuery({
        queryKey: ['ratings', page],
        queryFn: () => api.get('/advanced/ratings', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'ratings',
    })

    const followups = followupsData?.data ?? []
    const priceTables = priceTablesData?.data ?? []
    const documents = documentsData?.data ?? []
    const costCenters = costCentersData?.data ?? []
    const routes = routesData?.data ?? []
    const ratings = ratingsData?.data ?? []

    return (
        <div className="space-y-5">
            <PageHeader title="Recursos Avançados" subtitle="Follow-ups, tabelas de preço, documentos, centros de custo e rotas" />

            <div className="flex gap-1 rounded-xl border border-default bg-surface-50 p-1 overflow-x-auto">
                {tabs.map(t => (
                    <button key={t} onClick={() => { setTab(t); setPage(1); setSearch('') }}
                        className={cn('whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            tab === t ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                        )}>{tabLabels[t]}</button>
                ))}
            </div>

            {['followups', 'documents'].includes(tab) && (
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input type="text" placeholder="Buscar..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                        className="w-full rounded-lg border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                </div>
            )}

            {/* FOLLOW-UPS */}
            {tab === 'followups' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Cliente</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data Agendada</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Responsável</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingFollowups && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingFollowups && followups.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhum follow-up</td></tr>}
                            {followups.map((f: any) => (
                                <tr key={f.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{f.customer?.name ?? 'â€”'}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">{f.type === 'call' ? 'Ligação' : f.type === 'email' ? 'E-mail' : f.type === 'visit' ? 'Visita' : f.type}</td>
                                    <td className="px-4 py-3 text-surface-600">{f.scheduled_at ? new Date(f.scheduled_at).toLocaleString('pt-BR') : 'â€”'}</td>
                                    <td className="px-4 py-3 text-surface-600">{f.responsible?.name ?? 'â€”'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        f.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : f.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    )}>{f.status === 'completed' ? 'Concluído' : f.status === 'overdue' ? 'Atrasado' : 'Pendente'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* PRICE TABLES */}
            {tab === 'price-tables' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Modificador</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Validade</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingPT && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingPT && priceTables.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhuma tabela de preço</td></tr>}
                            {priceTables.map((pt: any) => (
                                <tr key={pt.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{pt.name}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">{pt.type === 'markup' ? 'Markup' : 'Desconto'}</td>
                                    <td className="px-4 py-3 font-mono text-surface-700">{pt.modifier_percent}%</td>
                                    <td className="px-4 py-3 text-surface-600">{pt.valid_until ? new Date(pt.valid_until).toLocaleDateString('pt-BR') : 'Sem prazo'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        pt.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600'
                                    )}>{pt.is_active ? 'Ativa' : 'Inativa'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* DOCUMENTS */}
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
                                    <td className="px-4 py-3 font-medium text-surface-900">{d.customer?.name ?? 'â€”'}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">{d.document_type}</td>
                                    <td className="px-4 py-3"><span className="text-xs text-brand-600 font-mono">{d.original_filename ?? d.file_path?.split('/').pop() ?? 'â€”'}</span></td>
                                    <td className="px-4 py-3 text-surface-600">{d.expires_at ? new Date(d.expires_at).toLocaleDateString('pt-BR') : 'Sem validade'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* COST CENTERS */}
            {tab === 'cost-centers' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Código</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Pai</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingCC && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingCC && costCenters.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Nenhum centro de custo</td></tr>}
                            {costCenters.map((cc: any) => (
                                <tr key={cc.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-mono text-xs font-medium text-brand-600">{cc.code}</td>
                                    <td className="px-4 py-3 font-medium text-surface-900">{cc.name}</td>
                                    <td className="px-4 py-3 text-surface-600">{cc.parent?.name ?? 'â€”'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        cc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600'
                                    )}>{cc.is_active ? 'Ativo' : 'Inativo'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ROUTES */}
            {tab === 'routes' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Técnico</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Paradas</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Distância</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingRoutes && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingRoutes && routes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhuma rota planejada</td></tr>}
                            {routes.map((r: any) => (
                                <tr key={r.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{r.name}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.technician?.name ?? 'â€”'}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.planned_date ? new Date(r.planned_date).toLocaleDateString('pt-BR') : 'â€”'}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.stops_count ?? 0}</td>
                                    <td className="px-4 py-3 font-mono text-surface-600">{r.total_distance_km ? `${r.total_distance_km} km` : 'â€”'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                    )}>{r.status === 'completed' ? 'Concluída' : r.status === 'in_progress' ? 'Em Andamento' : 'Planejada'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* RATINGS */}
            {tab === 'ratings' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">OS</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nota</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Comentário</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingRatings && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingRatings && ratings.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Nenhuma avaliação</td></tr>}
                            {ratings.map((r: any) => (
                                <tr key={r.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-mono text-xs font-medium text-brand-600">OS #{r.work_order_id}</td>
                                    <td className="px-4 py-3"><span className="text-lg">{'â­'.repeat(r.rating ?? 0)}</span></td>
                                    <td className="px-4 py-3 max-w-[300px] truncate text-surface-600">{r.comment ?? 'â€”'}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : 'â€”'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}