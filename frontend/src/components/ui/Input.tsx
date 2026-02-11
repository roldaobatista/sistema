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
                        'w-full rounded-md border bg-surface-50 px-3 py-2 text-sm text-surface-900',
                        'placeholder:text-surface-400 placeholder:font-normal',
                        'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:bg-surface-0 transition-all duration-150',
                        error
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
                            : 'border-default focus:border-brand-400 focus:ring-brand-500/15',
                        'disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-surface-400',
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
