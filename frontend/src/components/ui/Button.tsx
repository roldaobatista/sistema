import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
    loading?: boolean
    icon?: React.ReactNode
}

const variants: Record<Variant, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 focus-ring',
    secondary: 'bg-surface-100 text-surface-900 hover:bg-surface-200 active:bg-surface-300',
    outline: 'border border-surface-300 bg-white text-surface-700 hover:bg-surface-50 active:bg-surface-100',
    ghost: 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}

const sizes: Record<Size, string> = {
    sm: 'h-8 gap-1.5 rounded-md px-3 text-xs font-medium',
    md: 'h-9 gap-2 rounded-lg px-4 text-sm font-medium',
    lg: 'h-11 gap-2 rounded-lg px-5 text-sm font-semibold',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => (
        <button
            ref={ref}
            className={cn(
                'inline-flex items-center justify-center transition-all duration-200',
                'disabled:cursor-not-allowed disabled:opacity-50',
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {children}
        </button>
    )
)
Button.displayName = 'Button'
