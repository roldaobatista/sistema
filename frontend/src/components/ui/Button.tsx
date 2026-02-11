import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'default' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
    loading?: boolean
    icon?: React.ReactNode
}

const variants: Record<Variant, string> = {
    primary:
        'bg-brand-600 text-white shadow-sm hover:bg-brand-500 active:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
    secondary:
        'bg-surface-100 text-surface-800 hover:bg-surface-200 active:bg-surface-300',
    outline:
        'border border-default bg-surface-0 text-surface-700 hover:bg-surface-50 active:bg-surface-100',
    ghost:
        'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
    danger:
        'bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700',
    default:
        'bg-surface-100 text-surface-800 hover:bg-surface-200 active:bg-surface-300',
    success:
        'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700',
}

const sizes: Record<Size, string> = {
    sm: 'h-7 gap-1.5 rounded-md px-2.5 text-xs font-medium',
    md: 'h-8 gap-2 rounded-md px-3.5 text-[13px] font-medium',
    lg: 'h-9.5 gap-2 rounded-lg px-4 text-sm font-semibold',
    icon: 'h-8 w-8 rounded-md p-0 flex items-center justify-center',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => (
        <button
            ref={ref}
            className={cn(
                'inline-flex items-center justify-center transition-colors duration-150',
                'disabled:cursor-not-allowed disabled:opacity-40',
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
            {children}
        </button>
    )
)
Button.displayName = 'Button'
