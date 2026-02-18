import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string
    error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, error, ...props }, ref) => (
        <div className="space-y-1.5">
            {label && <label className="block text-[13px] font-medium text-surface-700">{label}</label>}
            <textarea
                ref={ref}
                className={cn(
                    'block w-full rounded-[var(--radius-md)] border bg-white px-3.5 py-2.5 text-sm text-surface-900',
                    'placeholder:text-surface-400 placeholder:font-normal',
                    'dark:bg-[#0F0F12] dark:text-white dark:placeholder:text-surface-500',
                    'focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-150',
                    'disabled:cursor-not-allowed disabled:bg-surface-100 dark:disabled:bg-white/[0.03] disabled:text-surface-400',
                    'resize-y min-h-[80px]',
                    error
                        ? 'border-red-300 dark:border-red-500/30 focus:border-red-400 focus:ring-red-500/15'
                        : 'border-surface-200 dark:border-white/[0.08] focus:border-prix-400 focus:ring-prix-500/15 dark:focus:border-prix-400/50',
                    className
                )}
                {...props}
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    )
)
Textarea.displayName = 'Textarea'
