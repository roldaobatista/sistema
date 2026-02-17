import React from 'react'
import { cn } from '@/lib/utils'

interface ChartCardProps {
    title: string
    subtitle?: string
    icon?: React.ReactNode
    className?: string
    height?: number | string
    children: React.ReactNode
    actions?: React.ReactNode
}

export function ChartCard({ title, subtitle, icon, className, height = 280, children, actions }: ChartCardProps) {
    const dynamicStyle = typeof height === 'number' ? { height: `${height}px` } : { height }

    return (
        <div className={cn('rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden', className)}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-2">
                    {icon && <span className="text-surface-400">{icon}</span>}
                    <div>
                        <h3 className="text-sm font-semibold text-surface-700">{title}</h3>
                        {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                {actions}
            </div>
            <div className="px-4 pb-4" style={dynamicStyle}>
                {children}
            </div>
        </div>
    )
}

export function ChartCardSkeleton({ height = 280 }: { height?: number }) {
    const dynamicStyle = { height: `${height}px` }

    return (
        <div className="rounded-xl border border-default bg-surface-0 shadow-card animate-pulse overflow-hidden">
            <div className="px-5 pt-4 pb-2">
                <div className="h-4 w-32 rounded bg-surface-200" />
            </div>
            <div className="px-4 pb-4 flex items-end gap-2" style={dynamicStyle}>
                {[38, 52, 64, 46, 70, 58, 42, 55].map((h, i) => (
                    <div
                        key={i}
                        className="flex-1 rounded-t bg-surface-100"
                        style={{ height: `${h}%` }}
                    />
                ))}
            </div>
        </div>
    )
}
