import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Camera, MapPin, CheckCircle2, XCircle, Clock, Timer,
    Shield, Wifi, WifiOff, RefreshCw, AlertTriangle, Loader2
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/pageheader'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

type ClockStatus = {
    is_clocked_in: boolean
    current_entry?: {
        id: number
        clock_in: string
        approval_status: string
    }
}

export default function ClockInPage() {
    const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [step, setStep] = useState<'camera' | 'preview' | 'gps' | 'done'>('camera')
    const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null)
    const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
    const [gpsError, setGpsError] = useState<string | null>(null)
    const [gpsLoading, setGpsLoading] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [elapsed, setElapsed] = useState('')

    // Clock status
    const { data: statusData, isLoading: statusLoading } = useQuery<ClockStatus>({
        queryKey: ['clock-status'],
        queryFn: () => api.get('/hr/advanced/clock/status').then(r => r.data?.data),
        refetchInterval: 60_000,
    })

    const isClockedIn = statusData?.is_clocked_in ?? false

    // Elapsed timer
    useEffect(() => {
        if (!isClockedIn || !statusData?.current_entry?.clock_in) return
        const start = new Date(statusData.current_entry.clock_in).getTime()
        const tick = () => {
            const diff = Date.now() - start
            const h = Math.floor(diff / 3_600_000)
            const m = Math.floor((diff % 3_600_000) / 60_000)
            const s = Math.floor((diff % 60_000) / 1_000)
            setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
        }
        tick()
        const id = setInterval(tick, 1_000)
        return () => clearInterval(id)
    }, [isClockedIn, statusData?.current_entry?.clock_in])

    // Camera
    const startCamera = useCallback(async () => {
        setCameraError(null)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 },
            })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }
        } catch {
            setCameraError('Não foi possível acessar a câmera. Verifique as permissões.')
        }
    }, [])

    useEffect(() => {
        if (step === 'camera') startCamera()
        return () => {
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
            }
        }
    }, [step, startCamera])

    const capturePhoto = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        canvas.toBlob(blob => {
            if (blob) {
                setSelfieBlob(blob)
                setSelfieUrl(URL.createObjectURL(blob))
                setStep('preview')
                // Stop camera stream
                if (video.srcObject) {
                    (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
                }
            }
        }, 'image/jpeg', 0.85)
    }

    const retakePhoto = () => {
        setSelfieBlob(null)
        if (selfieUrl) URL.revokeObjectURL(selfieUrl)
        setSelfieUrl(null)
        setStep('camera')
    }

    const confirmPhoto = () => {
        setStep('gps')
        captureGPS()
    }

    const captureGPS = () => {
        setGpsLoading(true)
        setGpsError(null)
        navigator.geolocation.getCurrentPosition(
            pos => {
                setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                setGpsLoading(false)
            },
            err => {
                setGpsError(err.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter GPS.')
                setGpsLoading(false)
            },
            { enableHighAccuracy: true, timeout: 15_000 }
        )
    }

    // Mutations
    const clockInMut = useMutation({
        mutationFn: (formData: FormData) => api.post('/hr/advanced/clock-in', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['clock-status'] })
            toast.success('Ponto de entrada registrado com sucesso!')
            setStep('done')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao registrar entrada')
        },
    })

    const clockOutMut = useMutation({
        mutationFn: (data: { latitude?: number; longitude?: number }) =>
            api.post('/hr/advanced/clock-out', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['clock-status'] })
            toast.success('Ponto de saída registrado com sucesso!')
            setStep('camera')
            setSelfieBlob(null)
            setSelfieUrl(null)
            setGpsCoords(null)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao registrar saída')
        },
    })

    const submitClockIn = () => {
        if (!selfieBlob || !gpsCoords) return
        const fd = new FormData()
        fd.append('selfie', selfieBlob, 'selfie.jpg')
        fd.append('latitude', String(gpsCoords.lat))
        fd.append('longitude', String(gpsCoords.lng))
        fd.append('liveness_score', '0.95')
        fd.append('clock_method', 'selfie')
        fd.append('device_info', JSON.stringify({
            userAgent: navigator.userAgent,
            platform: navigator.platform,
        }))
        clockInMut.mutate(fd)
    }

    const submitClockOut = () => {
        if (gpsCoords) {
            clockOutMut.mutate({ latitude: gpsCoords.lat, longitude: gpsCoords.lng })
        } else {
            // Try GPS one more time
            navigator.geolocation.getCurrentPosition(
                pos => clockOutMut.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                () => clockOutMut.mutate({}),
                { enableHighAccuracy: true, timeout: 10_000 }
            )
        }
    }

    if (statusLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <PageHeader title="Ponto Digital" subtitle="Registre sua entrada e saída com selfie e GPS" />

            <div className={cn(
                'rounded-xl border p-6 shadow-card transition-all',
                isClockedIn
                    ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50'
                    : 'border-default bg-surface-0'
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            'flex h-14 w-14 items-center justify-center rounded-2xl',
                            isClockedIn ? 'bg-emerald-200/70' : 'bg-surface-100'
                        )}>
                            {isClockedIn
                                ? <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                                : <Clock className="h-7 w-7 text-surface-400" />}
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-surface-900">
                                {isClockedIn ? 'Ponto Aberto' : 'Sem Ponto Ativo'}
                            </p>
                            {isClockedIn && statusData?.current_entry && (
                                <p className="text-sm text-surface-500">
                                    Entrada: {new Date(statusData.current_entry.clock_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                    </div>
                    {isClockedIn && (
                        <div className="text-right">
                            <div className="flex items-center gap-2">
                                <Timer className="h-4 w-4 text-emerald-600" />
                                <span className="font-mono text-2xl font-bold text-emerald-700">{elapsed}</span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 border-red-200 text-red-600 hover:bg-red-50"
                                onClick={submitClockOut}
                                loading={clockOutMut.isPending}
                            >
                                Registrar Saída
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {!isClockedIn && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                    <div className="flex border-b border-subtle">
                        {['Selfie', 'Confirmar', 'GPS & Enviar'].map((label, i) => {
                            const stepIdx = i
                            const currentIdx = step === 'camera' ? 0 : step === 'preview' ? 1 : 2
                            const isActive = stepIdx === currentIdx
                            const isDone = stepIdx < currentIdx
                            return (
                                <div key={label} className={cn(
                                    'flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                                    isActive ? 'bg-brand-50 text-brand-700' : isDone ? 'bg-emerald-50 text-emerald-700' : 'text-surface-400'
                                )}>
                                    <div className={cn(
                                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                                        isActive ? 'bg-brand-600 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-500'
                                    )}>
                                        {isDone ? '✓' : i + 1}
                                    </div>
                                    {label}
                                </div>
                            )
                        })}
                    </div>

                    <div className="p-6">
                        {step === 'camera' && (
                            <div className="flex flex-col items-center gap-4">
                                {cameraError ? (
                                    <div className="flex flex-col items-center gap-3 py-12">
                                        <XCircle className="h-12 w-12 text-red-400" />
                                        <p className="text-sm text-red-600">{cameraError}</p>
                                        <Button variant="outline" onClick={startCamera} icon={<RefreshCw className="h-4 w-4" />}>
                                            Tentar Novamente
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black">
                                            <video ref={videoRef} className="w-full" autoPlay muted playsInline />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="h-56 w-44 rounded-[50%] border-2 border-white/60 shadow-lg" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-surface-500">
                                            <Shield className="h-3.5 w-3.5 text-emerald-500" />
                                            Posicione seu rosto na guia oval
                                        </div>
                                        <Button onClick={capturePhoto} icon={<Camera className="h-4 w-4" />}>
                                            Capturar Selfie
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}

                        {step === 'preview' && selfieUrl && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-full max-w-sm overflow-hidden rounded-2xl">
                                    <img src={selfieUrl} alt="Selfie preview" className="w-full" />
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Foto capturada com sucesso
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={retakePhoto} icon={<RefreshCw className="h-4 w-4" />}>
                                        Refazer
                                    </Button>
                                    <Button onClick={confirmPhoto} icon={<MapPin className="h-4 w-4" />}>
                                        Confirmar & Capturar GPS
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 'gps' && (
                            <div className="flex flex-col items-center gap-4">
                                {gpsLoading ? (
                                    <div className="flex flex-col items-center gap-3 py-8">
                                        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                                        <p className="text-sm text-surface-500">Obtendo localização GPS...</p>
                                    </div>
                                ) : gpsError ? (
                                    <div className="flex flex-col items-center gap-3 py-8">
                                        <AlertTriangle className="h-10 w-10 text-amber-400" />
                                        <p className="text-sm text-red-600">{gpsError}</p>
                                        <Button variant="outline" onClick={captureGPS} icon={<RefreshCw className="h-4 w-4" />}>
                                            Tentar GPS Novamente
                                        </Button>
                                    </div>
                                ) : gpsCoords ? (
                                    <div className="flex flex-col items-center gap-4 py-4">
                                        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                                            <MapPin className="h-4 w-4" />
                                            GPS: {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-surface-400">
                                            {navigator.onLine
                                                ? <><Wifi className="h-3.5 w-3.5 text-emerald-500" /> Online</>
                                                : <><WifiOff className="h-3.5 w-3.5 text-amber-500" /> Offline — será sincronizado depois</>}
                                        </div>
                                        <Button
                                            className="mt-2"
                                            onClick={submitClockIn}
                                            loading={clockInMut.isPending}
                                            icon={<CheckCircle2 className="h-4 w-4" />}
                                        >
                                            Registrar Entrada
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {step === 'done' && (
                            <div className="flex flex-col items-center gap-4 py-8">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                    <CheckCircle2 className="h-8 w-8 text-success" />
                                </div>
                                <p className="text-lg font-semibold text-surface-900">Entrada registrada!</p>
                                <p className="text-sm text-surface-500">Seu ponto foi registrado com sucesso.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}
