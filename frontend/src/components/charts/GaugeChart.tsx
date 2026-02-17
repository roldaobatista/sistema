import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface GaugeChartProps {
    value: number
    max?: number
    label?: string
    suffix?: string
    height?: number
    className?: string
    color?: string
}

export function GaugeChart({
    value,
    max = 100,
    label,
    suffix = '%',
    height = 200,
    className,
    color,
}: GaugeChartProps) {
    const clamped = Math.max(0, Math.min(value, max))
    const pct = (clamped / max) * 100

    const gaugeColor = color ?? (
        pct >= 60 ? 'var(--color-success)' :
            pct >= 30 ? 'var(--color-warning)' :
                'var(--color-danger)'
    )

    const data = [
        { name: 'bg', value: max, fill: 'var(--color-surface-100)' },
        { name: 'value', value: clamped, fill: gaugeColor },
    ]

    return (
        <div className={cn('relative w-full', className)} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="90%"
                    barSize={14}
                    data={data}
                    startAngle={210}
                    endAngle={-30}
                >
                    <RadialBar
                        dataKey="value"
                        cornerRadius={7}
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                    >
                        {/* Recharts RadialBar doesn't support children Cell like Pie, but supports background via prop. 
                             We are setting fill in data, which works. */}
                    </RadialBar>
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-500 delay-100">
                <span className="text-3xl font-bold tabular-nums tracking-tight" style={{ color: gaugeColor }}>
                    {value}{suffix}
                </span>
                {label && <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider mt-1">{label}</span>}
            </div>
        </div>
    )
}
