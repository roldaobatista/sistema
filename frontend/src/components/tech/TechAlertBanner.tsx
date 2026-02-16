import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, X, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTechAlerts } from '@/hooks/useTechAlerts'

export function TechAlertBanner() {
    const navigate = useNavigate()
    const { alerts, dismiss, dismissAll } = useTechAlerts()
    const [expanded, setExpanded] = useState(false)

    if (alerts.length === 0) return null

    const topAlert = alerts[0]
    const severityStyles = {
        critical: 'bg-red-500 text-white',
        warning: 'bg-amber-500 text-white',
        info: 'bg-blue-500 text-white',
    }

    if (!expanded) {
        return (
            <button
                type="button"
                aria-label={`${alerts.length} alerta${alerts.length > 1 ? 's' : ''}. Toque para expandir`}
                onClick={() => setExpanded(true)}
                className={cn(
                    'w-full px-4 py-2 flex items-center gap-2 text-xs font-medium',
                    severityStyles[topAlert.severity]
                )}
            >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{topAlert.title}: {topAlert.message}</span>
                {alerts.length > 1 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                        +{alerts.length - 1}
                    </span>
                )}
            </button>
        )
    }

    return (
        <div className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
            <div className="flex items-center justify-between px-4 py-2 border-b border-surface-100 dark:border-surface-800">
                <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold text-surface-900 dark:text-surface-50">
                        {alerts.length} alerta{alerts.length > 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label="Limpar todos os alertas"
                        onClick={dismissAll}
                        className="text-[10px] text-surface-500 hover:text-surface-700"
                    >
                        Limpar todos
                    </button>
                    <button type="button" aria-label="Fechar painel de alertas" onClick={() => setExpanded(false)} className="p-1">
                        <X className="w-4 h-4 text-surface-400" />
                    </button>
                </div>
            </div>
            <div className="max-h-40 overflow-y-auto">
                {alerts.map(alert => (
                    <div key={alert.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-50 dark:border-surface-800 last:border-0">
                        <AlertTriangle className={cn(
                            'w-4 h-4 flex-shrink-0',
                            alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
                        )} />
                        <div
                            role="button"
                            tabIndex={0}
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => alert.workOrderId && navigate(`/tech/os/${alert.workOrderId}`)}
                            onKeyDown={(e) => e.key === 'Enter' && alert.workOrderId && navigate(`/tech/os/${alert.workOrderId}`)}
                        >
                            <p className="text-xs font-medium text-surface-900 dark:text-surface-50 truncate">{alert.title}</p>
                            <p className="text-[10px] text-surface-500 truncate">{alert.message}</p>
                        </div>
                        <button type="button" aria-label={`Dispensar alerta: ${alert.title}`} onClick={() => dismiss(alert.id)} className="p-1 flex-shrink-0">
                            <X className="w-3.5 h-3.5 text-surface-400" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
