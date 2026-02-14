import { useState, useRef, useCallback, useEffect } from 'react'

interface BarcodeScanResult {
    rawValue: string
    format: string
    timestamp: number
}

export function useBarcodeScanner() {
    const [isScanning, setIsScanning] = useState(false)
    const [lastResult, setLastResult] = useState<BarcodeScanResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isSupported, setIsSupported] = useState(false)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const detectorRef = useRef<any>(null)
    const animFrameRef = useRef<number>(0)

    useEffect(() => {
        const checkSupport = async () => {
            if ('BarcodeDetector' in window) {
                setIsSupported(true)
            }
        }
        checkSupport()
    }, [])

    const stopScanning = useCallback(() => {
        setIsScanning(false)
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current)
            animFrameRef.current = 0
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
    }, [])

    const startScanning = useCallback(async (video: HTMLVideoElement) => {
        setError(null)
        videoRef.current = video

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            })
            streamRef.current = stream
            video.srcObject = stream
            await video.play()

            if ('BarcodeDetector' in window) {
                const BarcodeDetectorClass = (window as any).BarcodeDetector
                detectorRef.current = new BarcodeDetectorClass({
                    formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix'],
                })
            }

            setIsScanning(true)

            const detect = async () => {
                if (!detectorRef.current || !videoRef.current || videoRef.current.readyState < 2) {
                    animFrameRef.current = requestAnimationFrame(detect)
                    return
                }

                try {
                    const barcodes = await detectorRef.current.detect(videoRef.current)
                    if (barcodes.length > 0) {
                        const result: BarcodeScanResult = {
                            rawValue: barcodes[0].rawValue,
                            format: barcodes[0].format,
                            timestamp: Date.now(),
                        }
                        setLastResult(result)
                        stopScanning()
                        return
                    }
                } catch {
                    // Detection frame error — continue
                }

                animFrameRef.current = requestAnimationFrame(detect)
            }

            animFrameRef.current = requestAnimationFrame(detect)
        } catch (err: any) {
            setError(err.message || 'Não foi possível acessar a câmera')
            setIsScanning(false)
        }
    }, [stopScanning])

    // Fallback: manual input for unsupported browsers
    const manualInput = useCallback((value: string) => {
        setLastResult({
            rawValue: value,
            format: 'manual',
            timestamp: Date.now(),
        })
    }, [])

    useEffect(() => {
        return () => stopScanning()
    }, [stopScanning])

    return {
        isSupported,
        isScanning,
        lastResult,
        error,
        startScanning,
        stopScanning,
        manualInput,
        clearResult: () => setLastResult(null),
    }
}
