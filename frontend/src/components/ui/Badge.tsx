import { cn } from '@/lib/utils'

type BadgeVariant =
    | 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
    | 'primary' | 'secondary' | 'outline' | 'neutral'
    | 'red' | 'amber' | 'blue' | 'emerald'

const variants: Record<BadgeVariant, string> = {
    default: 'bg-surface-100 text-surface-600 border border-subtle',
    neutral: 'bg-surface-100 text-surface-600 border border-subtle',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/50',
    danger: 'bg-red-50 text-red-700 border border-red-200/50',
    info: 'bg-sky-50 text-sky-700 border border-sky-200/50',
    brand: 'bg-brand-50 text-brand-700 border border-brand-200/50',
    primary: 'bg-brand-50 text-brand-700 border border-brand-200/50',
    secondary: 'bg-surface-100 text-surface-600 border border-subtle',
    outline: 'border border-default bg-surface-0 text-surface-700',
    red: 'bg-red-50 text-red-700 border border-red-200/50',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200/50',
    blue: 'bg-sky-50 text-sky-700 border border-sky-200/50',
    emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
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
                'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight',
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
                    variant === 'default' && 'bg-surface-400',
                )} />
            )}
            {children}
        </span>
    )
}
