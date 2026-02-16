import { LayoutDashboard, Wrench, Briefcase, ChevronDown } from 'lucide-react'
import { useAppMode, type AppMode } from '@/hooks/useAppMode'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const MODE_CONFIG: Record<AppMode, { label: string; shortLabel: string; icon: typeof LayoutDashboard }> = {
    gestao: { label: 'Modo Gestão', shortLabel: 'Gestão', icon: LayoutDashboard },
    tecnico: { label: 'Modo Técnico', shortLabel: 'Técnico', icon: Wrench },
    vendedor: { label: 'Modo Vendedor', shortLabel: 'Vendedor', icon: Briefcase },
}

export function ModeSwitcher() {
    const { currentMode, availableModes, switchMode, hasMultipleModes } = useAppMode()

    if (!hasMultipleModes) return null

    const current = MODE_CONFIG[currentMode]
    const CurrentIcon = current.icon

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 min-w-0 text-surface-700 dark:text-surface-200 hover:text-surface-900 dark:hover:text-surface-50 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                    <CurrentIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-[100px] sm:max-w-[140px] font-medium">
                        <span className="hidden sm:inline">{current.label}</span>
                        <span className="sm:hidden">{current.shortLabel}</span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="min-w-[240px] p-2 shadow-lg">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 border-b border-border dark:border-surface-700 mb-1.5">
                    Trocar modo
                </div>
                {availableModes.map((mode) => {
                    const config = MODE_CONFIG[mode]
                    const Icon = config.icon
                    const isActive = currentMode === mode
                    return (
                        <DropdownMenuItem
                            key={mode}
                            onClick={() => switchMode(mode)}
                            className={cn(
                                'gap-3 py-3 px-3 text-base font-medium cursor-pointer rounded-md',
                                'focus:bg-accent focus:text-accent-foreground',
                                isActive && 'bg-accent font-semibold text-accent-foreground'
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="flex-1 whitespace-nowrap">{config.label}</span>
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
