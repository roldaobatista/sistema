import { useState, useEffect } from 'react'
import { Warehouse, Search, Phone, Mail, MapPin } from 'lucide-react'
import { useInmetroCompetitors, type InmetroCompetitor } from '@/hooks/useInmetro'

export function InmetroCompetitorsPage() {
    const [searchInput, setSearchInput] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [filters, setFilters] = useState({ search: '', city: '', per_page: 25, page: 1 })

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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-surface-900">
                    Oficinas Concorrentes
                    {pagination.total != null && (
                        <span className="ml-2 text-sm font-normal text-surface-500">({pagination.total} registros)</span>
                    )}
                </h1>
                <p className="text-sm text-surface-500 mt-0.5">Assistências técnicas autorizadas pelo INMETRO em MT</p>
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
                    />
                </div>
                <input
                    type="text"
                    placeholder="Filtrar por cidade..."
                    value={filters.city}
                    onChange={e => setFilters({ ...filters, city: e.target.value, page: 1 })}
                    className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm w-48"
                />
            </div>

            {/* Loading */}
            {isLoading ? (
                <div className="space-y-3 animate-pulse">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-20 bg-surface-100 rounded-xl" />
                    ))}
                </div>
            ) : competitors.length === 0 ? (
                <div className="text-center py-16">
                    <Warehouse className="h-12 w-12 text-surface-300 mx-auto mb-3" />
                    <p className="text-surface-500 text-sm">Nenhuma oficina encontrada. Importe dados XML primeiro.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {competitors.map((c: InmetroCompetitor) => (
                            <div key={c.id} className="rounded-xl border border-default bg-surface-0 p-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-surface-800">{c.name}</h3>
                                        {c.cnpj && <p className="text-xs text-surface-500 font-mono">{c.cnpj}</p>}
                                    </div>
                                    {c.authorization_number && (
                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                            Aut. {c.authorization_number}
                                        </span>
                                    )}
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
                            </div>
                        ))}
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
