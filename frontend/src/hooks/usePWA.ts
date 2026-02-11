import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type NavigatorWithStandalone = Navigator & {
    standalone?: boolean
}

const isStandaloneMode = () =>
    window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as NavigatorWithStandalone).standalone === true

export function usePWA() {
    const [isInstallable, setIsInstallable] = useState(false)
    const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode())
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)

    useEffect(() => {
        // Register service worker
        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then((reg: ServiceWorkerRegistration) => {
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
            }).catch((err: unknown) => console.error('[SW] registration failed:', err))
        }

        // Install prompt
        const handleBeforeInstall = (e: Event) => {
            const event = e as BeforeInstallPromptEvent
            event.preventDefault()
            setDeferredPrompt(event)
            setIsInstallable(true)
        }

        const handleInstalled = () => {
            setIsInstalled(true)
            setIsInstallable(false)
            setDeferredPrompt(null)
        }

        // Online/offline
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('beforeinstallprompt', handleBeforeInstall)
        window.addEventListener('appinstalled', handleInstalled)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
            window.removeEventListener('appinstalled', handleInstalled)
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
