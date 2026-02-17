import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { cn } from '@/lib/utils'

const FUNNEL_COLORS = [
    'var(--chart-1)',
    'var(--chart-4)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-5)'
]


interface FunnelChartProps {
    data: any[]
    height?: number | string
    className?: string
    formatValue?: (value: number) => string
}

function CustomTooltip({ active, payload, label, formatValue }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-lg border border-default bg-surface-0/95 backdrop-blur shadow-xl p-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                <span className="font-medium text-surface-700 text-xs uppercase tracking-wider">{label}</span>
            </div>
            <div className="space-y-1">
                {payload.map((item: any) => (
                    <div key={item.name} className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-surface-600 font-medium">{item.name}:</span>
                        <span className="font-bold text-surface-900 tabular-nums">
                            {formatValue ? formatValue(item.value) : item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function FunnelChart({ data, height = 250, className, formatValue }: FunnelChartProps) {
    if (!data.length) {
        return (
            <div className={cn('flex items-center justify-center text-sm text-surface-400', className)}
                style={{ height }}>
                Sem dados
            </div>
        )
    }

    const maxVal = Math.max(...data.map(d => d.value), 1)

    return (
        <div className={cn('w-full', className)} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                    barCategoryGap="20%"
                >
                    <XAxis type="number" hide />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 12, fill: 'var(--color-surface-600)' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        content={<CustomTooltip formatValue={formatValue} />}
                        cursor={{ fill: 'var(--color-surface-50)', opacity: 0.5 }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={1000} animationEasing="ease-in-out">
                        {data.map((entry: any, i: number) => (
                            <Cell
                                key={entry.name}
                                fill={entry.color ?? FUNNEL_COLORS[i % FUNNEL_COLORS.length]}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 mt-1 justify-center sm:justify-start">
                {data.map((item: any, i: number) => {
                    const pct = maxVal > 0 ? Math.round((item.value / data[0].value) * 100) : 0
                    return (
                        <span key={item.name} className="text-xs text-surface-500 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color ?? FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                            <span>{item.name}:</span>
                            <span className="font-semibold text-surface-700 tabular-nums">{item.value}</span>
                            {i > 0 && <span className="text-surface-400 text-[10px]">({pct}%)</span>}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}
