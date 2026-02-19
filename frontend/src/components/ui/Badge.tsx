import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-100 text-surface-700 dark:bg-white/[0.06] dark:text-surface-300',
        primary: 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-[#FFB088]',
        brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-[#FFB088]',
        secondary: 'bg-prix-100 text-prix-700 dark:bg-blue-500/10 dark:text-[#93C5FD]',
        success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/8 dark:text-emerald-300 dark:border-emerald-400/15',
        warning: 'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/8 dark:text-amber-300 dark:border-amber-400/15',
        danger: 'bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-500/8 dark:text-red-300 dark:border-red-400/15',
        destructive: 'bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-500/8 dark:text-red-300 dark:border-red-400/15',
        info: 'bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-blue-500/8 dark:text-blue-300 dark:border-blue-400/15',
        outline: 'border border-surface-200 text-surface-600 dark:border-white/[0.08] dark:text-surface-400',
        red: 'bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-500/8 dark:text-red-300',
        amber: 'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/8 dark:text-amber-300',
        blue: 'bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-blue-500/8 dark:text-blue-300',
        emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/8 dark:text-emerald-300',
        zinc: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        surface: 'bg-surface-100 text-surface-700 dark:bg-white/[0.06] dark:text-surface-300',
      },
      size: {
        default: '',
        sm: 'px-1.5 py-0 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, size, dot, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), dot && 'gap-1.5', className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {props.children}
    </div>
  )
}

export { Badge, badgeVariants }

