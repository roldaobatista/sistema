import { cn } from '@/lib/utils'

interface CardProps {
    children: React.ReactNode
    className?: string
}

export function Card({ children, className }: CardProps) {
    return (
        <div className={cn(
            'rounded-xl border border-default bg-surface-0 shadow-card',
            className
        )}>
            {children}
        </div>
    )
}

export function CardTitle({ children, className }: CardProps) {
    return <h3 className={cn('text-[15px] font-semibold text-surface-900 tracking-tight', className)}>{children}</h3>
}

export function CardHeader({ children, className }: CardProps) {
    return (
        <div className={cn('px-5 py-3.5 border-b border-subtle', className)}>
            {children}
        </div>
    )
}

export function CardContent({ children, className }: CardProps) {
    return <div className={cn('px-5 py-4', className)}>{children}</div>
}

export function CardFooter({ children, className }: CardProps) {
    return (
        <div className={cn('px-5 py-3.5 border-t border-subtle', className)}>
            {children}
        </div>
    )
}
