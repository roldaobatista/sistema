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
                    'block w-full rounded-md border bg-surface-50 px-3 py-2 text-sm text-surface-900',
                    'placeholder:text-surface-400 placeholder:font-normal',
                    'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:bg-surface-0 transition-all duration-150',
                    'disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-surface-400',
                    'resize-y min-h-[80px]',
                    error
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
                        : 'border-default focus:border-brand-400 focus:ring-brand-500/15',
                    className
                )}
                {...props}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    )
)
Textarea.displayName = 'Textarea'
