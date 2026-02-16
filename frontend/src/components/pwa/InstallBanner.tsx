import { useState, useEffect } from 'react'
import { usePWA } from '@/hooks/usePWA'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000

function wasDismissedRecently(): boolean {
    try {
        const raw = localStorage.getItem(DISMISS_KEY)
        if (!raw) return false
        const t = Number(raw)
        return Number.isFinite(t) && Date.now() - t < DISMISS_TTL_MS
    } catch {
        return false
    }
}

function setDismissed() {
    try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
        // ignore
    }
}

export function InstallBanner() {
    const { isInstallable, isInstalled, install } = usePWA()
    const [dismissed, setDismissedState] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [skipByStorage, setSkipByStorage] = useState(true)

    useEffect(() => {
        setMounted(true)
        setSkipByStorage(wasDismissedRecently())
    }, [])

    const show = mounted && isInstallable && !isInstalled && !dismissed && !skipByStorage

    if (!show) return null

    const handleDismiss = () => {
        setDismissed()
        setDismissedState(true)
    }

    return (
        <div
            className={cn(
                'fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3',
                'bg-surface-900 text-surface-100 px-4 py-3 shadow-lg safe-area-bottom',
                'border-t border-surface-700'
            )}
        >
            <p className="text-sm font-medium flex-1 min-w-0">
                Instale o Kalibrium para acesso rápido, mesmo offline.
            </p>
            <div className="flex items-center gap-2 shrink-0">
                <Button
                    size="sm"
                    variant="primary"
                    className="gap-1.5"
                    onClick={() => install().then(() => setDismissedState(true))}
                >
                    <Download className="h-3.5 w-3.5" />
                    Instalar
                </Button>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="rounded-md p-1.5 text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
                    aria-label="Agora não"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
