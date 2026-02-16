import * as React from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ButtonProps } from '@/components/ui/button'

export interface PageHeaderAction {
    label: string
    onClick?: () => void
    href?: string
    icon?: React.ReactNode
    variant?: ButtonProps['variant']
    permission?: boolean
    disabled?: boolean
}

interface PageHeaderProps {
    title: string
    subtitle?: string
    description?: string
    count?: number
    icon?: React.ComponentType<{ className?: string }> | React.ReactNode
    action?: React.ReactNode
    actions?: PageHeaderAction[] | React.ReactNode
    backTo?: string
    backButton?: boolean
    children?: React.ReactNode
}

function isActionArray(actions: PageHeaderProps['actions']): actions is PageHeaderAction[] {
    return Array.isArray(actions)
}

function renderAction(action: PageHeaderAction, key: number) {
    if (action.permission === false) return null

    if (action.href && !action.onClick) {
        return (
            <Button
                key={key}
                asChild
                variant={action.variant ?? 'primary'}
                size="sm"
                icon={action.icon}
                disabled={action.disabled}
            >
                <a href={action.href}>{action.label}</a>
            </Button>
        )
    }

    return (
        <Button
            key={key}
            variant={action.variant ?? 'primary'}
            size="sm"
            icon={action.icon}
            onClick={action.onClick}
            disabled={action.disabled}
        >
            {action.label}
        </Button>
    )
}

export function PageHeader({
    title,
    subtitle,
    description,
    count,
    icon,
    action,
    actions,
    backTo,
    backButton,
    children,
}: PageHeaderProps) {
    const titleDescription = subtitle ?? description
    let headerIcon: React.ReactNode = null
    if (React.isValidElement(icon)) {
        headerIcon = icon
    } else if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon)) {
        const IconComponent = icon as React.ComponentType<{ className?: string }>
        headerIcon = <IconComponent className="h-5 w-5 text-surface-500" />
    }
    const shouldShowBackButton = Boolean(backTo || backButton)

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                    {headerIcon}
                    <h1 className="text-heading text-surface-900 truncate">
                        {title}
                    </h1>
                    {count !== undefined && (
                        <span className="inline-flex items-center rounded-md bg-surface-100 px-2 py-0.5 text-xs font-semibold text-surface-500 tabular-nums">
                            {count}
                        </span>
                    )}
                </div>
                {titleDescription && (
                    <p className="mt-0.5 text-sm text-surface-500">{titleDescription}</p>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {shouldShowBackButton && (
                    <Button
                        variant="outline"
                        size="sm"
                        icon={<ArrowLeft className="h-4 w-4" />}
                        onClick={backTo ? undefined : () => window.history.back()}
                        asChild={Boolean(backTo)}
                    >
                        {backTo ? <a href={backTo}>Voltar</a> : 'Voltar'}
                    </Button>
                )}
                {children}
                {action}
                {isActionArray(actions) ? actions.map(renderAction) : actions}
            </div>
        </div>
    )
}
