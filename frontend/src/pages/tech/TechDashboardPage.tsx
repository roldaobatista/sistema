import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    BarChart3, Trophy, Clock, Target, TrendingUp, CheckCircle2,
    ArrowLeft, Wrench, Star, Award, Flame, DollarSign, Calendar, Navigation,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'
import { DashboardSkeleton } from '@/components/tech/TechSkeleton'

interface ProductivityData {
    completed_this_month?: number
    average_time_hours?: number
    nps_score?: number
    pending_count?: number
    in_progress_count?: number
    completion_rate?: number
    hours_worked_month?: number
    streak_days?: number
    weekly_completed?: Array<{ week: string; count: number }>
}

interface RankingData {
    position?: number
    total_technicians?: number
}

export default function TechDashboardPage() {
    const navigate = useNavigate()
    const [productivityData, setProductivityData] = useState<ProductivityData | null>(null)
    const [rankingData, setRankingData] = useState<RankingData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true)
                
                const [productivityRes, rankingRes] = await Promise.all([
                    api.get('/reports/productivity', { params: { my: '1' } }).catch(() => ({ data: {} })),
                    api.get('/commission-dashboard/ranking').catch(() => ({ data: {} })),
                ])

                setProductivityData(productivityRes.data || {})
                setRankingData(rankingRes.data || {})
            } catch (error: any) {
                toast.error(error?.response?.data?.message || 'Erro ao carregar dados')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    }

    const weeklyData = useMemo(() => {
        if (!productivityData?.weekly_completed || productivityData.weekly_completed.length === 0) {
            return Array.from({ length: 4 }, (_, i) => ({ week: `Semana ${i + 1}`, count: 0 }))
        }
        return productivityData.weekly_completed.slice(-4)
    }, [productivityData?.weekly_completed])

    const maxCount = Math.max(...weeklyData.map(w => w.count), 1)

    const badges = useMemo(() => {
        const completed = productivityData?.completed_this_month ?? 0
        const nps = productivityData?.nps_score ?? 0
        const rate = productivityData?.completion_rate ?? 0

        return [
            { id: 'first10', emoji: '🎯', label: '10 OS no mês', earned: completed >= 10 },
            { id: 'first25', emoji: '💪', label: '25 OS no mês', earned: completed >= 25 },
            { id: 'first50', emoji: '🏆', label: '50 OS no mês', earned: completed >= 50 },
            { id: 'nps9', emoji: '⭐', label: 'NPS acima de 9', earned: nps >= 9 },
            { id: 'perfect', emoji: '💯', label: '100% conclusão', earned: rate >= 100 },
            { id: 'top3', emoji: '🥇', label: 'Top 3 ranking', earned: (rankingData?.position ?? 999) <= 3 },
        ]
    }, [productivityData, rankingData])

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                        </button>
                        <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                            Dashboard
                        </h1>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    <DashboardSkeleton />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Dashboard
                    </h1>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Summary Cards Row */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-surface-500 dark:text-surface-400">OS Concluídas</span>
                        </div>
                        <p className="text-lg font-bold text-surface-900 dark:text-surface-50">
                            {productivityData?.completed_this_month ?? 0}
                        </p>
                        <p className="text-[10px] text-surface-400">este mês</p>
                    </div>

                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-surface-500 dark:text-surface-400">Tempo Médio</span>
                        </div>
                        <p className="text-lg font-bold text-surface-900 dark:text-surface-50">
                            {productivityData?.average_time_hours ? `${productivityData.average_time_hours.toFixed(1)}h` : 'N/A'}
                        </p>
                        <p className="text-[10px] text-surface-400">por OS</p>
                    </div>

                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Star className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-surface-500 dark:text-surface-400">NPS Pessoal</span>
                        </div>
                        <p className="text-lg font-bold text-surface-900 dark:text-surface-50">
                            {productivityData?.nps_score ? productivityData.nps_score.toFixed(1) : 'N/A'}
                        </p>
                        <p className="text-[10px] text-surface-400">avaliação</p>
                    </div>
                </div>

                {/* Ranking Card */}
                <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <Trophy className="w-6 h-6" />
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold">Ranking de Técnicos</h3>
                            <p className="text-xs text-brand-100">
                                {rankingData?.position && rankingData?.total_technicians
                                    ? `${rankingData.position}º de ${rankingData.total_technicians} técnicos`
                                    : 'Posição não disponível'}
                            </p>
                        </div>
                    </div>
                    {rankingData?.position && rankingData.position <= 3 && (
                        <div className="mt-2 text-xs text-brand-100">
                            🏆 Parabéns! Você está entre os melhores!
                        </div>
                    )}
                </div>

                {/* Weekly Chart */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-brand-600" />
                        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                            OS Concluídas por Semana
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {weeklyData.map((week, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-surface-600 dark:text-surface-400">{week.week}</span>
                                    <span className="font-semibold text-surface-900 dark:text-surface-50">{week.count}</span>
                                </div>
                                <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-brand-600 rounded-full transition-all"
                                        style={{ width: `${(week.count / maxCount) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-surface-500 dark:text-surface-400">OS Pendentes</span>
                        </div>
                        <p className="text-xl font-bold text-surface-900 dark:text-surface-50">
                            {productivityData?.pending_count ?? 0}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Wrench className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-surface-500 dark:text-surface-400">OS em Andamento</span>
                        </div>
                        <p className="text-xl font-bold text-surface-900 dark:text-surface-50">
                            {productivityData?.in_progress_count ?? 0}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-surface-500 dark:text-surface-400">Taxa de Conclusão</span>
                        </div>
                        <p className="text-xl font-bold text-surface-900 dark:text-surface-50">
                            {productivityData?.completion_rate ? `${productivityData.completion_rate.toFixed(0)}%` : 'N/A'}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-surface-500 dark:text-surface-400">Horas Trabalhadas</span>
                        </div>
                        <p className="text-xl font-bold text-surface-900 dark:text-surface-50">
                            {productivityData?.hours_worked_month ? `${productivityData.hours_worked_month.toFixed(1)}h` : 'N/A'}
                        </p>
                        <p className="text-[10px] text-surface-400">este mês</p>
                    </div>
                </div>

                {/* Badges & Conquistas */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Award className="w-5 h-5 text-amber-500" />
                        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                            Conquistas
                        </h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {badges.map((badge) => (
                            <div
                                key={badge.id}
                                className={cn(
                                    'flex flex-col items-center gap-1.5 p-3 rounded-xl text-center',
                                    badge.earned
                                        ? 'bg-amber-50 dark:bg-amber-900/20'
                                        : 'bg-surface-50 dark:bg-surface-800 opacity-40'
                                )}
                            >
                                <span className="text-2xl">{badge.emoji}</span>
                                <span className={cn(
                                    'text-[10px] font-medium leading-tight',
                                    badge.earned ? 'text-amber-700 dark:text-amber-400' : 'text-surface-400'
                                )}>
                                    {badge.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Streak */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            <Flame className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{productivityData?.streak_days ?? 0} dias</p>
                            <p className="text-xs text-orange-100">Sequência sem SLA estourado</p>
                        </div>
                    </div>
                </div>

                {/* Atalhos Rápidos */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">Atalhos Rápidos</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Minhas Comissões', path: '/tech/comissoes', icon: DollarSign, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
                            { label: 'Metas', path: '/tech/metas', icon: Target, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
                            { label: 'Resumo do Dia', path: '/tech/resumo-diario', icon: Calendar, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400' },
                            { label: 'Rota do Dia', path: '/tech/rota', icon: Navigation, color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400' },
                        ].map(link => (
                            <button
                                key={link.path}
                                onClick={() => navigate(link.path)}
                                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-50 dark:bg-surface-900 active:scale-[0.98] transition-transform"
                            >
                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', link.color)}>
                                    <link.icon className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-medium text-surface-700 dark:text-surface-300">{link.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
