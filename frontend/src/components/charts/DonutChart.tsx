import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'

const PALETTE = [
    '#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#22c55e',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
]

interface DonutItem {
    name: string
    value: number
    color?: string
}

interface DonutChartProps {
    data: DonutItem[]
    centerLabel?: string
    centerValue?: string | number
    height?: number
    className?: string
    formatValue?: (v: number) => string
}

function CustomTooltip({ active, payload, formatValue }: any) {
    if (!active || !payload?.length) return null
    const item = payload[0]
    return (
        <div className="rounded-lg border border-default bg-surface-0 px-3 py-2 text-xs shadow-xl">
            <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.payload.fill }} />
                <span className="font-medium text-surface-700">{item.name}</span>
            </div>
            <span className="font-bold text-surface-900">
                {formatValue ? formatValue(item.value) : item.value}
            </span>
        </div>
    )
}

export function DonutChart({
    data,
    centerLabel,
    centerValue,
    height = 220,
    className,
    formatValue,
}: DonutChartProps) {
    const total = data.reduce((s, d) => s + d.value, 0)

    if (!data.length || total === 0) {
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
        <div className={cn('flex flex-col sm:flex-row items-center gap-6 justify-center', className)}>
            <div className="relative shrink-0" style={{ width: height, height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="90%"
                            paddingAngle={2}
                            dataKey="value"
                            animationDuration={1000}
                            animationEasing="ease-out"
                            stroke="var(--color-surface-0)"
                            strokeWidth={2}
                        >
                            {data.map((entry, i) => (
                                <Cell
                                    key={entry.name}
                                    fill={entry.color ?? PALETTE[i % PALETTE.length]}
                                    stroke="transparent"
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
                    </PieChart>
                </ResponsiveContainer>
                {(centerLabel || centerValue) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-500 delay-300">
                        {centerValue !== undefined && (
                            <span className="text-2xl font-bold text-surface-900 tracking-tight">{centerValue}</span>
                        )}
                        {centerLabel && (
                            <span className="text-xs font-medium text-surface-500 uppercase tracking-widest mt-1">{centerLabel}</span>
                        )}
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-col gap-3 w-full sm:w-auto">
                {data.map((item, i) => {
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                    return (
                        <div key={item.name} className="flex items-center gap-3 text-sm group">
                            <span
                                className="h-3 w-3 rounded-full shadow-sm ring-1 ring-surface-200 dark:ring-surface-700 transition-transform group-hover:scale-110"
                                style={{ backgroundColor: item.color ?? PALETTE[i % PALETTE.length] }}
                            />
                            <div className="flex flex-col">
                                <span className="text-surface-600 text-xs font-medium uppercase tracking-wide">{item.name}</span>
                                <span className="font-bold text-surface-900 tabular-nums">{pct}% <span className="text-surface-400 font-normal">({formatValue ? formatValue(item.value) : item.value})</span></span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
