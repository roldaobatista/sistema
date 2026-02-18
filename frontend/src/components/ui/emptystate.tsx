import * as React from 'react'
import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
    icon?: React.ReactNode | React.ComponentType<{ className?: string }>
    title?: string
    message?: string
    description?: string
    action?: EmptyStateAction | React.ReactNode
    className?: string
    compact?: boolean
}

interface EmptyStateAction {
    label: string
    onClick: () => void
    icon?: React.ReactNode
}

function isActionObject(action: EmptyStateProps['action']): action is EmptyStateAction {
    return Boolean(
        action &&
        typeof action === 'object' &&
        !React.isValidElement(action) &&
        'label' in action &&
        'onClick' in action
    )
}

function EmptyIllustration({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="20" width="80" height="50" rx="6" className="stroke-surface-200" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx="60" cy="38" r="8" className="fill-surface-100 stroke-surface-200" strokeWidth="1" />
            <path d="M57 38L59 40L63 36" className="stroke-surface-300" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="42" y="52" width="36" height="4" rx="2" className="fill-surface-100" />
            <rect x="48" y="59" width="24" height="3" rx="1.5" className="fill-surface-100/60" />
        </svg>
    )
}

function isComponentType(value: unknown): value is React.ComponentType<any> {
    if (typeof value === 'function') return true
    if (typeof value === 'object' && value !== null && '$$typeof' in value) {
        const sym = (value as any).$$typeof
        return typeof sym === 'symbol' && sym.toString().includes('forward_ref')
    }
    return false
}

export function EmptyState({
    icon,
    title,
    message,
    description,
    action,
    className,
    compact = false,
}: EmptyStateProps) {
    const bodyText = message ?? description ?? 'Nenhum registro encontrado'
    const iconCls = cn(compact ? 'h-4 w-4' : 'h-5 w-5', 'text-surface-300')
    const iconNode = isComponentType(icon)
        ? React.createElement(icon, { className: iconCls })
        : icon

    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center animate-fade-in',
            compact ? 'py-6' : 'py-12',
            className
        )}>
            {!compact && <EmptyIllustration className="h-20 w-30 mb-2" />}
            {compact && (
                <div className="flex items-center justify-center rounded-[var(--radius-lg)] bg-surface-100 dark:bg-white/[0.04] h-8 w-8">
                    {(iconNode as React.ReactNode) ?? <Inbox className="h-4 w-4 text-surface-300" />}
                </div>
            )}
            {title && (
                <p className={cn(
                    'font-medium text-surface-700',
                    compact ? 'mt-2 text-sm' : 'mt-1 text-sm'
                )}>
                    {title}
                </p>
            )}
            <p className={cn(
                'text-surface-400 max-w-xs',
                compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm',
                !title && (compact ? 'mt-2' : 'mt-1')
            )}>
                {bodyText}
            </p>
            {action && (React.isValidElement(action) ? (
                <div className="mt-4">{action}</div>
            ) : isActionObject(action) ? (
                <Button
                    variant="outline"
                    size="sm"
                    icon={action.icon}
                    onClick={action.onClick}
                    className="mt-4"
                >
                    {action.label}
                </Button>
            ) : (
                <div className="mt-4">{action}</div>
            ))}
        </div>
    )
}
