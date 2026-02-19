import { useState, useEffect, useCallback } from 'react'

interface PushSubscriptionState {
    isSubscribed: boolean
    isSupported: boolean
    permission: NotificationPermission | 'unsupported'
    loading: boolean
}

const VAPID_PUBLIC_KEY_STORAGE = 'kalibrium-vapid-public-key'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function usePushSubscription() {
    const [state, setState] = useState<PushSubscriptionState>({
        isSubscribed: false,
        isSupported: false,
        permission: 'unsupported',
        loading: true,
    })

    useEffect(() => {
        const checkSupport = async () => {
            const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

            if (!supported) {
                setState({ isSubscribed: false, isSupported: false, permission: 'unsupported', loading: false })
                return
            }

            const permission = Notification.permission
            let isSubscribed = false

            try {
                const reg = await navigator.serviceWorker.ready
                const sub = await reg.pushManager.getSubscription()
                isSubscribed = !!sub
            } catch {
                // ignore
            }

            setState({ isSubscribed, isSupported: true, permission, loading: false })
        }

        checkSupport()
    }, [])

    const subscribe = useCallback(async (): Promise<boolean> => {
        setState(prev => ({ ...prev, loading: true }))

        try {
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                setState(prev => ({ ...prev, permission, loading: false }))
                return false
            }

            const reg = await navigator.serviceWorker.ready

            // Get VAPID key from meta tag or env variable
            let vapidKey = document.querySelector<HTMLMetaElement>('meta[name="vapid-public-key"]')?.content
            if (!vapidKey) vapidKey = localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE) ?? undefined

            const options: PushSubscriptionOptionsInit = {
                userVisibleOnly: true,
                ...(vapidKey ? { applicationServerKey: urlBase64ToUint8Array(vapidKey) } : {}),
            }

            const subscription = await reg.pushManager.subscribe(options)

            // Send subscription to backend
            try {
                const { useAuthStore } = await import('@/stores/auth-store')
                const token = useAuthStore.getState().token
                await fetch('/api/v1/push-subscriptions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ subscription: subscription.toJSON() }),
                })
            } catch {
                console.warn('[Push] Failed to send subscription to backend')
            }

            setState({ isSubscribed: true, isSupported: true, permission: 'granted', loading: false })
            return true
        } catch (err) {
            console.error('[Push] Subscribe failed:', err)
            setState(prev => ({ ...prev, loading: false }))
            return false
        }
    }, [])

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        setState(prev => ({ ...prev, loading: true }))

        try {
            const reg = await navigator.serviceWorker.ready
            const sub = await reg.pushManager.getSubscription()
            if (sub) {
                await sub.unsubscribe()

                // Notify backend
                try {
                    const { useAuthStore } = await import('@/stores/auth-store')
                    const token = useAuthStore.getState().token
                    await fetch('/api/v1/push-subscriptions', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ endpoint: sub.endpoint }),
                    })
                } catch {
                    console.warn('[Push] Failed to remove subscription from backend')
                }
            }

            setState(prev => ({ ...prev, isSubscribed: false, loading: false }))
            return true
        } catch (err) {
            console.error('[Push] Unsubscribe failed:', err)
            setState(prev => ({ ...prev, loading: false }))
            return false
        }
    }, [])

    return { ...state, subscribe, unsubscribe }
}
