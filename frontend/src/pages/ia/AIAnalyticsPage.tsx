import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    Brain,
    Wrench,
    Receipt,
    MessageSquare,
    SmilePlus,
    DollarSign,
    AlertTriangle,
    Mic,
    FileText,
    Users,
    Camera,
    TrendingUp,
    MapPin,
    Tag,
    UserX,
    ClipboardList,
    Loader2,
    AlertCircle,
    Inbox,
} from 'lucide-react'
import {
import { useAuthStore } from '@/stores/auth-store'
    usePredictiveMaintenance,
    useExpenseOcrAnalysis,
    useTriageSuggestions,
    useSentimentAnalysis,
    useDynamicPricing,
    useFinancialAnomalies,
    useVoiceCommands,
    useNaturalLanguageReport,
    useCustomerClustering,
    useEquipmentImageAnalysis,
    useDemandForecast,
    useAIRouteOptimization,
    useSmartTicketLabeling,
    useChurnPrediction,
} from '@/hooks/useAIAnalytics'

const TABS = [
    { id: 'predictive', label: 'Preditiva', icon: Wrench },
    { id: 'expenses', label: 'Despesas', icon: Receipt },
    { id: 'triage', label: 'Triagem', icon: MessageSquare },
    { id: 'sentiment', label: 'Sentimento', icon: SmilePlus },
    { id: 'pricing', label: 'Preços', icon: DollarSign },
    { id: 'anomalies', label: 'Anomalias', icon: AlertTriangle },
    { id: 'voice', label: 'Voz', icon: Mic },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'clusters', label: 'Clusters', icon: Users },
    { id: 'images', label: 'Imagens', icon: Camera },
    { id: 'demand', label: 'Demanda', icon: TrendingUp },
    { id: 'routes', label: 'Rotas', icon: MapPin },
    { id: 'tickets', label: 'Tickets', icon: Tag },
    { id: 'churn', label: 'Churn', icon: UserX },
    { id: 'summary', label: 'Resumos', icon: ClipboardList },
] as const

type TabId = typeof TABS[number]['id']

// ─── Loading / Empty / Error ──────────────────────
function LoadingState() {
    return (
        <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            <span className="ml-2 text-sm text-surface-500">Analisando dados...</span>
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-surface-400">
            <Inbox className="h-10 w-10 mb-2" />
            <p className="text-sm">{message}</p>
        </div>
    )
}

function ErrorState({ message }: { message?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-red-500">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="text-sm">{message || 'Erro ao carregar dados'}</p>
        </div>
    )
}

function MetricCard({ label, value, sub, color = 'brand' }: { label: string; value: string | number; sub?: string; color?: string }) {
    const colorMap: Record<string, string> = {
        brand: 'bg-brand-50 border-brand-200 text-brand-700',
        green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        red: 'bg-red-50 border-red-200 text-red-700',
        amber: 'bg-amber-50 border-amber-200 text-amber-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
    }
    return (
        <div className={cn('rounded-lg border p-4', colorMap[color] || colorMap.brand)}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
        </div>
    )
}

function RiskBadge({ level }: { level: string }) {
    const map: Record<string, string> = {
        critical: 'bg-red-100 text-red-700',
        high: 'bg-orange-100 text-orange-700',
        medium: 'bg-amber-100 text-amber-700',
        low: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
    }
    return (
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', map[level] || 'bg-surface-100 text-surface-600')}>
            {level}
        </span>
    )
}

// ─── Tab panels ───────────────────────────────────

function PredictiveTab() {
    const { data, isLoading, isError } = usePredictiveMaintenance()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.predictions?.length) return <EmptyState message="Sem dados de manutenção preditiva" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                <MetricCard label="Analisados" value={data.total_analyzed} />
                <MetricCard label="Críticos" value={data.critical_count} color="red" />
                <MetricCard label="Alto Risco" value={data.high_count} color="amber" />
                <MetricCard label="Total Alertas" value={data.predictions.length} color="blue" />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-surface-200 text-left text-xs font-semibold text-surface-500 uppercase tracking-wide">
                            <th className="pb-2 pr-3">Equipamento</th>
                            <th className="pb-2 pr-3">Série</th>
                            <th className="pb-2 pr-3">Última Calibração</th>
                            <th className="pb-2 pr-3">Próxima Prevista</th>
                            <th className="pb-2 pr-3">Dias</th>
                            <th className="pb-2">Risco</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.predictions.map((p: Record<string, unknown>, i: number) => (
                            <tr key={i} className="border-b border-surface-100 hover:bg-surface-50">
                                <td className="py-2 pr-3 font-medium">{p.equipment_name as string}</td>
                                <td className="py-2 pr-3 text-surface-500">{(p.serial_number as string) || '—'}</td>
                                <td className="py-2 pr-3">{p.last_calibration as string}</td>
                                <td className="py-2 pr-3">{p.predicted_next as string}</td>
                                <td className="py-2 pr-3">{p.days_until_next as number}</td>
                                <td className="py-2"><RiskBadge level={p.risk_level as string} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function ExpensesTab() {
    const { data, isLoading, isError } = useExpenseOcrAnalysis()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.total_expenses) return <EmptyState message="Sem dados de despesas para análise" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                <MetricCard label="Total Despesas" value={data.total_expenses} />
                <MetricCard label="Valor Total" value={`R$ ${Number(data.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="blue" />
                <MetricCard label="Duplicatas Potenciais" value={data.duplicate_count} color={data.duplicate_count > 0 ? 'red' : 'green'} />
                <MetricCard label="Sem Comprovante" value={`${data.without_receipt_pct}%`} color={data.without_receipt_pct > 20 ? 'amber' : 'green'} />
            </div>
            {data.potential_duplicates?.length > 0 && (
                <div className="mt-4">
                    <h4 className="text-sm font-semibold text-surface-700 mb-2">⚠️ Duplicatas Potenciais</h4>
                    <div className="space-y-2">
                        {data.potential_duplicates.map((d: Record<string, unknown>, i: number) => (
                            <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                                <span className="font-medium">R$ {Number(d.amount).toFixed(2)}</span> em <span className="font-medium">{d.date as string}</span> — {d.count as number} registros
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function TriageTab() {
    const { data, isLoading, isError } = useTriageSuggestions()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.total_calls_analyzed) return <EmptyState message="Sem chamados recentes para análise" />

    return (
        <div>
            <MetricCard label="Chamados Analisados" value={data.total_calls_analyzed} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                    <h4 className="text-sm font-semibold text-surface-700 mb-2">Padrões por Tipo</h4>
                    {Object.entries(data.type_patterns || {}).map(([type, info]) => (
                        <div key={type} className="flex justify-between border-b border-surface-100 py-1.5 text-sm">
                            <span>{type || 'Sem tipo'}</span>
                            <span className="text-surface-500">{(info as Record<string, number>).count}x</span>
                        </div>
                    ))}
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-surface-700 mb-2">Horários de Pico</h4>
                    {Object.entries(data.peak_hours || {}).map(([hour, count]) => (
                        <div key={hour} className="flex justify-between border-b border-surface-100 py-1.5 text-sm">
                            <span>{hour}h</span>
                            <span className="text-surface-500">{count as number}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function SentimentTab() {
    const { data, isLoading, isError } = useSentimentAnalysis()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.total_ratings) return <EmptyState message="Sem avaliações para análise de sentimento" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                <MetricCard label="NPS" value={data.nps_score ?? '—'} color={data.nps_score >= 50 ? 'green' : data.nps_score >= 0 ? 'amber' : 'red'} sub={data.sentiment_label} />
                <MetricCard label="Promotores" value={data.promoters} color="green" />
                <MetricCard label="Neutros" value={data.neutrals} color="blue" />
                <MetricCard label="Detratores" value={data.detractors} color="red" />
            </div>
            {data.avg_resolution_hours && (
                <MetricCard label="Tempo Médio Resolução" value={`${data.avg_resolution_hours}h`} color="blue" />
            )}
        </div>
    )
}

function PricingTab() {
    const { data, isLoading, isError } = useDynamicPricing()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.suggestions?.length) return <EmptyState message="Sem dados suficientes para sugestão de preços" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
                <MetricCard label="Itens Analisados" value={data.total_items_analyzed} />
                <MetricCard label="Serviços" value={data.services_analyzed} color="blue" />
                <MetricCard label="Produtos" value={data.products_analyzed} color="green" />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-surface-200 text-left text-xs font-semibold text-surface-500 uppercase tracking-wide">
                            <th className="pb-2 pr-3">ID</th>
                            <th className="pb-2 pr-3">Transações</th>
                            <th className="pb-2 pr-3">Média Atual</th>
                            <th className="pb-2 pr-3">Sugerido</th>
                            <th className="pb-2">Confiança</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.suggestions.map((s: Record<string, unknown>, i: number) => (
                            <tr key={i} className="border-b border-surface-100 hover:bg-surface-50">
                                <td className="py-2 pr-3 font-medium">#{s.item_id as number}</td>
                                <td className="py-2 pr-3">{s.transactions as number}</td>
                                <td className="py-2 pr-3">R$ {Number(s.current_avg).toFixed(2)}</td>
                                <td className="py-2 pr-3 font-semibold text-brand-600">R$ {Number(s.suggested_price).toFixed(2)}</td>
                                <td className="py-2"><RiskBadge level={s.confidence as string} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function AnomaliesTab() {
    const { data, isLoading, isError } = useFinancialAnomalies()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.anomalies?.length) return <EmptyState message="Nenhuma anomalia financeira detectada ✅" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                <MetricCard label="Analisadas" value={data.total_analyzed} />
                <MetricCard label="Anomalias" value={data.anomaly_count} color="red" />
                <MetricCard label="Média" value={`R$ ${Number(data.stats?.mean).toFixed(2)}`} color="blue" />
                <MetricCard label="Limite Superior" value={`R$ ${Number(data.stats?.upper_bound).toFixed(2)}`} color="amber" />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-surface-200 text-left text-xs font-semibold text-surface-500 uppercase tracking-wide">
                            <th className="pb-2 pr-3">Data</th>
                            <th className="pb-2 pr-3">Valor</th>
                            <th className="pb-2 pr-3">Z-Score</th>
                            <th className="pb-2 pr-3">Tipo</th>
                            <th className="pb-2">Severidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.anomalies.map((a: Record<string, unknown>, i: number) => (
                            <tr key={i} className="border-b border-surface-100 hover:bg-surface-50">
                                <td className="py-2 pr-3">{a.date as string}</td>
                                <td className="py-2 pr-3 font-medium">R$ {Number(a.amount).toFixed(2)}</td>
                                <td className="py-2 pr-3">{a.z_score as number}</td>
                                <td className="py-2 pr-3 text-surface-500">{a.anomaly_type as string}</td>
                                <td className="py-2"><RiskBadge level={a.severity as string} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function VoiceTab() {
    const { data, isLoading, isError } = useVoiceCommands()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />

    return (
        <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
                <MetricCard label="OS Pendentes" value={data?.context?.pending_work_orders ?? 0} />
                <MetricCard label="Chamados Abertos" value={data?.context?.open_service_calls ?? 0} color="amber" />
                <MetricCard label="Despesas Pendentes" value={data?.context?.pending_expenses ?? 0} color="blue" />
            </div>
            <h4 className="text-sm font-semibold text-surface-700 mb-2">Comandos Sugeridos</h4>
            <div className="space-y-1.5">
                {(data?.suggested_commands || []).map((cmd: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm">
                        <Mic className="h-4 w-4 text-brand-500 shrink-0" />
                        <span className="font-medium">&quot;{cmd.command as string}&quot;</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function ReportsTab() {
    const [period, setPeriod] = useState<string>('month')
    const { data, isLoading, isError } = useNaturalLanguageReport(period)
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />

    return (
        <div>
            <div className="flex gap-2 mb-4">
                {['week', 'month', 'quarter', 'year'].map(p => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            period === p ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                        )}
                    >
                        {p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : p === 'quarter' ? 'Trimestre' : 'Ano'}
                    </button>
                ))}
            </div>
            {data?.metrics && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                    <MetricCard label="OS Total" value={data.metrics.os_total} />
                    <MetricCard label="Concluídas" value={data.metrics.os_completed} color="green" />
                    <MetricCard label="Faturamento" value={`R$ ${Number(data.metrics.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="blue" />
                    <MetricCard label="Lucro" value={`R$ ${Number(data.metrics.profit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color={data.metrics.profit >= 0 ? 'green' : 'red'} />
                </div>
            )}
            {data?.report_text && (
                <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                    {data.report_text}
                </div>
            )}
        </div>
    )
}

function ClustersTab() {
    const { data, isLoading, isError } = useCustomerClustering()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.clusters?.length) return <EmptyState message="Sem clientes suficientes para clusterização" />

    const segmentColors: Record<string, string> = {
        'Champions': 'green',
        'Loyal Customers': 'blue',
        'Potential Loyalists': 'brand',
        'At Risk': 'amber',
        'Hibernating': 'red',
    }

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mb-4">
                {Object.entries(data.segment_summary || {}).map(([segment, info]) => (
                    <MetricCard
                        key={segment}
                        label={segment}
                        value={(info as Record<string, number>).count}
                        sub={`Média R$ ${Number((info as Record<string, number>).avg_monetary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        color={segmentColors[segment] || 'brand'}
                    />
                ))}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-surface-200 text-left text-xs font-semibold text-surface-500 uppercase tracking-wide">
                            <th className="pb-2 pr-3">Cliente</th>
                            <th className="pb-2 pr-3">Recência</th>
                            <th className="pb-2 pr-3">Frequência</th>
                            <th className="pb-2 pr-3">Monetário</th>
                            <th className="pb-2 pr-3">Score</th>
                            <th className="pb-2">Segmento</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.clusters.slice(0, 20).map((c: Record<string, unknown>, i: number) => (
                            <tr key={i} className="border-b border-surface-100 hover:bg-surface-50">
                                <td className="py-2 pr-3 font-medium">{c.customer_name as string}</td>
                                <td className="py-2 pr-3">{c.recency_days as number}d</td>
                                <td className="py-2 pr-3">{c.frequency as number}</td>
                                <td className="py-2 pr-3">R$ {Number(c.monetary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="py-2 pr-3 font-semibold">{c.total_score as number}</td>
                                <td className="py-2"><RiskBadge level={c.segment as string} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function ImagesTab() {
    const { data, isLoading, isError } = useEquipmentImageAnalysis()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.total_equipments) return <EmptyState message="Sem equipamentos para análise" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                <MetricCard label="Total Equipamentos" value={data.total_equipments} />
                <MetricCard label="Com Fotos" value={data.with_photos} color="green" />
                <MetricCard label="Sem Fotos" value={data.without_photos} color="red" />
                <MetricCard label="Cobertura" value={`${data.coverage_pct}%`} color={data.coverage_pct >= 80 ? 'green' : 'amber'} />
            </div>
            {data.missing_photos?.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-surface-700 mb-2">Equipamentos sem Registro Fotográfico</h4>
                    <div className="space-y-1.5">
                        {data.missing_photos.map((eq: Record<string, unknown>, i: number) => (
                            <div key={i} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                                <span className="font-medium">{eq.equipment_name as string}</span>
                                <span className="text-xs text-amber-600">{eq.recommendation as string}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function DemandTab() {
    const { data, isLoading, isError } = useDemandForecast()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.historical?.length) return <EmptyState message="Sem histórico suficiente para previsão" />

    const trendColor = data.trend === 'crescente' ? 'green' : data.trend === 'decrescente' ? 'red' : 'blue'

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
                <MetricCard label="Tendência" value={data.trend} color={trendColor} />
                <MetricCard label="Média Mensal" value={data.avg_monthly} color="blue" />
                <MetricCard label="Slope" value={data.trend_slope} color="brand" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <h4 className="text-sm font-semibold text-surface-700 mb-2">Histórico (12 meses)</h4>
                    {data.historical.map((h: Record<string, unknown>, i: number) => (
                        <div key={i} className="flex justify-between border-b border-surface-100 py-1.5 text-sm">
                            <span>{h.month as string}</span>
                            <span className="font-medium">{h.count as number} OS</span>
                        </div>
                    ))}
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-surface-700 mb-2">📈 Previsão (3 meses)</h4>
                    {data.forecast.map((f: Record<string, unknown>, i: number) => (
                        <div key={i} className="flex justify-between border-b border-surface-100 py-1.5 text-sm">
                            <span>{f.month as string}</span>
                            <span className="font-semibold text-brand-600">{f.predicted_count as number} OS</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function RoutesTab() {
    const { data, isLoading, isError } = useAIRouteOptimization()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.optimized_order?.length) return <EmptyState message="Nenhuma OS pendente para otimizar rotas" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
                <MetricCard label="OS Pendentes" value={data.total_pending} />
                <MetricCard label="Com Coordenadas" value={data.with_coordinates} color="green" />
                <MetricCard label="Sem Coordenadas" value={data.without_coordinates} color="amber" />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-surface-200 text-left text-xs font-semibold text-surface-500 uppercase tracking-wide">
                            <th className="pb-2 pr-3">#</th>
                            <th className="pb-2 pr-3">OS</th>
                            <th className="pb-2 pr-3">Cliente</th>
                            <th className="pb-2 pr-3">Prioridade</th>
                            <th className="pb-2 pr-3">Dias Aguardando</th>
                            <th className="pb-2">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.optimized_order.map((r: Record<string, unknown>, i: number) => (
                            <tr key={i} className="border-b border-surface-100 hover:bg-surface-50">
                                <td className="py-2 pr-3 text-surface-400">{i + 1}</td>
                                <td className="py-2 pr-3 font-medium">{r.work_order_number as string}</td>
                                <td className="py-2 pr-3">{r.customer_name as string}</td>
                                <td className="py-2 pr-3"><RiskBadge level={r.priority as string} /></td>
                                <td className="py-2 pr-3">{r.days_waiting as number}d</td>
                                <td className="py-2 font-semibold text-brand-600">{r.total_score as number}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function TicketsTab() {
    const { data, isLoading, isError } = useSmartTicketLabeling()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.labeled_tickets?.length) return <EmptyState message="Sem chamados para etiquetagem" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
                <MetricCard label="Analisados" value={data.total_analyzed} />
                <MetricCard label="Etiquetados" value={data.labeled_count} color="green" />
                <MetricCard label="Taxa" value={data.total_analyzed > 0 ? `${Math.round((data.labeled_count / data.total_analyzed) * 100)}%` : '0%'} color="blue" />
            </div>
            <div className="mb-4">
                <h4 className="text-sm font-semibold text-surface-700 mb-2">Distribuição de Tags</h4>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(data.tag_distribution || {}).map(([tag, count]) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
                            {tag} <span className="text-brand-400">({count as number})</span>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

function ChurnTab() {
    const { data, isLoading, isError } = useChurnPrediction()
    if (isLoading) return <LoadingState />
    if (isError) return <ErrorState />
    if (!data?.predictions?.length) return <EmptyState message="Nenhum cliente em risco de churn detectado ✅" />

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                <MetricCard label="Total Clientes" value={data.total_customers} />
                <MetricCard label="Em Risco" value={data.at_risk_count} color="amber" />
                <MetricCard label="Críticos" value={data.critical_count} color="red" />
                <MetricCard label="Taxa Risco" value={data.total_customers > 0 ? `${Math.round((data.at_risk_count / data.total_customers) * 100)}%` : '0%'} color="blue" />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-surface-200 text-left text-xs font-semibold text-surface-500 uppercase tracking-wide">
                            <th className="pb-2 pr-3">Cliente</th>
                            <th className="pb-2 pr-3">Última OS</th>
                            <th className="pb-2 pr-3">OS 12m</th>
                            <th className="pb-2 pr-3">Score</th>
                            <th className="pb-2 pr-3">Risco</th>
                            <th className="pb-2">Recomendação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.predictions.map((p: Record<string, unknown>, i: number) => (
                            <tr key={i} className="border-b border-surface-100 hover:bg-surface-50">
                                <td className="py-2 pr-3 font-medium">{p.customer_name as string}</td>
                                <td className="py-2 pr-3">{p.days_since_last_os as number}d atrás</td>
                                <td className="py-2 pr-3">{p.os_count_12m as number}</td>
                                <td className="py-2 pr-3 font-semibold">{p.churn_score as number}</td>
                                <td className="py-2 pr-3"><RiskBadge level={p.churn_risk as string} /></td>
                                <td className="py-2 text-xs text-surface-500 max-w-[200px] truncate">{p.recommendation as string}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function SummaryTab() {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-surface-400">
            <ClipboardList className="h-10 w-10 mb-2" />
            <p className="text-sm">Selecione uma OS na lista para gerar o resumo automatizado.</p>
            <p className="text-xs mt-1">Acesse a página da OS e utilize o botão &quot;Resumo IA&quot;.</p>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────

export default function AIAnalyticsPage() {
  const { hasPermission } = useAuthStore()

    const [activeTab, setActiveTab] = useState<TabId>('predictive')

    const tabContent: Record<TabId, React.ReactNode> = {
        predictive: <PredictiveTab />,
        expenses: <ExpensesTab />,
        triage: <TriageTab />,
        sentiment: <SentimentTab />,
        pricing: <PricingTab />,
        anomalies: <AnomaliesTab />,
        voice: <VoiceTab />,
        reports: <ReportsTab />,
        clusters: <ClustersTab />,
        images: <ImagesTab />,
        demand: <DemandTab />,
        routes: <RoutesTab />,
        tickets: <TicketsTab />,
        churn: <ChurnTab />,
        summary: <SummaryTab />,
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                    <Brain className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-surface-900">IA & Análise</h1>
                    <p className="text-xs text-surface-500">Inteligência artificial aplicada aos dados do sistema</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="overflow-x-auto -mx-4 px-4">
                <div className="flex gap-1 border-b border-surface-200 min-w-max">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap',
                                activeTab === tab.id
                                    ? 'border-brand-500 text-brand-600'
                                    : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                            )}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
                {tabContent[activeTab]}
            </div>
        </div>
    )
}
