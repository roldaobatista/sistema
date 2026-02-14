import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

interface UsePushNotificationsReturn {
    permission: PushPermission
    isSubscribed: boolean
    isLoading: boolean
    subscribe: () => Promise<void>
    unsubscribe: () => Promise<void>
    sendTest: () => Promise<void>
}

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

export function usePushNotifications(): UsePushNotificationsReturn {
    const [permission, setPermission] = useState<PushPermission>('default')
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        checkStatus()
    }, [])

    const checkStatus = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPermission('unsupported')
            setIsLoading(false)
            return
        }

        setPermission(Notification.permission as PushPermission)

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            setIsSubscribed(!!subscription)
        } catch {
            setIsSubscribed(false)
        }

        setIsLoading(false)
    }

    const subscribe = useCallback(async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

        setIsLoading(true)
        try {
            const notifPermission = await Notification.requestPermission()
            setPermission(notifPermission as PushPermission)

            if (notifPermission !== 'granted') {
                setIsLoading(false)
                return
            }

            const { data } = await api.get('/push/vapid-key')
            const vapidPublicKey = data.publicKey

            if (!vapidPublicKey) {
                console.warn('VAPID public key not available')
                setIsLoading(false)
                return
            }

            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
            })

            const json = subscription.toJSON()

            await api.post('/push/subscribe', {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: json.keys?.p256dh,
                    auth: json.keys?.auth,
                },
            })

            setIsSubscribed(true)
        } catch (error) {
            console.error('Push subscribe error:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const unsubscribe = useCallback(async () => {
        setIsLoading(true)
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                await api.delete('/push/unsubscribe', {
                    data: { endpoint: subscription.endpoint },
                })
                await subscription.unsubscribe()
            }

            setIsSubscribed(false)
        } catch (error) {
            console.error('Push unsubscribe error:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const sendTest = useCallback(async () => {
        try {
            await api.post('/push/test')
        } catch (error) {
            console.error('Push test error:', error)
        }
    }, [])

    return { permission, isSubscribed, isLoading, subscribe, unsubscribe, sendTest }
}
