import * as React from 'react'
import { Button, type ButtonProps } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { cn } from '@/lib/utils'

interface IconButtonProps extends Omit<ButtonProps, 'children'> {
    label?: string
    icon: React.ReactNode
    tooltip?: string
    tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ label, icon, tooltip, tooltipSide = 'top', className, variant = 'ghost', size = 'icon', ...props }, ref) => {
        const tooltipText = label ?? tooltip ?? 'Ação'

        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        ref={ref}
                        variant={variant}
                        size={size}
                        aria-label={tooltipText}
                        className={cn('text-surface-500', className)}
                        {...props}
                    >
                        {icon}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side={tooltipSide}>
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        )
    }
)
IconButton.displayName = 'IconButton'

export { IconButton }
export type { IconButtonProps }
