import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-surface-200 bg-surface-100 text-surface-600',
        secondary:
          'border-surface-200 bg-surface-50 text-surface-700',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-700',
        danger:
          'border-red-200 bg-red-50 text-red-700',
        destructive:
          'border-red-200 bg-red-50 text-red-700',
        warning:
          'border-amber-200 bg-amber-50 text-amber-700',
        info:
          'border-sky-200 bg-sky-50 text-sky-700',
        outline:
          'border-default bg-transparent text-surface-600',
        brand:
          'border-brand-200 bg-brand-50 text-brand-700',
        primary:
          'border-brand-200 bg-brand-50 text-brand-700',
        neutral:
          'border-surface-200 bg-surface-100 text-surface-600',
        red:
          'border-red-200 bg-red-50 text-red-700',
        amber:
          'border-amber-200 bg-amber-50 text-amber-700',
        blue:
          'border-sky-200 bg-sky-50 text-sky-700',
        emerald:
          'border-emerald-200 bg-emerald-50 text-emerald-700',
        surface:
          'border-surface-200 bg-surface-50 text-surface-700',
        zinc:
          'border-zinc-200 bg-zinc-50 text-zinc-700',
      },
      size: {
        xs: 'px-1.5 py-0 text-[0.625rem]',
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
