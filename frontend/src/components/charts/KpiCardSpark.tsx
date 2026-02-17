import React from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { MetricCompare } from './MetricCompare'

interface KpiCardSparkProps {
    label: string
    value: string | number
    icon?: React.ReactNode
    sparkData?: number[]
    sparkColor?: string
    previous?: number
    current?: number
    invert?: boolean
    className?: string
    valueClassName?: string
}

export function KpiCardSpark({
    label,
    value,
    icon,
    sparkData,
    sparkColor = 'var(--color-brand-500, #6366f1)',
    previous,
    current,
    invert = false,
    className,
    valueClassName,
}: KpiCardSparkProps) {
    const chartData = sparkData?.map((v, i) => ({ i, v })) ?? []

    return (
        <div className={cn(
            'rounded-xl border border-default bg-surface-0 p-4 shadow-card flex flex-col justify-between gap-2',
            className
        )}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {icon && <span className="text-surface-400">{icon}</span>}
                    <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">{label}</span>
                </div>
                {previous !== undefined && current !== undefined && (
                    <MetricCompare current={current} previous={previous} invert={invert} />
                )}
            </div>
            <div className="flex items-end justify-between gap-3">
                <span className={cn('text-2xl font-bold text-surface-900 tracking-tight', valueClassName)}>
                    {value}
                </span>
                {chartData.length > 1 && (
                    <div className="w-20 h-8 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <Line
                                    type="monotone"
                                    dataKey="v"
                                    stroke={sparkColor}
                                    strokeWidth={1.5}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    )
}
