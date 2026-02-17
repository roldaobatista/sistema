import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

const PALETTE = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
    'var(--color-brand-300)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-info)', 'var(--color-surface-500)'
]


export interface StackedBarProps {
    data: any[]
    xKey: string
    dataKeys: { key: string; label: string; color?: string }[]
    height?: number | string
    className?: string
    formatValue?: (value: number) => string
    layout?: 'horizontal' | 'vertical'
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
                            <span className="h-2 w-2 rounded-full ring-1 ring-white/20" style={{ backgroundColor: item.fill }} />
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

export function StackedBar({
    data,
    xKey,
    dataKeys,
    height = 280,
    className,
    formatValue,
    layout = 'horizontal',
}: StackedBarProps) {
    if (!data.length) {
        return (
            <div className={cn('flex items-center justify-center text-sm text-surface-400', className)}
                style={{ height }}>
                Sem dados
            </div>
        )
    }

    return (
        <div className={cn('w-full', className)} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout={layout === 'vertical' ? 'vertical' : undefined}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={layout === 'vertical'} horizontal={layout === 'horizontal'} stroke="var(--color-surface-200)" />
                    {layout === 'vertical' ? (
                        <>
                            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-surface-500)' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey={xKey} width={80} tick={{ fontSize: 11, fill: 'var(--color-surface-500)' }} axisLine={false} tickLine={false} />
                        </>
                    ) : (
                        <>
                            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--color-surface-500)' }} axisLine={false} tickLine={false} dy={5} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--color-surface-500)' }} axisLine={false} tickLine={false} />
                        </>
                    )}
                    <Tooltip
                        content={<CustomTooltip formatValue={formatValue} />}
                        cursor={{ fill: 'var(--color-surface-50)', opacity: 0.5 }}
                    />
                    <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingTop: 12, color: 'var(--color-surface-500)' }}
                        formatter={(value: any, entry: any, index: number) => <span style={{ color: 'var(--color-surface-600)' }}>{value}</span>}
                    />
                    {dataKeys.map((dk: any, i: number) => (
                        <Bar
                            key={dk.key}
                            dataKey={dk.key}
                            name={dk.label}
                            stackId="stack"
                            fill={dk.color ?? PALETTE[i % PALETTE.length]}
                            radius={i === dataKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                            animationDuration={1000}
                            animationEasing="ease-in-out"
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
