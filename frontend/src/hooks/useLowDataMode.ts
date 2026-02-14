import { useState, useCallback, useEffect } from 'react'

interface LowDataModeState {
    isEnabled: boolean
    maxImageSize: number      // KB
    lazyLoadImages: boolean
    disableAnimations: boolean
    compressUploads: boolean
    connectionType: string
    isSlowConnection: boolean
}

const STORAGE_KEY = 'low-data-mode'

async function compressImage(blob: Blob, maxSizeKB: number): Promise<Blob> {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            let { width, height } = img

            // Scale down if image is very large
            const maxDim = 1280
            if (width > maxDim || height > maxDim) {
                const ratio = Math.min(maxDim / width, maxDim / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
            }

            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(img, 0, 0, width, height)

            // Try progressively lower quality
            let quality = 0.7
            const tryCompress = () => {
                canvas.toBlob(
                    (result) => {
                        if (!result) { resolve(blob); return }
                        if (result.size <= maxSizeKB * 1024 || quality <= 0.1) {
                            resolve(result)
                        } else {
                            quality -= 0.1
                            tryCompress()
                        }
                    },
                    'image/jpeg',
                    quality
                )
            }
            tryCompress()
        }
        img.src = URL.createObjectURL(blob)
    })
}

export function useLowDataMode() {
    const [state, setState] = useState<LowDataModeState>(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        const isEnabled = stored === 'true'
        return {
            isEnabled,
            maxImageSize: isEnabled ? 100 : 500,  // KB
            lazyLoadImages: isEnabled,
            disableAnimations: isEnabled,
            compressUploads: isEnabled,
            connectionType: 'unknown',
            isSlowConnection: false,
        }
    })

    // Detect connection quality
    useEffect(() => {
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
        if (!connection) return

        const updateConnection = () => {
            const type = connection.effectiveType || connection.type || 'unknown'
            const isSlow = ['slow-2g', '2g', '3g'].includes(type) || (connection.downlink && connection.downlink < 1)

            setState(s => ({
                ...s,
                connectionType: type,
                isSlowConnection: isSlow,
                // Auto-enable low data mode on slow connections
                ...(isSlow && !s.isEnabled ? {
                    isEnabled: true,
                    maxImageSize: 100,
                    lazyLoadImages: true,
                    disableAnimations: true,
                    compressUploads: true,
                } : {}),
            }))
        }

        updateConnection()
        connection.addEventListener('change', updateConnection)
        return () => connection.removeEventListener('change', updateConnection)
    }, [])

    const toggle = useCallback(() => {
        setState(s => {
            const newEnabled = !s.isEnabled
            localStorage.setItem(STORAGE_KEY, String(newEnabled))
            return {
                ...s,
                isEnabled: newEnabled,
                maxImageSize: newEnabled ? 100 : 500,
                lazyLoadImages: newEnabled,
                disableAnimations: newEnabled,
                compressUploads: newEnabled,
            }
        })
    }, [])

    const processImage = useCallback(async (blob: Blob): Promise<Blob> => {
        if (!state.compressUploads) return blob
        return compressImage(blob, state.maxImageSize)
    }, [state.compressUploads, state.maxImageSize])

    // Apply CSS for disabling animations
    useEffect(() => {
        if (state.disableAnimations) {
            document.documentElement.style.setProperty('--animation-duration', '0s')
            document.documentElement.classList.add('reduce-motion')
        } else {
            document.documentElement.style.removeProperty('--animation-duration')
            document.documentElement.classList.remove('reduce-motion')
        }
    }, [state.disableAnimations])

    return {
        ...state,
        toggle,
        processImage,
    }
}
