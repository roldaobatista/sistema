import * as React from 'react'
import { Button, type ButtonProps } from './Button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { cn } from '@/lib/utils'

interface IconButtonProps extends Omit<ButtonProps, 'size' | 'children'> {
    /** Texto descritivo para acessibilidade e tooltip */
    label: string
    /** Ícone renderizado */
    icon: React.ReactNode
    /** Posição do tooltip */
    tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ label, icon, tooltipSide = 'top', className, variant = 'ghost', ...props }, ref) => (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    ref={ref}
                    variant={variant}
                    size="icon"
                    aria-label={label}
                    className={cn('text-surface-500', className)}
                    {...props}
                >
                    {icon}
                </Button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    )
)
IconButton.displayName = 'IconButton'

export { IconButton }
export type { IconButtonProps }
