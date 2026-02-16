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

const MODE_CONFIG: Record<AppMode, { label: string; icon: typeof LayoutDashboard }> = {
    gestao: { label: 'Modo Gestão', icon: LayoutDashboard },
    tecnico: { label: 'Modo Técnico', icon: Wrench },
    vendedor: { label: 'Modo Vendedor', icon: Briefcase },
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
                    className="gap-2 text-surface-600 hover:text-surface-900"
                >
                    <CurrentIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{current.label}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
                {availableModes.map((mode) => {
                    const config = MODE_CONFIG[mode]
                    const Icon = config.icon
                    const isActive = currentMode === mode
                    return (
                        <DropdownMenuItem
                            key={mode}
                            onClick={() => switchMode(mode)}
                            className={cn(isActive && 'bg-accent font-medium')}
                        >
                            <Icon className="h-4 w-4" />
                            {config.label}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
