import { useState, useEffect } from 'react'

interface NetworkConnection extends EventTarget {
    effectiveType: '4g' | '3g' | '2g' | 'slow-2g'
    downlink: number
    rtt: number
    saveData: boolean
    addEventListener(type: 'change', listener: () => void): void
    removeEventListener(type: 'change', listener: () => void): void
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkConnection
    mozConnection?: NetworkConnection
    webkitConnection?: NetworkConnection
}

export interface NetworkInfo {
    isOnline: boolean
    effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown'
    downlink: number
    rtt: number
    saveData: boolean
    supported: boolean
}

function getConnection(): NetworkConnection | undefined {
    const nav = navigator as NavigatorWithConnection
    return nav.connection ?? nav.mozConnection ?? nav.webkitConnection
}

function readInfo(): NetworkInfo {
    const conn = getConnection()
    return {
        isOnline: navigator.onLine,
        effectiveType: conn?.effectiveType ?? 'unknown',
        downlink: conn?.downlink ?? 0,
        rtt: conn?.rtt ?? 0,
        saveData: conn?.saveData ?? false,
        supported: !!conn,
    }
}

export function useNetworkInfo(): NetworkInfo {
    const [info, setInfo] = useState<NetworkInfo>(readInfo)

    useEffect(() => {
        const update = () => setInfo(readInfo())

        const conn = getConnection()
        conn?.addEventListener('change', update)
        window.addEventListener('online', update)
        window.addEventListener('offline', update)

        return () => {
            conn?.removeEventListener('change', update)
            window.removeEventListener('online', update)
            window.removeEventListener('offline', update)
        }
    }, [])

    return info
}
