import { cn } from '@/lib/utils'

interface ColorDotProps {
    color: string
    size?: 'sm' | 'md'
    className?: string
}

/**
 * Renders a small colored circle. Uses inline `backgroundColor` because
 * the color comes from the database at runtime and cannot be a static CSS class.
 */
export function ColorDot({ color, size = 'sm', className }: ColorDotProps) {
    const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
    return (
        <span
            className={cn('inline-block rounded-full flex-shrink-0', sizeClass, className)}
            // eslint-disable-next-line react/forbid-dom-props
            style={{ backgroundColor: color }}
            aria-hidden="true"
        />
    )
}
