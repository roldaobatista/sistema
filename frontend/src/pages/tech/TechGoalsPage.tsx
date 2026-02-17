import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Target, Trophy, Gift, Calendar, TrendingUp, Loader2, ArrowLeft, Flag,
} from 'lucide-react'
import { cn, getApiErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Goal {
    id: number
    name: string
    target_value: number
    current_value: number
    period: string
    status: 'active' | 'completed' | 'expired'
    start_date?: string
    end_date?: string
}

interface Campaign {
    id: number
    name: string
    description?: string
    start_date: string
    end_date: string
    bonus_value: number
    status: 'active' | 'upcoming' | 'ended'
    progress?: number
}

export default function TechGoalsPage() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'goals' | 'campaigns'>('goals')
    const [goals, setGoals] = useState<Goal[]>([])
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true)
                
                const [goalsRes, campaignsRes] = await Promise.all([
                    api.get('/commission-goals', { params: { my: '1' } }).catch(() => ({ data: { data: [] } })),
                    api.get('/commission-campaigns', { params: { active: '1' } }).catch(() => ({ data: { data: [] } })),
                ])

                setGoals(goalsRes.data?.data || [])
                setCampaigns(campaignsRes.data?.data || [])
            } catch (err: unknown) {
                toast.error(getApiErrorMessage(err, 'Erro ao carregar dados'))
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('pt-BR')
    }

    const getGoalStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
            case 'completed':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'expired':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30'
            default:
                return 'bg-surface-100 text-surface-700'
        }
    }

    const getGoalStatusLabel = (status: string) => {
        switch (status) {
            case 'active':
                return 'Ativa'
            case 'completed':
                return 'Concluída'
            case 'expired':
                return 'Expirada'
            default:
                return status
        }
    }

    const getCampaignStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
            case 'upcoming':
                return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
            case 'ended':
                return 'bg-surface-100 text-surface-700'
            default:
                return 'bg-surface-100 text-surface-700'
        }
    }

    const getCampaignStatusLabel = (status: string) => {
        switch (status) {
            case 'active':
                return 'Ativa'
            case 'upcoming':
                return 'Em Breve'
            case 'ended':
                return 'Encerrada'
            default:
                return status
        }
    }

    const calculateProgress = (current: number, target: number) => {
        if (target === 0) return 0
        return Math.min((current / target) * 100, 100)
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-surface-600" />
                        </button>
                        <h1 className="text-lg font-bold text-foreground">
                            Metas e Campanhas
                        </h1>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <div className="flex items-center gap-3 mb-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600" />
                    </button>
                    <h1 className="text-lg font-bold text-foreground">
                        Metas e Campanhas
                    </h1>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('goals')}
                        className={cn(
                            'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeTab === 'goals'
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-100 text-surface-600'
                        )}
                    >
                        Metas
                    </button>
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={cn(
                            'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeTab === 'campaigns'
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-100 text-surface-600'
                        )}
                    >
                        Campanhas
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {activeTab === 'goals' ? (
                    <>
                        {goals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Target className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhuma meta encontrada</p>
                            </div>
                        ) : (
                            goals.map((goal) => {
                                const progress = calculateProgress(goal.current_value, goal.target_value)
                                
                                return (
                                    <div
                                        key={goal.id}
                                        className="bg-card rounded-xl p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Target className="w-4 h-4 text-brand-600" />
                                                    <h3 className="text-sm font-semibold text-foreground">
                                                        {goal.name}
                                                    </h3>
                                                </div>
                                                <p className="text-xs text-surface-500">
                                                    Período: {goal.period}
                                                </p>
                                            </div>
                                            <span className={cn(
                                                'px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap',
                                                getGoalStatusColor(goal.status)
                                            )}>
                                                {getGoalStatusLabel(goal.status)}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-surface-600">
                                                    {goal.current_value.toLocaleString('pt-BR')} / {goal.target_value.toLocaleString('pt-BR')}
                                                </span>
                                                <span className="font-semibold text-foreground">
                                                    {progress.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-600 rounded-full transition-all"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </>
                ) : (
                    <>
                        {campaigns.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Gift className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhuma campanha encontrada</p>
                            </div>
                        ) : (
                            campaigns.map((campaign) => (
                                <div
                                    key={campaign.id}
                                    className="bg-card rounded-xl p-4"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Gift className="w-4 h-4 text-purple-500" />
                                                <h3 className="text-sm font-semibold text-foreground">
                                                    {campaign.name}
                                                </h3>
                                            </div>
                                            {campaign.description && (
                                                <p className="text-xs text-surface-500 mt-1">
                                                    {campaign.description}
                                                </p>
                                            )}
                                        </div>
                                        <span className={cn(
                                            'px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap',
                                            getCampaignStatusColor(campaign.status)
                                        )}>
                                            {getCampaignStatusLabel(campaign.status)}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs text-surface-600">
                                            <Calendar className="w-3 h-3" />
                                            <span>
                                                {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Trophy className="w-4 h-4 text-amber-500" />
                                                <span className="text-sm font-semibold text-foreground">
                                                    Bônus: {formatCurrency(campaign.bonus_value)}
                                                </span>
                                            </div>
                                        </div>

                                        {campaign.progress !== undefined && campaign.status === 'active' && (
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-surface-600">Progresso</span>
                                                    <span className="font-semibold text-foreground">
                                                        {campaign.progress.toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-brand-600 rounded-full transition-all"
                                                        style={{ width: `${campaign.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
