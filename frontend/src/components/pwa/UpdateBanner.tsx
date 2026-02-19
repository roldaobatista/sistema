import { RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { usePWA } from '@/hooks/usePWA'
import { cn } from '@/lib/utils'

export function UpdateBanner() {
    const { hasUpdate, applyUpdate } = usePWA()
    const [dismissed, setDismissed] = useState(false)

    if (!hasUpdate || dismissed) return null

    return (
        <div
            className={cn(
                'fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3',
                'bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-white shadow-lg',
                'animate-in slide-in-from-top duration-300'
            )}
        >
            <RefreshCw className="h-4 w-4 animate-spin-slow shrink-0" />
            <span className="text-sm font-medium">
                Nova versão disponível!
            </span>
            <button
                onClick={applyUpdate}
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors backdrop-blur-sm"
            >
                Atualizar agora
            </button>
            <button
                onClick={() => setDismissed(true)}
                className="ml-1 rounded-full p-1 hover:bg-white/20 transition-colors"
                aria-label="Dispensar"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}
