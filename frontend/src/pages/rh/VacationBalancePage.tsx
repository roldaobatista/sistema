import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import {
    Palmtree, AlertTriangle, Clock, CheckCircle2, Users, CalendarDays
} from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface VacationBalance {
    id: number
    user?: { name: string }
    acquisition_start: string
    acquisition_end: string
    total_days: number
    taken_days: number
    sold_days: number
    remaining_days: number
    deadline: string
    status: 'accruing' | 'available' | 'partially_taken' | 'taken' | 'expired'
}

const statusColors: Record<string, string> = {
    accruing: 'bg-blue-100 text-blue-700',
    available: 'bg-emerald-100 text-emerald-700',
    partially_taken: 'bg-amber-100 text-amber-700',
    taken: 'bg-surface-100 text-surface-600',
    expired: 'bg-red-100 text-red-700',
}
const statusLabels: Record<string, string> = {
    accruing: 'Aquisitivo',
    available: 'Disponível',
    partially_taken: 'Parcial',
    taken: 'Gozado',
    expired: 'Vencido',
}

export default function VacationBalancePage() {
  const { hasPermission } = useAuthStore()

    const [search, setSearch] = useState('')

    const { data: balancesRes, isLoading } = useQuery({
        queryKey: ['vacation-balances'],
        queryFn: () => api.get('/hr/vacation-balances').then(r => r.data?.data ?? []),
    })

    const balances: VacationBalance[] = balancesRes ?? []
    const filtered = balances.filter(b =>
        b.user?.name?.toLowerCase().includes(search.toLowerCase())
    )

    // Summary stats
    const expiringSoon = balances.filter(b => {
        if (!b.deadline) return false
        const diff = (new Date(b.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        return diff > 0 && diff <= 60 && b.remaining_days > 0
    })
    const expired = balances.filter(b => b.status === 'expired')
    const available = balances.filter(b => b.status === 'available')

    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    return (
        <div className="space-y-5">
            <PageHeader title="Saldo de Férias" subtitle="Períodos aquisitivos e saldo de férias por colaborador" />

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-brand-50 p-2.5"><Users className="h-5 w-5 text-brand-600" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Total Registros</p>
                            <p className="text-lg font-bold text-surface-900">{balances.length}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Disponíveis</p>
                            <p className="text-lg font-bold text-emerald-600">{available.length}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-amber-50 p-2.5"><Clock className="h-5 w-5 text-amber-600" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Vencendo (60d)</p>
                            <p className="text-lg font-bold text-amber-600">{expiringSoon.length}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-red-50 p-2.5"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Vencidas</p>
                            <p className="text-lg font-bold text-red-600">{expired.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                    type="text"
                    placeholder="Buscar colaborador..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                />
            </div>

            {/* Table */}
            <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Colaborador</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Período Aquisitivo</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Total</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Gozados</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Vendidos</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Restantes</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Limite</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading && (
                            <tr><td colSpan={8} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>
                        )}
                        {!isLoading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center">
                                    <Palmtree className="mx-auto h-8 w-8 text-surface-300" />
                                    <p className="mt-2 text-sm text-surface-400">Nenhum registro de férias encontrado</p>
                                </td>
                            </tr>
                        )}
                        {filtered.map(b => {
                            const deadlineDays = b.deadline
                                ? Math.ceil((new Date(b.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                : null
                            const isUrgent = deadlineDays !== null && deadlineDays <= 60 && b.remaining_days > 0

                            return (
                                <tr key={b.id} className={cn(
                                    'transition-colors hover:bg-surface-50/50',
                                    isUrgent && 'bg-amber-50/30',
                                    b.status === 'expired' && 'bg-red-50/30',
                                )}>
                                    <td className="px-4 py-3 font-medium text-surface-900">{b.user?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">
                                        <div className="flex items-center gap-1.5">
                                            <CalendarDays className="h-3.5 w-3.5 text-surface-400" />
                                            {fmtDate(b.acquisition_start)} → {fmtDate(b.acquisition_end)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium tabular-nums text-surface-700">{b.total_days}</td>
                                    <td className="px-4 py-3 text-center tabular-nums text-surface-500">{b.taken_days}</td>
                                    <td className="px-4 py-3 text-center tabular-nums text-surface-500">{b.sold_days}</td>
                                    <td className={cn('px-4 py-3 text-center font-bold tabular-nums',
                                        b.remaining_days > 0 ? 'text-emerald-600' : 'text-surface-400'
                                    )}>
                                        {b.remaining_days}
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                        <div className={cn(
                                            'flex items-center gap-1',
                                            isUrgent ? 'text-amber-600 font-semibold' : b.status === 'expired' ? 'text-red-600 font-semibold' : 'text-surface-500'
                                        )}>
                                            {isUrgent && <AlertTriangle className="h-3 w-3" />}
                                            {fmtDate(b.deadline)}
                                            {deadlineDays !== null && deadlineDays > 0 && (
                                                <span className="text-[10px] text-surface-400">({deadlineDays}d)</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColors[b.status])}>
                                            {statusLabels[b.status]}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
