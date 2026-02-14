import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PageHeaderAction {
    label: string
    onClick: () => void
    icon?: React.ReactNode
    variant?: 'primary' | 'secondary' | 'outline'
    permission?: boolean
}

interface PageHeaderProps {
    title: string
    subtitle?: string
    count?: number
    actions?: PageHeaderAction[]
    children?: React.ReactNode
}

export function PageHeader({ title, subtitle, count, actions, children }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="flex items-center gap-2.5">
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">
                        {title}
                    </h1>
                    {count !== undefined && (
                        <span className="inline-flex items-center rounded-md bg-surface-100 px-2 py-0.5 text-[11px] font-semibold text-surface-500 tabular-nums">
                            {count}
                        </span>
                    )}
                </div>
                {subtitle && (
                    <p className="mt-0.5 text-[13px] text-surface-500">{subtitle}</p>
                )}
            </div>
            <div className="flex items-center gap-2">
                {children}
                {actions?.map((action, i) => (
                    action.permission !== false && (
                        <Button
                            key={i}
                            variant={action.variant ?? 'primary'}
                            size="sm"
                            icon={action.icon}
                            onClick={action.onClick}
                        >
                            {action.label}
                        </Button>
                    )
                ))}
            </div>
        </div>
    )
}
