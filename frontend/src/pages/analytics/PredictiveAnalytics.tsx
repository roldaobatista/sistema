import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ChartCard, ChartCardSkeleton, TrendAreaChart } from '@/components/charts'
import {
    BrainCircuit,
    Cpu,
    Search,
    AlertTriangle,
    TrendingUp,
    MessageSquare,
    ArrowRight,
    Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function PredictiveAnalytics() {
    const [activeTab, setActiveTab] = useState<'forecast' | 'anomalies' | 'nl'>('forecast')

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-default pb-2">
                <TabButton
                    active={activeTab === 'forecast'}
                    onClick={() => setActiveTab('forecast')}
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Previsão de Tendências"
                />
                <TabButton
                    active={activeTab === 'anomalies'}
                    onClick={() => setActiveTab('anomalies')}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    label="Detecção de Anomalias"
                />
                <TabButton
                    active={activeTab === 'nl'}
                    onClick={() => setActiveTab('nl')}
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="Pergunte aos Dados"
                />
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'forecast' && <ForecastSection />}
                {activeTab === 'anomalies' && <AnomaliesSection />}
                {activeTab === 'nl' && <NlSection />}
            </div>
        </div>
    )
}

function TabButton({ active, onClick, icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                    ? "bg-brand-50 text-brand-700 border border-brand-200"
                    : "text-surface-600 hover:bg-surface-50 hover:text-surface-900"
            )}
        >
            {icon}
            {label}
        </button>
    )
}

// ─── SEÇÃO 1: FORECAST ───
function ForecastSection() {
    const [metric, setMetric] = useState('revenue')
    const [months, setMonths] = useState(3)

    const { data, isLoading } = useQuery({
        queryKey: ['analytics-forecast', metric, months],
        queryFn: () => api.get('/analytics/forecast', { params: { metric, months } }).then(r => r.data),
        enabled: !!metric
    })

    const chartData = [
        ...(data?.historical ?? []),
        ...(data?.forecast ?? [])
    ]

    return (
        <div className="space-y-4">
            <div className="flex gap-4 items-center bg-surface-50 p-4 rounded-lg border border-default">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-brand-500" />
                    <span className="text-sm font-medium text-surface-700">Configurar Previsão:</span>
                </div>
                <select
                    aria-label="Selecionar métrica para previsão"
                    value={metric}
                    onChange={e => setMetric(e.target.value)}
                    className="bg-surface-0 border border-default rounded-md text-sm px-3 py-1.5 focus:ring-2 focus:ring-brand-500"
                >
                    <option value="revenue">Receita Financeira</option>
                    <option value="expenses">Despesas Operacionais</option>
                    <option value="os_total">Volume de OS</option>
                </select>
                <select
                    aria-label="Selecionar período da previsão"
                    value={months}
                    onChange={e => setMonths(Number(e.target.value))}
                    className="bg-surface-0 border border-default rounded-md text-sm px-3 py-1.5 focus:ring-2 focus:ring-brand-500"
                >
                    <option value={3}>Próximos 3 meses</option>
                    <option value={6}>Próximos 6 meses</option>
                    <option value={12}>Próximos 12 meses</option>
                </select>
            </div>

            <ChartCard title={`Projeção: ${metric === 'revenue' ? 'Receita' : metric === 'expenses' ? 'Despesas' : 'Volume OS'}`}>
                {isLoading ? (
                    <ChartCardSkeleton />
                ) : (
                    <TrendAreaChart
                        data={chartData}
                        xKey="month"
                        series={[
                            { key: 'value', label: 'Valor', color: 'var(--color-brand-500)' }
                        ]}
                        height={350}
                        formatValue={metric === 'os_total' ? undefined : BRL}
                    />
                )}
            </ChartCard>

            {data?.trend && (
                <div className="flex gap-4">
                    <div className="flex-1 bg-surface-0 border border-default p-4 rounded-lg shadow-sm">
                        <span className="text-xs font-medium text-surface-500 uppercase">Tendência Identificada</span>
                        <div className="mt-1 flex items-center gap-2">
                            {data.trend === 'up' && <TrendingUp className="h-5 w-5 text-emerald-500" />}
                            {data.trend === 'down' && <TrendingUp className="h-5 w-5 text-red-500 rotate-180" />}
                            <span className="text-lg font-bold text-surface-900">
                                {data.trend === 'up' ? 'Crescimento' : data.trend === 'down' ? 'Queda' : 'Estável'}
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 bg-surface-0 border border-default p-4 rounded-lg shadow-sm">
                        <span className="text-xs font-medium text-surface-500 uppercase">Modelo Utilizado</span>
                        <div className="mt-1 flex items-center gap-2">
                            <Cpu className="h-5 w-5 text-violet-500" />
                            <span className="text-lg font-bold text-surface-900">Regressão Linear Simples</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── SEÇÃO 2: ANOMALIES ───
function AnomaliesSection() {
    const [metric, setMetric] = useState('revenue')

    const { data, isLoading } = useQuery({
        queryKey: ['analytics-anomalies', metric],
        queryFn: () => api.get('/analytics/anomalies', { params: { metric } }).then(r => r.data)
    })

    return (
        <div className="space-y-4">
            <div className="flex gap-4 items-center bg-surface-50 p-4 rounded-lg border border-default">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-medium text-surface-700">Monitorar Métrica:</span>
                </div>
                <select
                    aria-label="Selecionar métrica para anomalias"
                    value={metric}
                    onChange={e => setMetric(e.target.value)}
                    className="bg-surface-0 border border-default rounded-md text-sm px-3 py-1.5 focus:ring-2 focus:ring-brand-500"
                >
                    <option value="revenue">Receita Financeira</option>
                    <option value="expenses">Despesas Operacionais</option>
                </select>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    <div className="h-16 bg-surface-100 rounded animate-pulse" />
                    <div className="h-16 bg-surface-100 rounded animate-pulse delay-75" />
                    <div className="h-16 bg-surface-100 rounded animate-pulse delay-150" />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border border-default bg-surface-0">
                            <div className="text-sm text-surface-500">Média Histórica</div>
                            <div className="text-2xl font-bold text-surface-900">{BRL(data?.stats?.mean ?? 0)}</div>
                        </div>
                        <div className="p-4 rounded-lg border border-default bg-surface-0">
                            <div className="text-sm text-surface-500">Desvio Padrão (σ)</div>
                            <div className="text-2xl font-bold text-surface-900">{BRL(data?.stats?.std_dev ?? 0)}</div>
                        </div>
                    </div>

                    <h3 className="font-semibold text-surface-900 mt-6">Anomalias Detectadas (Z-Score &gt; 1.8)</h3>

                    {data?.anomalies?.length === 0 ? (
                        <div className="text-center py-12 bg-surface-50 rounded-lg text-surface-500 border border-dashed border-default">
                            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                            Nenhuma anomalia detectada nos últimos 24 meses. Comportamento dentro do esperado.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data?.anomalies?.map((a: any, i: number) => (
                                <div key={i} className={cn(
                                    "flex items-center justify-between p-4 rounded-lg border-l-4 shadow-sm",
                                    a.severity === 'critical'
                                        ? "bg-red-50 border-red-500 text-red-900"
                                        : "bg-amber-50 border-amber-500 text-amber-900"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className={cn("h-5 w-5", a.severity === 'critical' ? 'text-red-600' : 'text-amber-600')} />
                                        <div>
                                            <div className="font-bold">{a.date} — {a.message}</div>
                                            <div className="text-sm opacity-80">
                                                Valor Real: {BRL(a.value)} (Z-Score: {a.z_score})
                                            </div>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "px-2 py-1 rounded text-xs font-bold uppercase",
                                        a.severity === 'critical' ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
                                    )}>
                                        {a.severity === 'critical' ? 'Crítico' : 'Alerta'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── SEÇÃO 3: NL QUERY ───
function NlSection() {
    const [query, setQuery] = useState('')
    const [trigger, setTrigger] = useState(false)

    const { data, isLoading, isError } = useQuery({
        queryKey: ['analytics-nl', trigger],
        queryFn: () => api.get('/analytics/nl-query', { params: { query } }).then(r => r.data),
        enabled: !!query && trigger,
    })

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            setTrigger(prev => !prev) // Force re-fetch
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 py-8">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 bg-brand-100 rounded-full mb-4">
                    <Sparkles className="h-8 w-8 text-brand-600" />
                </div>
                <h2 className="text-2xl font-bold text-surface-900">Pergunte aos seus dados</h2>
                <p className="text-surface-500">
                    Use linguagem natural para consultar KPIs. Ex: "Qual foi a receita do mês passado?" ou "Quantas OS criadas hoje?"
                </p>
            </div>

            <form onSubmit={handleSearch} className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Digite sua pergunta..."
                    className="w-full pl-5 pr-12 py-4 rounded-xl border border-default shadow-lg text-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="absolute right-3 top-3 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
                >
                    {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <ArrowRight className="h-5 w-5" />}
                </button>
            </form>

            {data && (
                <div className="bg-surface-0 border border-default rounded-xl p-6 shadow-card animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex gap-4">
                        <div className="shrink-0 pt-1">
                            <BrainCircuit className="h-8 w-8 text-brand-500" />
                        </div>
                        <div className="space-y-4 flex-1">
                            <div className="prose prose-brand">
                                <p className="text-lg text-surface-900">{data.answer.replace(/\*\*(.*?)\*\*/g, (match: string, p1: string) => `placeholder-${p1}-placeholder`)}</p>
                            </div>

                            {/* Renderizar highlight manual já que não temos parser markdown complexo aqui */}
                            <div className="text-lg text-surface-900">
                                {data.answer.split('**').map((part: string, i: number) =>
                                    i % 2 === 1 ? <strong key={i} className="text-brand-700 font-bold">{part}</strong> : part
                                )}
                            </div>

                            {data.value > 0 && (
                                <div className="mt-4 p-4 bg-surface-50 rounded-lg border border-default">
                                    <div className="text-xs font-medium text-surface-500 uppercase mb-1">Resultado Numérico</div>
                                    <div className="text-3xl font-bold text-surface-900">
                                        {data.type === 'kpi_result' && typeof data.value === 'number' && data.query_analysis.metric === 'work_orders'
                                            ? data.value
                                            : BRL(data.value)}
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-surface-400 font-mono mt-4 pt-4 border-t border-default flex gap-2">
                                <span>Intent: {data.query_analysis.intent}</span>
                                <span>•</span>
                                <span>Metric: {data.query_analysis.metric}</span>
                                <span>•</span>
                                <span>Period: {data.query_analysis.period}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
