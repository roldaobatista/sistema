import { useQuery } from '@tanstack/react-query'
import { FileText, TrendingUp, TrendingDown, DollarSign, BarChart3, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'

interface Stats {
    total_notes: number
    total_nfe: number
    total_nfse: number
    authorized: number
    cancelled: number
    rejected: number
    pending: number
    total_amount: number
    total_amount_cancelled: number
    monthly_comparison: {
        current: number
        previous: number
        change_percent: number
    }
}

export default function FiscalDashboard() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['fiscal-stats'],
        queryFn: async () => {
            const { data } = await api.get('/fiscal/stats')
            return data.data ?? data
        },
    })

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-24 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />
                ))}
            </div>
        )
    }

    if (!stats) return null

    const s = stats as Stats
    const changePositive = (s.monthly_comparison?.change_percent ?? 0) > 0

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
                label="Total do Mês"
                value={s.total_notes ?? 0}
                icon={FileText}
                color="brand"
                detail={`${s.total_nfe ?? 0} NF-e / ${s.total_nfse ?? 0} NFS-e`}
            />
            <StatCard
                label="Autorizadas"
                value={s.authorized ?? 0}
                icon={BarChart3}
                color="emerald"
            />
            <StatCard
                label="Pendentes"
                value={s.pending ?? 0}
                icon={AlertTriangle}
                color="amber"
            />
            <StatCard
                label="Rejeitadas"
                value={s.rejected ?? 0}
                icon={AlertTriangle}
                color="red"
            />
            <StatCard
                label="Faturamento"
                value={Number(s.total_amount ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                icon={DollarSign}
                color="emerald"
                isMonetary
            />
            <StatCard
                label="vs Mês Anterior"
                value={`${changePositive ? '+' : ''}${(s.monthly_comparison?.change_percent ?? 0).toFixed(1)}%`}
                icon={changePositive ? TrendingUp : TrendingDown}
                color={changePositive ? 'emerald' : 'red'}
            />
        </div>
    )
}

function StatCard({
    label, value, icon: Icon, color, detail, isMonetary
}: {
    label: string
    value: string | number
    icon: any
    color: string
    detail?: string
    isMonetary?: boolean
}) {
    const colorMap: Record<string, string> = {
        brand: 'text-brand-600 bg-brand-50 dark:bg-brand-900/20 dark:text-brand-400',
        emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
        amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
        red: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    }

    return (
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">{label}</span>
                <div className={`p-1.5 rounded-lg ${colorMap[color] ?? colorMap.brand}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <p className={`text-xl font-bold ${isMonetary ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {value}
            </p>
            {detail && <p className="text-xs text-surface-400">{detail}</p>}
        </div>
    )
}
