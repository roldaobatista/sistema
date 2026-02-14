import { useState, useEffect } from 'react'
import { Warehouse, Search, Phone, Mail, MapPin, RefreshCw, Loader2, Wrench, Shield, ChevronDown, ChevronUp, Calendar, Award, Scale } from 'lucide-react'
import { useInmetroCompetitors, type InmetroCompetitor } from '@/hooks/useInmetro'
import { useInmetroAutoSync } from '@/hooks/useInmetroAutoSync'
import { Badge } from '@/components/ui/badge'

export function InmetroCompetitorsPage() {
    const [searchInput, setSearchInput] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [filters, setFilters] = useState({ search: '', city: '', per_page: 25, page: 1 })
    const [expandedId, setExpandedId] = useState<number | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
        return () => clearTimeout(timer)
    }, [searchInput])

    useEffect(() => {
        if (debouncedSearch !== filters.search) {
            setFilters(prev => ({ ...prev, search: debouncedSearch, page: 1 }))
        }
    }, [debouncedSearch])

    const { data, isLoading } = useInmetroCompetitors(filters)
    const competitors = data?.data ?? []
    const pagination = data ?? {}
    const { isSyncing, triggerSync } = useInmetroAutoSync()

    const toggleExpand = (id: number) => {
        setExpandedId(prev => prev === id ? null : id)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900">
                        Oficinas Concorrentes
                        {pagination.total != null && (
                            <span className="ml-2 text-sm font-normal text-surface-500">({pagination.total} registros)</span>
                        )}
                    </h1>
                    <p className="text-sm text-surface-500 mt-0.5">Assistências técnicas autorizadas pelo INMETRO</p>
                </div>
                <button
                    onClick={triggerSync}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors disabled:opacity-50"
                >
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Atualizar dados
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, CNPJ..."
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        className="pl-9 rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm w-64"
                        aria-label="Buscar concorrentes"
                    />
                </div>
                <input
                    type="text"
                    placeholder="Filtrar por cidade..."
                    value={filters.city}
                    onChange={e => setFilters({ ...filters, city: e.target.value, page: 1 })}
                    className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm w-48"
                    aria-label="Filtrar por cidade"
                />
            </div>

            {/* Sync Banner */}
            {isSyncing && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3 animate-pulse">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-blue-800">Buscando dados do INMETRO...</p>
                        <p className="text-xs text-blue-600">Importando oficinas autorizadas do portal RBMLQ.</p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {isLoading ? (
                <div className="space-y-3 animate-pulse">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-20 bg-surface-100 rounded-xl" />
                    ))}
                </div>
            ) : competitors.length === 0 && !isSyncing ? (
                <div className="text-center py-16">
                    <Warehouse className="h-12 w-12 text-surface-300 mx-auto mb-3" />
                    <p className="text-surface-500 text-sm">Nenhuma oficina encontrada.</p>
                    <button
                        onClick={triggerSync}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" /> Buscar dados do INMETRO
                    </button>
                </div>
            ) : competitors.length === 0 && isSyncing ? null : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {competitors.map((c: InmetroCompetitor) => {
                            const isExpanded = expandedId === c.id
                            const isAuthValid = c.authorization_valid_until
                                ? new Date(c.authorization_valid_until) > new Date()
                                : null

                            return (
                                <div key={c.id} className="rounded-xl border border-default bg-surface-0 hover:shadow-sm transition-shadow">
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="text-sm font-semibold text-surface-800">{c.name}</h3>
                                                {c.cnpj && <p className="text-xs text-surface-500 font-mono">{c.cnpj}</p>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {c.total_repairs > 0 && (
                                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                                                        <Wrench className="h-2.5 w-2.5 mr-0.5" />
                                                        {c.total_repairs} reparos
                                                    </Badge>
                                                )}
                                                {c.authorization_number && (
                                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                                        Aut. {c.authorization_number}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-xs text-surface-600">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 text-surface-400" />
                                                {c.city}/{c.state} {c.address && `— ${c.address}`}
                                            </div>
                                            {c.phone && (
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="h-3.5 w-3.5 text-green-500" />
                                                    {c.phone}
                                                </div>
                                            )}
                                            {c.email && (
                                                <div className="flex items-center gap-1.5">
                                                    <Mail className="h-3.5 w-3.5 text-blue-500" />
                                                    {c.email}
                                                </div>
                                            )}
                                        </div>

                                        {/* v2: Authorization Status */}
                                        {isAuthValid !== null && (
                                            <div className="mt-2 flex items-center gap-1.5 text-xs">
                                                <Shield className={`h-3.5 w-3.5 ${isAuthValid ? 'text-green-500' : 'text-red-500'}`} />
                                                <span className={isAuthValid ? 'text-green-700' : 'text-red-700'}>
                                                    {isAuthValid ? 'Autorização vigente' : 'Autorização vencida'}
                                                    {c.authorization_valid_until && ` — até ${new Date(c.authorization_valid_until).toLocaleDateString('pt-BR')}`}
                                                </span>
                                            </div>
                                        )}

                                        {c.authorized_species && c.authorized_species.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {c.authorized_species.map((s, i) => (
                                                    <span key={i} className="text-[10px] bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {c.mechanics && c.mechanics.length > 0 && (
                                            <div className="mt-2 text-[10px] text-surface-500">
                                                Mecânicos: {c.mechanics.join(', ')}
                                            </div>
                                        )}

                                        {/* Expand Button */}
                                        <button
                                            onClick={() => toggleExpand(c.id)}
                                            className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium py-1 rounded hover:bg-surface-50 transition-colors"
                                        >
                                            {isExpanded ? (
                                                <>Menos detalhes <ChevronUp className="h-3.5 w-3.5" /></>
                                            ) : (
                                                <>Mais detalhes <ChevronDown className="h-3.5 w-3.5" /></>
                                            )}
                                        </button>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div className="border-t border-default bg-surface-25 p-4 space-y-3 animate-in fade-in duration-200">
                                            {/* v2 Fields */}
                                            <div className="grid grid-cols-2 gap-2">
                                                {c.max_capacity && (
                                                    <div className="rounded-lg bg-surface-50 p-2.5 text-center">
                                                        <Scale className="h-4 w-4 text-surface-400 mx-auto mb-1" />
                                                        <p className="text-xs font-medium text-surface-700">Capacidade</p>
                                                        <p className="text-[10px] text-surface-500">{c.max_capacity}</p>
                                                    </div>
                                                )}
                                                {c.accuracy_classes && c.accuracy_classes.length > 0 && (
                                                    <div className="rounded-lg bg-surface-50 p-2.5 text-center">
                                                        <Award className="h-4 w-4 text-surface-400 mx-auto mb-1" />
                                                        <p className="text-xs font-medium text-surface-700">Classes</p>
                                                        <p className="text-[10px] text-surface-500">{c.accuracy_classes.join(', ')}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Repair History */}
                                            {c.repairs && c.repairs.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-semibold text-surface-700 mb-2 flex items-center gap-1.5">
                                                        <Wrench className="h-3.5 w-3.5" />
                                                        Reparos Realizados ({c.repairs.length})
                                                    </h4>
                                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                        {c.repairs.map(repair => (
                                                            <div key={repair.id} className="flex items-center justify-between rounded-lg bg-surface-0 border border-subtle px-3 py-2 text-xs">
                                                                <div>
                                                                    <span className="font-mono text-surface-700">{repair.instrument_number || `#${repair.instrument_id}`}</span>
                                                                    {repair.instrument_type && (
                                                                        <span className="ml-1.5 text-surface-500">({repair.instrument_type})</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {repair.result && (
                                                                        <Badge className={`text-[10px] ${repair.result === 'approved' ? 'bg-green-100 text-green-700' : repair.result === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                            {repair.result === 'approved' ? 'Aprovado' : repair.result === 'rejected' ? 'Reprovado' : 'Reparado'}
                                                                        </Badge>
                                                                    )}
                                                                    <span className="text-surface-500 flex items-center gap-1">
                                                                        <Calendar className="h-3 w-3" />
                                                                        {new Date(repair.repair_date).toLocaleDateString('pt-BR')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {(!c.repairs || c.repairs.length === 0) && !c.max_capacity && (!c.accuracy_classes || c.accuracy_classes.length === 0) && (
                                                <p className="text-xs text-surface-400 text-center py-3">
                                                    Sem dados detalhados disponíveis. Execute a sincronização para importar mais dados.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

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

export default InmetroCompetitorsPage
