import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const variants: Record<BadgeVariant, string> = {
    default: 'bg-surface-100 text-surface-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-sky-50 text-sky-700',
    brand: 'bg-brand-50 text-brand-700',
}

interface BadgeProps {
    variant?: BadgeVariant
    children: React.ReactNode
    className?: string
    dot?: boolean
}

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                variants[variant],
                className
            )}
        >
            {dot && (
                <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    variant === 'success' && 'bg-emerald-500',
                    variant === 'warning' && 'bg-amber-500',
                    variant === 'danger' && 'bg-red-500',
                    variant === 'info' && 'bg-sky-500',
                    variant === 'brand' && 'bg-brand-500',
                    variant === 'default' && 'bg-surface-500',
                )} />
            )}
            {children}
        </span>
    )
}
