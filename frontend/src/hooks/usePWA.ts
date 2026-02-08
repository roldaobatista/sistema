import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWA() {
    const [isInstallable, setIsInstallable] = useState(false)
    const [isInstalled, setIsInstalled] = useState(false)
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)

    useEffect(() => {
        // Register service worker
        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
            (navigator as any).serviceWorker.register('/sw.js').then((reg: ServiceWorkerRegistration) => {
                setSwRegistration(reg)
                console.log('[SW] registered:', reg.scope)

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                console.log('[SW] new version activated')
                            }
                        })
                    }
                })
            }).catch((err: any) => console.error('[SW] registration failed:', err))
        }

        // Install prompt
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setIsInstallable(true)
        }

        // Detect standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true
        setIsInstalled(isStandalone)

        // Online/offline
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('beforeinstallprompt', handleBeforeInstall)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const install = useCallback(async () => {
        if (!deferredPrompt) return false
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        setDeferredPrompt(null)
        setIsInstallable(false)
        if (outcome === 'accepted') {
            setIsInstalled(true)
            return true
        }
        return false
    }, [deferredPrompt])

    return { isInstallable, isInstalled, isOnline, install, swRegistration }
}
