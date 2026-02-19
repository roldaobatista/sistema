import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh } from 'lucide-react'
import { useNetworkInfo } from '@/hooks/useNetworkInfo'
import { cn } from '@/lib/utils'

const QUALITY_CONFIG = {
    '4g': { label: '4G', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: SignalHigh },
    '3g': { label: '3G', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', icon: SignalMedium },
    '2g': { label: '2G', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', icon: SignalLow },
    'slow-2g': { label: 'Lento', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', icon: Signal },
    'unknown': { label: '', color: 'text-surface-400', bg: '', icon: Wifi },
} as const

export function NetworkBadge() {
    const { isOnline, effectiveType, downlink, rtt, saveData, supported } = useNetworkInfo()

    if (!isOnline) {
        return (
            <div
                className="flex items-center gap-1 rounded-[var(--radius-md)] bg-red-50 dark:bg-red-500/10 px-2 py-1.5 text-red-600 dark:text-red-400"
                title="Sem conexão com a internet"
            >
                <WifiOff className="h-3.5 w-3.5" />
                <span className="text-xs font-medium hidden sm:inline">Offline</span>
            </div>
        )
    }

    if (!supported) return null

    const config = QUALITY_CONFIG[effectiveType]
    const Icon = config.icon

    const tooltip = [
        `Conexão: ${config.label}`,
        downlink > 0 ? `Velocidade: ${downlink} Mbps` : null,
        rtt > 0 ? `Latência: ${rtt}ms` : null,
        saveData ? '⚠ Economia de dados ativada' : null,
    ].filter(Boolean).join('\n')

    return (
        <div
            className={cn(
                'flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors',
                config.bg
            )}
            title={tooltip}
        >
            <Icon className={cn('h-3.5 w-3.5', config.color)} />
            {config.label && (
                <span className={cn('text-xs font-medium hidden sm:inline', config.color)}>
                    {config.label}
                </span>
            )}
            {saveData && (
                <span className="text-[9px] bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded px-1 font-bold uppercase">
                    eco
                </span>
            )}
        </div>
    )
}
