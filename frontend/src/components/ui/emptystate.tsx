import * as React from 'react'
import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
    icon?: React.ReactNode
    title?: string
    message: string
    action?: {
        label: string
        onClick: () => void
        icon?: React.ReactNode
    }
    className?: string
    compact?: boolean
}

export function EmptyState({
    icon,
    title,
    message,
    action,
    className,
    compact = false,
}: EmptyStateProps) {
    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center',
            compact ? 'py-6' : 'py-10',
            className
        )}>
            <div className={cn(
                'flex items-center justify-center rounded-lg bg-surface-100',
                compact ? 'h-8 w-8' : 'h-10 w-10'
            )}>
                {icon ?? <Inbox className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', 'text-surface-300')} />}
            </div>
            {title && (
                <p className={cn(
                    'font-medium text-surface-700',
                    compact ? 'mt-2 text-[13px]' : 'mt-3 text-sm'
                )}>
                    {title}
                </p>
            )}
            <p className={cn(
                'text-surface-400',
                compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-[13px]',
                !title && (compact ? 'mt-2' : 'mt-3')
            )}>
                {message}
            </p>
            {action && (
                <Button
                    variant="outline"
                    size="sm"
                    icon={action.icon}
                    onClick={action.onClick}
                    className="mt-3"
                >
                    {action.label}
                </Button>
            )}
        </div>
    )
}
