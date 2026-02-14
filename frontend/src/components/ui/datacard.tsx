import * as React from 'react'
import { cn } from '@/lib/utils'

interface DataCardProps {
    title: string
    /** Ação no header (ex: botão, link) */
    headerAction?: React.ReactNode
    children: React.ReactNode
    className?: string
    /** Remove padding interno — útil para tabelas e listas */
    noPadding?: boolean
}

/**
 * DataCard — card padrão Kalibrium com header separado.
 *
 * Segue o padrão: border-default, bg-surface-0, shadow-card,
 * header com border-b border-subtle.
 */
export function DataCard({
    title,
    headerAction,
    children,
    className,
    noPadding = false,
}: DataCardProps) {
    return (
        <div className={cn('rounded-xl border border-default bg-surface-0 shadow-card', className)}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
                <h3 className="text-[13px] font-semibold text-surface-900">{title}</h3>
                {headerAction}
            </div>
            <div className={cn(!noPadding && 'p-4')}>
                {children}
            </div>
        </div>
    )
}
