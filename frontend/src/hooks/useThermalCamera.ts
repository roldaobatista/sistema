import { useState, useCallback, useRef, useEffect } from 'react'

export interface ThermalCapture {
    id: string
    dataUrl: string
    timestamp: string
    deviceLabel: string
    workOrderId?: number
}

interface ThermalDevice {
    deviceId: string
    label: string
}

export function useThermalCamera() {
    const [isSupported] = useState(() =>
        typeof navigator !== 'undefined' && !!navigator.mediaDevices?.enumerateDevices
    )
    const [devices, setDevices] = useState<ThermalDevice[]>([])
    const [selectedDevice, setSelectedDevice] = useState<string>('')
    const [isCapturing, setIsCapturing] = useState(false)
    const [captures, setCaptures] = useState<ThermalCapture[]>([])
    const [error, setError] = useState<string | null>(null)

    const streamRef = useRef<MediaStream | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)

    // Load captures from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('thermal-captures')
            if (stored) setCaptures(JSON.parse(stored))
        } catch {
            // Ignore parse errors
        }
    }, [])

    const saveCaptures = useCallback((newCaptures: ThermalCapture[]) => {
        setCaptures(newCaptures)
        // Keep only last 50 captures in localStorage
        const toStore = newCaptures.slice(-50)
        localStorage.setItem('thermal-captures', JSON.stringify(toStore))
    }, [])

    const detectDevices = useCallback(async () => {
        if (!isSupported) {
            setError('MediaDevices API não suportada')
            return
        }

        try {
            // Request camera permission first
            await navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => stream.getTracks().forEach(t => t.stop()))

            const allDevices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = allDevices
                .filter(d => d.kind === 'videoinput')
                .map(d => ({
                    deviceId: d.deviceId,
                    label: d.label || `Câmera ${d.deviceId.slice(0, 8)}`,
                }))

            setDevices(videoDevices)

            // Auto-select thermal camera if found by label
            const thermal = videoDevices.find(d =>
                d.label.toLowerCase().includes('thermal') ||
                d.label.toLowerCase().includes('flir') ||
                d.label.toLowerCase().includes('seek') ||
                d.label.toLowerCase().includes('infra')
            )
            if (thermal) {
                setSelectedDevice(thermal.deviceId)
            } else if (videoDevices.length > 0 && !selectedDevice) {
                setSelectedDevice(videoDevices[0].deviceId)
            }

            setError(null)
        } catch (err: any) {
            setError(err.message || 'Erro ao detectar câmeras')
        }
    }, [isSupported, selectedDevice])

    const startCapture = useCallback(async (videoElement: HTMLVideoElement) => {
        if (!selectedDevice) {
            setError('Selecione uma câmera')
            return
        }

        try {
            // Stop any existing stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: selectedDevice },
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            })

            streamRef.current = stream
            videoRef.current = videoElement
            videoElement.srcObject = stream
            await videoElement.play()
            setIsCapturing(true)
            setError(null)
        } catch (err: any) {
            setError(err.message || 'Erro ao iniciar câmera')
        }
    }, [selectedDevice])

    const stopCapture = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        setIsCapturing(false)
    }, [])

    const takeSnapshot = useCallback((workOrderId?: number): ThermalCapture | null => {
        const video = videoRef.current
        if (!video || !isCapturing) return null

        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Add thermal overlay: timestamp + crosshair
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(0, 0, canvas.width, 28)
        ctx.fillStyle = '#00ff00'
        ctx.font = '12px monospace'
        ctx.fillText(
            `THERMAL · ${new Date().toLocaleString('pt-BR')}`,
            8,
            18,
        )

        // Center crosshair
        const cx = canvas.width / 2
        const cy = canvas.height / 2
        ctx.strokeStyle = '#ff0000'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx - 15, cy)
        ctx.lineTo(cx + 15, cy)
        ctx.moveTo(cx, cy - 15)
        ctx.lineTo(cx, cy + 15)
        ctx.stroke()

        const deviceLabel = devices.find(d => d.deviceId === selectedDevice)?.label || 'Câmera'

        const capture: ThermalCapture = {
            id: `thermal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dataUrl: canvas.toDataURL('image/jpeg', 0.85),
            timestamp: new Date().toISOString(),
            deviceLabel,
            workOrderId,
        }

        const updated = [...captures, capture]
        saveCaptures(updated)
        return capture
    }, [isCapturing, captures, devices, selectedDevice, saveCaptures])

    const deleteCapture = useCallback((id: string) => {
        const updated = captures.filter(c => c.id !== id)
        saveCaptures(updated)
    }, [captures, saveCaptures])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
            }
        }
    }, [])

    return {
        isSupported,
        devices,
        selectedDevice,
        setSelectedDevice,
        isCapturing,
        captures,
        error,
        detectDevices,
        startCapture,
        stopCapture,
        takeSnapshot,
        deleteCapture,
    }
}
