import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

interface SeriesConfig {
    key: string
    label: string
    color: string
    dashed?: boolean
}

interface TrendAreaChartProps {
    data: Record<string, any>[]
    xKey: string
    series: SeriesConfig[]
    height?: number
    className?: string
    formatValue?: (v: number) => string
    showGrid?: boolean
    yTickFormatter?: (v: number) => string
}

function CustomTooltip({ active, payload, label, formatValue }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-lg border border-default bg-surface-0/95 backdrop-blur shadow-xl p-3 animate-in fade-in zoom-in-95 duration-200">
            <p className="font-medium text-surface-700 mb-2 text-xs uppercase tracking-wider">{label}</p>
            <div className="space-y-1">
                {payload.map((item: any) => (
                    <div key={item.dataKey} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full ring-1 ring-white/20" style={{ backgroundColor: item.stroke }} />
                            <span className="text-surface-600 font-medium">{item.name}:</span>
                        </div>
                        <span className="font-bold text-surface-900 tabular-nums">
                            {formatValue ? formatValue(item.value) : item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function TrendAreaChart({
    data,
    xKey,
    series,
    height = 280,
    className,
    formatValue,
    showGrid = true,
    yTickFormatter,
}: TrendAreaChartProps) {
    if (!data.length) {
        return (
            <div
                className={cn('flex items-center justify-center text-sm text-surface-400', className)}
                style={{ height }}
            >
                Sem dados
            </div>
        )
    }

    return (
        <div className={cn('w-full', className)} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                        {series.map(s => (
                            <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                            </linearGradient>
                        ))}
                    </defs>
                    {showGrid && (
                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="var(--color-surface-200)"
                        />
                    )}
                    <XAxis
                        dataKey={xKey}
                        tick={{ fontSize: 11, fill: 'var(--color-surface-500)' }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: 'var(--color-surface-500)' }}
                        tickFormatter={yTickFormatter}
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                    />
                    <Tooltip
                        content={<CustomTooltip formatValue={formatValue} />}
                        cursor={{ stroke: 'var(--color-surface-300)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    {series.map(s => (
                        <Area
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.label}
                            stroke={s.color}
                            strokeWidth={2}
                            strokeDasharray={s.dashed ? '5 3' : undefined}
                            fill={`url(#gradient-${s.key})`}
                            animationDuration={1500}
                            animationEasing="ease-in-out"
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
