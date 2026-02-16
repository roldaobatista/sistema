import React, { useState } from 'react'
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import {
    BarChart3, Users, AlertTriangle, TrendingUp, Clock,
    CheckCircle, Inbox, Target, ArrowRight, Wrench,
    Phone, FileText, DollarSign, Scale, Percent,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'

// ── Configuração de tipos ──

const tipoIcons: Record<string, any> = {
    os: Wrench, chamado: Phone, orçamento: FileText,
    financeiro: DollarSign, calibração: Scale,
    contrato: FileText, tarefa: CheckCircle, lembrete: Clock,
}

const tipoColors: Record<string, string> = {
    os: 'text-blue-600 bg-blue-50',
    chamado: 'text-cyan-600 bg-cyan-50',
    orçamento: 'text-amber-600 bg-amber-50',
    financeiro: 'text-emerald-600 bg-emerald-50',
    calibração: 'text-indigo-600 bg-indigo-50',
    contrato: 'text-rose-600 bg-rose-50',
    tarefa: 'text-surface-600 bg-surface-50',
    lembrete: 'text-surface-500 bg-surface-50',
}

export function CentralDashboardPage() {

  // MVP: Action feedback
  const handleAction = () => { toast.success('Ação realizada com sucesso') }

  // MVP: Search
  const [searchTerm, setSearchTerm] = useState('')
  const { hasPermission } = useAuthStore()

    const { data: kpisRes, isLoading: loadingKpis } = useQuery({
        queryKey: ['central-kpis'],
        queryFn: () => api.get('/central/kpis'),
        refetchInterval: 60000,
    })
    const kpis = kpisRes?.data?.data ?? {}

    const { data: workloadRes, isLoading: loadingWorkload } = useQuery({
        queryKey: ['central-workload'],
        queryFn: () => api.get('/central/workload'),
        refetchInterval: 60000,
    })
    const workload: any[] = workloadRes?.data?.data ?? []

    const { data: overdueRes, isLoading: loadingOverdue } = useQuery({
        queryKey: ['central-overdue-by-team'],
        queryFn: () => api.get('/central/overdue-by-team'),
        refetchInterval: 60000,
    })
    const overdueByTeam: any[] = overdueRes?.data?.data ?? []

    const isLoading = loadingKpis || loadingWorkload || loadingOverdue

    // ── KPI Cards config ──
    const kpiCards = [
        { label: 'Total', value: kpis.total ?? 0, icon: Inbox, color: 'text-surface-700', bg: 'bg-surface-100' },
        { label: 'Abertas', value: kpis.abertas ?? 0, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Em Andamento', value: kpis.em_andamento ?? 0, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Concluídas', value: kpis.concluidas ?? 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Atrasadas', value: kpis.atrasadas ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Taxa Conclusão', value: `${kpis.taxa_conclusao ?? 0}%`, icon: Percent, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Tempo Médio', value: `${kpis.tempo_medio_horas ?? 0}h`, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
    ]

    // Max workload for bar chart scaling
    const maxWorkload = Math.max(1, ...workload.map(w => w.total))

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Dashboard Gerencial</h1>
                    <p className="mt-0.5 text-sm text-surface-500">Visão analítica da Central de Trabalho</p>
                </div>
                <Link to="/central"
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700">
                    <Inbox className="h-4 w-4" /> Ver Central
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-10 w-10 animate-spin rounded-full border-3 border-brand-500 border-t-transparent" />
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
                        {kpiCards.map(k => {
                            const Icon = k.icon
                            return (
                                <div key={k.label} className="rounded-xl border border-default bg-surface-0 p-4 shadow-card transition-shadow">
                                    <div className={`mb-2 inline-flex rounded-lg p-2 ${k.bg}`}>
                                        <Icon className={`h-5 w-5 ${k.color}`} />
                                    </div>
                                    <p className="text-lg font-semibold text-surface-900 tracking-tight">{k.value}</p>
                                    <p className="text-xs text-surface-500 mt-0.5">{k.label}</p>
                                </div>
                            )
                        })}
                    </div>

                    {/* Two columns */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Workload by User */}
                        <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="h-5 w-5 text-brand-500" />
                                <h2 className="text-lg font-semibold text-surface-900">Carga por Responsável</h2>
                            </div>
                            {workload.length === 0 ? (
                                <p className="text-sm text-surface-400 py-8 text-center">Nenhum responsável com itens pendentes</p>
                            ) : (
                                <div className="space-y-3">
                                    {workload.map((w: any) => (
                                        <div key={w.user_id} className="group">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-surface-700 truncate">{w.nome}</span>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-surface-500">{w.total} itens</span>
                                                    {(w.atrasadas ?? 0) > 0 && (
                                                        <Badge variant="danger">{w.atrasadas} atrasadas</Badge>
                                                    )}
                                                    {(w.urgentes ?? 0) > 0 && (
                                                        <Badge variant="warning">{w.urgentes} urgentes</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-100">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
                                                    style={{ width: `${Math.max(4, (w.total / maxWorkload) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Overdue by Type */}
                        <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                <h2 className="text-lg font-semibold text-surface-900">Atrasos por Tipo</h2>
                            </div>
                            {overdueByTeam.length === 0 ? (
                                <div className="flex flex-col items-center py-8">
                                    <CheckCircle className="h-10 w-10 text-emerald-400 mb-2" />
                                    <p className="text-sm text-surface-500">Nenhum item atrasado! 🎉</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {overdueByTeam.map((row: any) => {
                                        const Icon = tipoIcons[row.tipo] ?? FileText
                                        const colors = tipoColors[row.tipo] ?? 'text-surface-600 bg-surface-50'
                                        return (
                                            <div key={row.tipo} className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50/30 p-3">
                                                <div className={`rounded-lg p-2 ${colors}`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-surface-800 capitalize">{row.tipo}</p>
                                                    <p className="text-xs text-surface-500">
                                                        Atraso médio: <span className="font-semibold text-red-600">{row.atraso_medio_horas}h</span>
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-bold text-red-600">{row.total}</p>
                                                    <p className="text-xs text-surface-400">itens</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
