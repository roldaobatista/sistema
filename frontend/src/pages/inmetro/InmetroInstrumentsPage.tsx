import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Scale, Search, CheckCircle, XCircle, Wrench, Clock, AlertTriangle, Download, RefreshCw, Loader2, Filter } from 'lucide-react'
import { useInmetroInstruments, useInmetroCities, useInstrumentTypes, type InmetroInstrument } from '@/hooks/useInmetro'
import { useInmetroAutoSync } from '@/hooks/useInmetroAutoSync'
import { useAuthStore } from '@/stores/auth-store'
import api from '@/lib/api'
import { toast } from 'sonner'

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string; badgeClass: string }> = {
    approved: { icon: CheckCircle, color: 'text-green-600', label: 'Aprovado', badgeClass: 'bg-green-100 text-green-700 border-green-200' },
    rejected: { icon: XCircle, color: 'text-red-600', label: 'Reprovado', badgeClass: 'bg-red-100 text-red-700 border-red-200' },
    repaired: { icon: Wrench, color: 'text-amber-600', label: 'Reparado', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
    unknown: { icon: Clock, color: 'text-surface-400', label: 'Desconhecido', badgeClass: 'bg-surface-100 text-surface-600 border-surface-200' },
}

export function InmetroInstrumentsPage() {
    const { hasPermission } = useAuthStore()
    const [searchParams] = useSearchParams()

    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [filters, setFilters] = useState({
        search: '',
        status: searchParams.get('status') || '',
        city: searchParams.get('city') || '',
        instrument_type: searchParams.get('instrument_type') || '',
        days_until_due: searchParams.get('days_until_due') || '',
        overdue: searchParams.get('overdue') === 'true',
        per_page: 25,
        page: 1,
    })

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
        return () => clearTimeout(timer)
    }, [searchInput])

    useEffect(() => {
        if (debouncedSearch !== filters.search) {
            setFilters(prev => ({ ...prev, search: debouncedSearch, page: 1 }))
        }
    }, [debouncedSearch])

    const queryParams = { ...filters, overdue: filters.overdue ? 'true' : '' }
    const { data, isLoading } = useInmetroInstruments(queryParams)
    const { data: cities } = useInmetroCities()
    const { data: instrumentTypes } = useInstrumentTypes()

    const instruments: InmetroInstrument[] = data?.data ?? []
    const pagination = data ?? {}
    const { isSyncing, triggerSync } = useInmetroAutoSync()

    const handleExportCsv = async () => {
        try {
            const response = await api.get('/inmetro/export/instruments', {
                params: queryParams,
                responseType: 'blob',
            })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `instrumentos-inmetro-${new Date().toISOString().slice(0, 10)}.csv`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            toast.success('CSV exportado com sucesso')
        } catch {
            toast.error('Erro ao exportar CSV')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900">
                        Instrumentos INMETRO
                        {pagination.total != null && (
                            <span className="ml-2 text-sm font-normal text-surface-500">({pagination.total} registros)</span>
                        )}
                    </h1>
                    <p className="text-sm text-surface-500">Balanças e instrumentos de medição com datas de verificação</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={triggerSync}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors disabled:opacity-50"
                    >
                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Atualizar dados
                    </button>
                    {hasPermission('inmetro.intelligence.view') && (
                        <button
                            onClick={handleExportCsv}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            Exportar CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar nº INMETRO, marca, proprietário..."
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        className="pl-9 rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm w-72"
                    />
                </div>
                <select
                    value={filters.status}
                    onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}
                    className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm"
                    aria-label="Filtrar por status"
                >
                    <option value="">Todos status</option>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                    ))}
                </select>
                <select
                    value={filters.city}
                    onChange={e => setFilters({ ...filters, city: e.target.value, page: 1 })}
                    className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm"
                    aria-label="Filtrar por cidade"
                >
                    <option value="">Todas cidades</option>
                    {cities?.map(c => (
                        <option key={c.city} value={c.city}>{c.city} ({c.instrument_count})</option>
                    ))}
                </select>
                <select
                    value={filters.days_until_due}
                    onChange={e => setFilters({ ...filters, days_until_due: e.target.value, overdue: false, page: 1 })}
                    className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm"
                    aria-label="Filtrar por prazo"
                >
                    <option value="">Todos prazos</option>
                    <option value="30">Vence em 30 dias</option>
                    <option value="60">Vence em 60 dias</option>
                    <option value="90">Vence em 90 dias</option>
                </select>
                <label className="inline-flex items-center gap-1.5 text-sm text-surface-600 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={filters.overdue}
                        onChange={e => setFilters({ ...filters, overdue: e.target.checked, days_until_due: '', page: 1 })}
                        className="rounded border-surface-300"
                    />
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    Somente vencidos
                </label>
                <select
                    value={filters.instrument_type}
                    onChange={e => setFilters({ ...filters, instrument_type: e.target.value, page: 1 })}
                    className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm"
                    aria-label="Filtrar por tipo de instrumento"
                >
                    <option value="">Todos tipos</option>
                    {instrumentTypes?.map(t => (
                        <option key={t.slug} value={t.label}>{t.label}</option>
                    ))}
                </select>
            </div>

            {/* Sync Banner */}
            {isSyncing && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3 animate-pulse">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-blue-800">Buscando dados do INMETRO...</p>
                        <p className="text-xs text-blue-600">Importando instrumentos de medição do portal RBMLQ.</p>
                    </div>
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <div className="space-y-3 animate-pulse">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-12 bg-surface-100 rounded-xl" />
                    ))}
                </div>
            ) : instruments.length === 0 && !isSyncing ? (
                <div className="text-center py-16">
                    <Scale className="h-12 w-12 text-surface-300 mx-auto mb-3" />
                    <p className="text-surface-500 text-sm">Nenhum instrumento encontrado.</p>
                    <button
                        onClick={triggerSync}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" /> Buscar dados do INMETRO
                    </button>
                </div>
            ) : instruments.length === 0 && isSyncing ? null : (
                <>
                    <div className="overflow-x-auto rounded-xl border border-default bg-surface-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-default bg-surface-50">
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Nº INMETRO</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Tipo</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Marca / Modelo</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Capacidade</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Status</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Proprietário</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Cidade</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Última Verif.</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Próxima</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-surface-600">Executor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {instruments.map((inst) => {
                                    const si = statusConfig[inst.current_status] || statusConfig.unknown
                                    const StatusIcon = si.icon
                                    const isOverdue = inst.next_verification_at && new Date(inst.next_verification_at) < new Date()
                                    return (
                                        <tr key={inst.id} className="border-b border-subtle hover:bg-surface-25 transition-colors">
                                            <td className="px-3 py-2.5 font-mono text-xs font-medium text-surface-800">{inst.inmetro_number}</td>
                                            <td className="px-3 py-2.5 text-xs text-surface-600">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-surface-100 text-surface-700 border border-surface-200">
                                                    {inst.instrument_type || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-surface-700">
                                                {inst.brand || '—'}{inst.model ? ` / ${inst.model}` : ''}
                                            </td>
                                            <td className="px-3 py-2.5 text-surface-600 text-xs">{inst.capacity || '—'}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${si.badgeClass}`}>
                                                    <StatusIcon className="h-3 w-3" /> {si.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {inst.owner_name ? (
                                                    <Link to={`/inmetro/owners/${inst.owner_id}`} className="text-brand-700 hover:text-brand-800 hover:underline text-xs font-medium">{inst.owner_name}</Link>
                                                ) : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-surface-600">
                                                {inst.address_city || '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-surface-600">
                                                {inst.last_verification_at ? new Date(inst.last_verification_at).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                            <td className={`px-3 py-2.5 text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-surface-600'}`}>
                                                {inst.next_verification_at ? new Date(inst.next_verification_at).toLocaleDateString('pt-BR') : '—'}
                                                {isOverdue && ' ⚠️'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-surface-500">{inst.last_executor || '—'}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.last_page > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-surface-500">
                                {pagination.from}–{pagination.to} de {pagination.total}
                            </p>
                            <div className="flex gap-1">
                                {Array.from({ length: Math.min(pagination.last_page, 10) }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setFilters({ ...filters, page })}
                                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filters.page === page
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default InmetroInstrumentsPage
