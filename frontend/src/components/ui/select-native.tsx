import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string
    error?: string
}

export const SelectNative = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, children, ...props }, ref) => (
        <div className="space-y-1.5">
            {label && <label className="block text-[13px] font-medium text-surface-700">{label}</label>}
            <select
                ref={ref}
                className={cn(
                    'block w-full rounded-md border bg-surface-50 px-3 py-2 text-sm text-surface-900',
                    'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:bg-surface-0 dark:focus:bg-surface-800 transition-all duration-150',
                    'disabled:cursor-not-allowed disabled:bg-surface-100 dark:disabled:bg-surface-700 disabled:text-surface-400',
                    error
                        ? 'border-red-300 dark:border-red-600 focus:border-red-400 focus:ring-red-500/15'
                        : 'border-default focus:border-brand-400 focus:ring-brand-500/15',
                    className
                )}
                {...props}
            >
                {children}
            </select>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    )
)
SelectNative.displayName = 'SelectNative'
