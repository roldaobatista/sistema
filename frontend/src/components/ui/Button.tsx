import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex cursor-pointer select-none items-center justify-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-600 text-white shadow-sm hover:bg-brand-500 active:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        brand:
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
        link: 'text-brand-600 underline-offset-4 hover:underline',
        destructive:
          'bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700',
      },
      size: {
        xs: 'h-6 gap-1 rounded-md px-2 text-xs font-medium',
        sm: 'h-7 gap-1.5 rounded-md px-2.5 text-xs font-medium',
        md: 'h-8 gap-2 rounded-md px-3.5 text-sm font-medium',
        lg: 'h-9.5 gap-2 rounded-lg px-4 text-sm font-semibold',
        icon: 'h-8 w-8 rounded-md p-0 flex items-center justify-center',
        default: 'h-8 gap-2 rounded-md px-3.5 text-sm font-medium',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, icon, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
export type { ButtonProps }
