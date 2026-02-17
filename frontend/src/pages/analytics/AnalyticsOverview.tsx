import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
    ChartCard,
    ChartCardSkeleton,
    KpiCardSpark,
    TrendAreaChart,
    DonutChart,
} from '@/components/charts'
import {
    Activity,
    TrendingUp,
    DollarSign,
    Users,
    FileText,
    AlertTriangle,
    Wrench,
    Target,
    ArrowDownToLine,
    ArrowUpFromLine,
    CheckCircle2,
    XCircle,
    Calendar,
} from 'lucide-react'

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const PCT = (v: number) => `${v.toFixed(1)}%`

interface AnalyticsOverviewProps {
    from: string
    to: string
}

// ... (imports permanecem) ...

// Mapeamento de Cores Semântico (Dark Mode Friendly)
function statusColor(status: string): string {
    const m: Record<string, string> = {
        pending: 'var(--color-warning)',      // Amber
        in_progress: 'var(--color-info)',     // Blue/Cyan
        completed: 'var(--color-success)',    // Green
        cancelled: 'var(--color-danger)',     // Red
        on_hold: 'var(--color-brand-400)',    // Brand light
        waiting_parts: 'var(--color-surface-400)', // Gray/Orange mismatch fixed to Neutral
        draft: 'var(--color-surface-300)',    // Gray
    }
    return m[status] ?? 'var(--color-surface-400)'
}

export function AnalyticsOverview({ from, to }: AnalyticsOverviewProps) {
    // ... hooks ...
    const { data: summary, isLoading: loadingSummary } = useQuery({
        queryKey: ['analytics-summary', from, to],
        queryFn: () => api.get('/analytics/executive-summary', { params: { from, to } }).then(r => r.data),
    })

    const { data: trends, isLoading: loadingTrends } = useQuery({
        queryKey: ['analytics-trends'],
        queryFn: () => api.get('/analytics/trends').then(r => r.data),
    })

    const op = summary?.operational
    const fin = summary?.financial
    const com = summary?.commercial
    const assets = summary?.assets

    const osByStatus = (trends?.os_by_status ?? []).map((s: any) => ({
        name: statusLabel(s.status),
        value: s.total,
        color: statusColor(s.status),
    }))

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ═══ SEÇÃO 1: Resumo Executivo ═══ */}
            <section>
                <h2 className="text-lg font-semibold text-surface-800 mb-3 flex items-center gap-2">
                    <Target className="h-5 w-5 text-brand-500" />
                    Resumo Executivo
                </h2>
                {loadingSummary ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => <ChartCardSkeleton key={i} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KpiCardSpark
                            label="Ordens de Serviço"
                            value={op?.total_os ?? 0}
                            icon={<Wrench className="h-4 w-4" />}
                            current={op?.total_os}
                            previous={op?.prev_total_os}
                            sparkColor="var(--color-brand-500)"
                        />
                        <KpiCardSpark
                            label="Taxa Conclusão OS"
                            value={PCT(op?.completion_rate ?? 0)}
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            sparkColor="var(--color-success)"
                        />
                        <KpiCardSpark
                            label="Receita Recebida"
                            value={BRL(fin?.total_received ?? 0)}
                            icon={<ArrowDownToLine className="h-4 w-4" />}
                            current={fin?.total_received}
                            previous={fin?.prev_total_received}
                            sparkColor="var(--color-info)"
                        />
                        <KpiCardSpark
                            label="Inadimplência"
                            value={BRL(fin?.total_overdue ?? 0)}
                            icon={<AlertTriangle className="h-4 w-4" />}
                            sparkColor="var(--color-danger)"
                            invert
                        />
                        <KpiCardSpark
                            label="Orçamentos"
                            value={com?.total_quotes ?? 0}
                            icon={<FileText className="h-4 w-4" />}
                            current={com?.total_quotes}
                            previous={com?.prev_total_quotes}
                            sparkColor="var(--color-warning)"
                        />
                        <KpiCardSpark
                            label="Conversão Orçamento"
                            value={PCT(com?.conversion_rate ?? 0)}
                            icon={<TrendingUp className="h-4 w-4" />}
                            current={com?.conversion_rate}
                            previous={com?.prev_conversion_rate}
                            sparkColor="var(--color-brand-400)"
                        />
                        <KpiCardSpark
                            label="Novos Clientes"
                            value={com?.new_customers ?? 0}
                            icon={<Users className="h-4 w-4" />}
                            sparkColor="var(--color-success)"
                        />
                        <KpiCardSpark
                            label="Despesas Aprovadas"
                            value={BRL(fin?.total_expenses ?? 0)}
                            icon={<ArrowUpFromLine className="h-4 w-4" />}
                            current={fin?.total_expenses}
                            previous={fin?.prev_total_expenses}
                            sparkColor="var(--color-warning)"
                            invert
                        />
                    </div>
                )}
            </section>

            {/* ═══ SEÇÃO 2: Pulso Operacional ═══ */}
            <section>
                <h2 className="text-lg font-semibold text-surface-800 mb-3 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    Pulso Operacional
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <ChartCard title="Evolução Mensal de OS" className="lg:col-span-2">
                        {loadingTrends ? (
                            <ChartCardSkeleton />
                        ) : (
                            <TrendAreaChart
                                data={trends?.monthly ?? []}
                                xKey="month"
                                series={[
                                    { key: 'os_total', label: 'Total', color: 'var(--color-brand-500)' },
                                    { key: 'os_completed', label: 'Concluídas', color: 'var(--color-success)' },
                                ]}
                                height={280}
                            />
                        )}
                    </ChartCard>
                    <ChartCard title="OS por Status">
                        {loadingTrends ? (
                            <ChartCardSkeleton />
                        ) : (
                            <DonutChart
                                data={osByStatus}
                                centerLabel="Total"
                                centerValue={osByStatus.reduce((s: number, d: any) => s + d.value, 0)}
                                height={220}
                            />
                        )}
                    </ChartCard>
                </div>
            </section>

            {/* ═══ SEÇÃO 3: Radar Comercial ═══ */}
            <section>
                <h2 className="text-lg font-semibold text-surface-800 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-violet-500" />
                    Radar Comercial
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ChartCard title="Orçamentos — Evolução Mensal">
                        {loadingTrends ? (
                            <ChartCardSkeleton />
                        ) : (
                            <TrendAreaChart
                                data={trends?.monthly ?? []}
                                xKey="month"
                                series={[
                                    { key: 'quotes_total', label: 'Total', color: 'var(--color-warning)' },
                                    { key: 'quotes_approved', label: 'Aprovados', color: 'var(--color-success)' },
                                ]}
                                height={260}
                            />
                        )}
                    </ChartCard>
                    <ChartCard title="Novos Clientes — Evolução Mensal">
                        {loadingTrends ? (
                            <ChartCardSkeleton />
                        ) : (
                            <TrendAreaChart
                                data={trends?.monthly ?? []}
                                xKey="month"
                                series={[
                                    { key: 'new_customers', label: 'Novos Clientes', color: 'var(--color-brand-600)' },
                                ]}
                                height={260}
                            />
                        )}
                    </ChartCard>
                </div>

                {/* KPIs Comerciais */}
                {!loadingSummary && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-amber-500" />
                                <span className="text-xs font-medium text-surface-500 uppercase">Valor Orçado</span>
                            </div>
                            <p className="text-xl font-bold text-surface-900">{BRL(com?.quotes_value ?? 0)}</p>
                        </div>
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4 text-violet-500" />
                                <span className="text-xs font-medium text-surface-500 uppercase">Clientes Ativos</span>
                            </div>
                            <p className="text-xl font-bold text-surface-900">{com?.total_active_customers ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-cyan-500" />
                                <span className="text-xs font-medium text-surface-500 uppercase">Chamados</span>
                            </div>
                            <p className="text-xl font-bold text-surface-900">{op?.total_service_calls ?? 0}</p>
                            <p className="text-xs text-surface-400 mt-1">{op?.sc_completed ?? 0} concluídos</p>
                        </div>
                    </div>
                )}
            </section>

            {/* ═══ SEÇÃO 4: Comando Financeiro ═══ */}
            <section>
                <h2 className="text-lg font-semibold text-surface-800 mb-3 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                    Comando Financeiro
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <ChartCard title="Receita vs Despesas vs Lucro" className="lg:col-span-2">
                        {loadingTrends ? (
                            <ChartCardSkeleton />
                        ) : (
                            <TrendAreaChart
                                data={trends?.monthly ?? []}
                                xKey="month"
                                series={[
                                    { key: 'revenue', label: 'Receita', color: 'var(--color-success)' },
                                    { key: 'expenses', label: 'Despesas', color: 'var(--color-danger)' },
                                    { key: 'profit', label: 'Lucro', color: 'var(--color-brand-500)', dashed: true },
                                ]}
                                height={280}
                                formatValue={BRL}
                            />
                        )}
                    </ChartCard>
                    <div className="space-y-4">
                        {/* Saldo Líquido */}
                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <div className="flex items-center gap-2 mb-3">
                                <DollarSign className="h-5 w-5 text-emerald-500" />
                                <span className="text-sm font-medium text-surface-500">Saldo Líquido (período)</span>
                            </div>
                            <p className={`text-2xl font-bold ${(fin?.net_balance ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {BRL(fin?.net_balance ?? 0)}
                            </p>
                        </div>

                        {/* Contas a Receber */}
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="text-xs font-medium text-surface-500 uppercase mb-2">Contas a Receber</div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm text-surface-600">Total:</span>
                                <span className="font-bold text-surface-900">{BRL(fin?.total_receivable ?? 0)}</span>
                            </div>
                            <div className="flex justify-between items-baseline mt-1">
                                <span className="text-sm text-surface-600">Recebido:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{BRL(fin?.total_received ?? 0)}</span>
                            </div>
                            <div className="flex justify-between items-baseline mt-1">
                                <span className="text-sm text-surface-600">Em atraso:</span>
                                <span className="font-bold text-red-600 dark:text-red-400">{BRL(fin?.total_overdue ?? 0)}</span>
                            </div>
                        </div>

                        {/* Contas a Pagar */}
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="text-xs font-medium text-surface-500 uppercase mb-2">Contas a Pagar</div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm text-surface-600">Total:</span>
                                <span className="font-bold text-surface-900">{BRL(fin?.total_payable ?? 0)}</span>
                            </div>
                            <div className="flex justify-between items-baseline mt-1">
                                <span className="text-sm text-surface-600">Pago:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{BRL(fin?.total_paid ?? 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ SEÇÃO 5: Ativos & Equipamentos ═══ */}
            {!loadingSummary && (
                <section>
                    <h2 className="text-lg font-semibold text-surface-800 mb-3 flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-amber-500" />
                        Ativos & Equipamentos
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-2 mb-2">
                                <Wrench className="h-4 w-4 text-brand-500" />
                                <span className="text-xs font-medium text-surface-500 uppercase">Equipamentos Ativos</span>
                            </div>
                            <p className="text-2xl font-bold text-surface-900">{assets?.total_equipments ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <span className="text-xs font-medium text-surface-500 uppercase">Calibrações em 30 dias</span>
                            </div>
                            <p className={`text-2xl font-bold ${(assets?.calibrations_due_30 ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-surface-900'}`}>
                                {assets?.calibrations_due_30 ?? 0}
                            </p>
                        </div>
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-2 mb-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-xs font-medium text-surface-500 uppercase">OS Pendentes</span>
                            </div>
                            <p className="text-2xl font-bold text-surface-900">{op?.os_pending ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-2 mb-2">
                                <XCircle className="h-4 w-4 text-surface-400" />
                                <span className="text-xs font-medium text-surface-500 uppercase">OS Canceladas</span>
                            </div>
                            <p className="text-2xl font-bold text-surface-900">{op?.os_cancelled ?? 0}</p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}

function statusLabel(status: string): string {
    const m: Record<string, string> = {
        pending: 'Pendente',
        in_progress: 'Em Andamento',
        completed: 'Concluída',
        cancelled: 'Cancelada',
        on_hold: 'Em Espera',
        waiting_parts: 'Aguardando Peças',
        draft: 'Rascunho',
    }
    return m[status] ?? status
}
