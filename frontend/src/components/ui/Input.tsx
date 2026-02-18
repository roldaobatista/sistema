import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, id, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s/g, '-')
        return (
            <div className="space-y-1.5">
                {label && (
                    <label htmlFor={inputId} className="block text-[13px] font-medium text-surface-700">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={cn(
                        'w-full rounded-[var(--radius-md)] border bg-white px-3.5 py-2.5 text-sm text-surface-900',
                        'placeholder:text-surface-400 placeholder:font-normal',
                        'focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-150',
                        'dark:bg-[#0F0F12] dark:text-white dark:placeholder:text-surface-500',
                        error
                            ? 'border-red-300 dark:border-red-500/30 focus:border-red-400 focus:ring-red-500/15'
                            : 'border-surface-200 dark:border-white/[0.08] focus:border-prix-400 focus:ring-prix-500/15 dark:focus:border-prix-400/50 dark:focus:ring-prix-500/10',
                        'disabled:cursor-not-allowed disabled:bg-surface-100 dark:disabled:bg-white/[0.03] disabled:text-surface-400',
                        className
                    )}
                    {...props}
                />
                {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
                {hint && !error && <p className="text-xs text-surface-500">{hint}</p>}
            </div>
        )
    }
)
Input.displayName = 'Input'
