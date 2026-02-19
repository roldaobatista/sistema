import { Bell, BellOff, BellRing, Loader2, ShieldAlert } from 'lucide-react'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { cn } from '@/lib/utils'

export function PushNotificationSettings() {
    const { isSubscribed, isSupported, permission, loading, subscribe, unsubscribe } = usePushSubscription()

    if (!isSupported) {
        return (
            <div className="rounded-xl border border-surface-200 dark:border-white/10 p-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-surface-100 dark:bg-white/5 p-2">
                        <BellOff className="h-5 w-5 text-surface-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                            Notificações Push
                        </h4>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Seu navegador não suporta notificações push.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (permission === 'denied') {
        return (
            <div className="rounded-xl border border-red-200 dark:border-red-800/30 bg-red-50 dark:bg-red-900/10 p-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
                        <ShieldAlert className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-red-700 dark:text-red-300">
                            Notificações Bloqueadas
                        </h4>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            As notificações foram bloqueadas pelo navegador. Acesse as configurações do site para permitir.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-surface-200 dark:border-white/10 p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                    <div className={cn(
                        'rounded-lg p-2',
                        isSubscribed
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-surface-100 dark:bg-white/5'
                    )}>
                        {isSubscribed ? (
                            <BellRing className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                            <Bell className="h-5 w-5 text-surface-400" />
                        )}
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                            Notificações Push
                        </h4>
                        <p className="text-xs text-surface-400 mt-0.5">
                            {isSubscribed
                                ? 'Você receberá notificações em tempo real.'
                                : 'Ative para receber notificações de OS, CRM e alertas.'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={isSubscribed ? unsubscribe : subscribe}
                    disabled={loading}
                    className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
                        isSubscribed ? 'bg-emerald-500' : 'bg-surface-300 dark:bg-surface-600',
                        loading && 'opacity-60 cursor-wait'
                    )}
                >
                    <span className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform duration-200',
                        isSubscribed ? 'translate-x-[22px]' : 'translate-x-0.5'
                    )}>
                        {loading && <Loader2 className="h-3 w-3 animate-spin text-surface-400" />}
                    </span>
                </button>
            </div>
        </div>
    )
}
