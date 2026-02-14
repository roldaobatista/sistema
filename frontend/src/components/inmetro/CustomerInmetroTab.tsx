import { Scale, MapPin, AlertTriangle, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { useCustomerInmetroProfile } from '@/hooks/useInmetro'

interface CustomerInmetroTabProps {
    customerId: number
}

const statusColors: Record<string, string> = {
    aprovado: 'text-green-600 bg-green-50',
    reprovado: 'text-red-600 bg-red-50',
    verificado: 'text-blue-600 bg-blue-50',
}

export function CustomerInmetroTab({ customerId }: CustomerInmetroTabProps) {
    const { data: profile, isLoading } = useCustomerInmetroProfile(customerId)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
            </div>
        )
    }

    if (!profile || !profile.linked) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Scale className="h-12 w-12 text-surface-300 mb-3" />
                <p className="text-sm font-medium text-surface-600">Sem dados INMETRO</p>
                <p className="text-xs text-surface-400 mt-1">Este cliente não possui instrumentos vinculados no sistema INMETRO.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-default bg-surface-0 p-3">
                    <p className="text-xs text-surface-500">Instrumentos</p>
                    <p className="text-xl font-bold text-surface-900">{profile.total_instruments}</p>
                </div>
                <div className="rounded-lg border border-default bg-surface-0 p-3">
                    <p className="text-xs text-surface-500">Locais</p>
                    <p className="text-xl font-bold text-surface-900">{profile.total_locations}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-xs text-red-600">Vencidos</p>
                    <p className="text-xl font-bold text-red-700">{profile.overdue}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-600">Vence em 30d</p>
                    <p className="text-xl font-bold text-amber-700">{profile.expiring_30d}</p>
                </div>
            </div>

            {/* Instrument Type Breakdown */}
            {profile.by_type && Object.keys(profile.by_type).length > 0 && (
                <div className="rounded-lg border border-default bg-surface-0 p-4">
                    <h4 className="text-sm font-medium text-surface-700 mb-2">Por Tipo de Instrumento</h4>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(profile.by_type).map(([type, count]) => (
                            <span key={type} className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-700">
                                <Scale className="h-3 w-3" /> {type}: {count}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Instruments Table */}
            {profile.instruments && profile.instruments.length > 0 && (
                <div className="rounded-lg border border-default bg-surface-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-default bg-surface-50">
                        <h4 className="text-sm font-medium text-surface-700">Instrumentos ({profile.instruments.length})</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-surface-500">Nº INMETRO</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-surface-500">Tipo</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-surface-500">Marca/Modelo</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-surface-500">Status</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-surface-500">Última Verif.</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-surface-500">Próxima Verif.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profile.instruments.map((inst) => {
                                    const isOverdue = inst.next_verification_at && new Date(inst.next_verification_at) < new Date()
                                    const StatusIcon = isOverdue ? AlertTriangle : inst.current_status === 'aprovado' ? CheckCircle : Clock
                                    const statusColor = statusColors[inst.current_status] || 'text-surface-600 bg-surface-50'

                                    return (
                                        <tr key={inst.id} className="border-b border-subtle hover:bg-surface-25">
                                            <td className="px-3 py-2 font-mono text-xs">{inst.inmetro_number}</td>
                                            <td className="px-3 py-2 text-xs">{inst.instrument_type}</td>
                                            <td className="px-3 py-2 text-xs">{[inst.brand, inst.model].filter(Boolean).join(' / ') || '—'}</td>
                                            <td className="px-3 py-2">
                                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                                                    <StatusIcon className="h-3 w-3" /> {inst.current_status || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-surface-600">
                                                {inst.last_verification_at ? new Date(inst.last_verification_at).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                            <td className={`px-3 py-2 text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-surface-600'}`}>
                                                {inst.next_verification_at ? new Date(inst.next_verification_at).toLocaleDateString('pt-BR') : '—'}
                                                {isOverdue && <span className="ml-1 text-red-500">⚠</span>}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Locations */}
            {profile.locations && profile.locations.length > 0 && (
                <div className="rounded-lg border border-default bg-surface-0 p-4">
                    <h4 className="text-sm font-medium text-surface-700 mb-2">Locais ({profile.locations.length})</h4>
                    <div className="space-y-1.5">
                        {profile.locations.map((loc) => (
                            <div key={loc.id} className="flex items-center gap-2 text-xs text-surface-600">
                                <MapPin className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                                <span>{loc.address_city}/{loc.address_state}</span>
                                {loc.farm_name && <span className="text-surface-400">({loc.farm_name})</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
