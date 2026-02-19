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
    const [hasUpdate, setHasUpdate] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

    useEffect(() => {
        let updateIntervalId: ReturnType<typeof setInterval> | undefined
        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then((reg: ServiceWorkerRegistration) => {
                setSwRegistration(reg)
                console.log('[SW] registered:', reg.scope)

                // Check if there's already a waiting worker
                if (reg.waiting) {
                    setWaitingWorker(reg.waiting)
                    setHasUpdate(true)
                }

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                setWaitingWorker(newWorker)
                                setHasUpdate(true)
                                setSwRegistration(reg)
                            }
                        })
                    }
                })
                updateIntervalId = setInterval(() => reg.update(), 30 * 60 * 1000)
            }).catch((err: unknown) => console.error('[SW] registration failed:', err))

            // Listen for controller change (after SKIP_WAITING) to reload
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload()
            })
        }
        return () => {
            if (updateIntervalId) clearInterval(updateIntervalId)
        }
    }, [])

    useEffect(() => {
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

    const applyUpdate = useCallback(() => {
        if (!waitingWorker) return
        waitingWorker.postMessage({ type: 'SKIP_WAITING' })
        setHasUpdate(false)
        setWaitingWorker(null)
    }, [waitingWorker])

    return { isInstallable, isInstalled, isOnline, install, swRegistration, hasUpdate, applyUpdate }
}
