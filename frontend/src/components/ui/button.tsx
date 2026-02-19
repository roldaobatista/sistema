import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'prix-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.06)] hover:brightness-110 hover:shadow-[0_2px_8px_rgba(37,99,235,0.25)] active:brightness-95 dark:hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]',
        primary:
          'prix-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.06)] hover:brightness-110 hover:shadow-[0_2px_8px_rgba(37,99,235,0.25)] active:brightness-95 dark:hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]',
        brand:
          'prix-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.06)] hover:brightness-110 hover:shadow-[0_2px_8px_rgba(37,99,235,0.25)] active:brightness-95 dark:hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]',
        secondary:
          'bg-prix-500 text-white shadow-sm hover:bg-prix-600 active:bg-prix-700',
        outline:
          'border border-surface-200 bg-white text-surface-700 hover:bg-surface-50 hover:text-surface-900 dark:border-white/[0.08] dark:bg-transparent dark:text-surface-300 dark:hover:bg-white/[0.04] dark:hover:text-white',
        ghost:
          'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-white/[0.04] dark:hover:text-white',
        danger:
          'bg-cta-500 text-white shadow-sm hover:bg-cta-600 active:bg-cta-700 dark:hover:shadow-[0_0_16px_rgba(248,113,113,0.15)]',
        destructive:
          'bg-cta-500 text-white shadow-sm hover:bg-cta-600 active:bg-cta-700 dark:hover:shadow-[0_0_16px_rgba(248,113,113,0.15)]',
        link: 'text-prix-500 underline-offset-4 hover:underline',
        success:
          'bg-success text-white shadow-sm hover:bg-emerald-600 active:bg-emerald-700',
        info:
          'bg-sky-500 text-white shadow-sm hover:bg-sky-600 active:bg-sky-700',
        warning:
          'bg-amber-500 text-white shadow-sm hover:bg-amber-600 active:bg-amber-700',
      },
      size: {
        xs: 'h-7 rounded-[var(--radius-pill)] px-2.5 text-xs',
        sm: 'h-8 rounded-[var(--radius-pill)] px-3.5 text-xs',
        md: 'h-9 rounded-[var(--radius-pill)] px-5 text-sm',
        lg: 'h-10 rounded-[var(--radius-pill)] px-6 text-sm',
        icon: 'h-9 w-9 rounded-[var(--radius-md)]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, icon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {children}
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
