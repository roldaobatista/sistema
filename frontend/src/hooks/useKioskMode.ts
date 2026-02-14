import { useState, useCallback, useEffect } from 'react'

export function useKioskMode() {
    const [isActive, setIsActive] = useState(false)
    const [isSupported] = useState(() =>
        typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
    )

    // Track fullscreen changes
    useEffect(() => {
        const handleChange = () => {
            setIsActive(!!document.fullscreenElement)
        }

        document.addEventListener('fullscreenchange', handleChange)
        return () => document.removeEventListener('fullscreenchange', handleChange)
    }, [])

    // Block escape key when kiosk is active
    useEffect(() => {
        if (!isActive) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Block common exit keys
            if (
                e.key === 'Escape' ||
                (e.altKey && e.key === 'F4') ||
                (e.altKey && e.key === 'Tab') ||
                (e.ctrlKey && e.key === 'w')
            ) {
                e.preventDefault()
                e.stopPropagation()
            }
        }

        // Disable context menu
        const handleContextMenu = (e: Event) => e.preventDefault()

        document.addEventListener('keydown', handleKeyDown, { capture: true })
        document.addEventListener('contextmenu', handleContextMenu)

        // Lock body scroll
        document.body.style.overflow = 'hidden'
        document.body.style.touchAction = 'none'

        // Try to lock orientation
        try {
            (screen.orientation as any)?.lock?.('portrait').catch(() => { })
        } catch {
            // Not supported
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown, { capture: true })
            document.removeEventListener('contextmenu', handleContextMenu)
            document.body.style.overflow = ''
            document.body.style.touchAction = ''
        }
    }, [isActive])

    const enterKiosk = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false

        try {
            await document.documentElement.requestFullscreen({ navigationUI: 'hide' })

            // Try wake lock to keep screen on
            try {
                await (navigator as any).wakeLock?.request?.('screen')
            } catch {
                // Not critical
            }

            return true
        } catch {
            return false
        }
    }, [isSupported])

    const exitKiosk = useCallback(async (): Promise<void> => {
        if (document.fullscreenElement) {
            await document.exitFullscreen()
        }
    }, [])

    const toggle = useCallback(async () => {
        if (isActive) {
            await exitKiosk()
        } else {
            await enterKiosk()
        }
    }, [isActive, enterKiosk, exitKiosk])

    return {
        isActive,
        isSupported,
        enterKiosk,
        exitKiosk,
        toggle,
    }
}
