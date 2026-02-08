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
                    <label htmlFor={inputId} className="block text-sm font-medium text-surface-700">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={cn(
                        'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-surface-900',
                        'placeholder:text-surface-400',
                        'focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200',
                        error
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-surface-300 focus:border-brand-500 focus:ring-brand-500/20',
                        'disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-surface-400',
                        className
                    )}
                    {...props}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                {hint && !error && <p className="text-xs text-surface-500">{hint}</p>}
            </div>
        )
    }
)
Input.displayName = 'Input'
