import { useRef, useEffect , useState , useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft, Camera, Thermometer, Loader2, Trash2, Download,
    RefreshCw, AlertCircle,
} from 'lucide-react'
import { useThermalCamera, type ThermalCapture } from '@/hooks/useThermalCamera'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function TechThermalCameraPage() {

    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const thermal = useThermalCamera()
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        thermal.detectDevices()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleStart = () => {
        if (videoRef.current) {
            thermal.startCapture(videoRef.current)
        }
    }

    const handleSnapshot = () => {
        const capture = thermal.takeSnapshot(id ? Number(id) : undefined)
        if (capture) toast.success('Imagem térmica capturada!')
    }

    const handleDownload = (capture: ThermalCapture) => {
        const a = document.createElement('a')
        a.href = capture.dataUrl
        a.download = `thermal-${capture.id}.jpg`
        a.click()
    }

    const osCaptures = id
        ? thermal.captures.filter(c => c.workOrderId === Number(id))
        : thermal.captures

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-surface-50 dark:bg-surface-950">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700 shrink-0">
                <button onClick={() => navigate(-1)} className="p-1" title="Voltar">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <div className="flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-orange-500" />
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Câmera Térmica
                    </h1>
                </div>
            </div>

            <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
                {/* Device Selector */}
                <section className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                            Dispositivo
                        </h3>
                        <button
                            onClick={() => thermal.detectDevices()}
                            className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1"
                        >
                            <RefreshCw className="w-3 h-3" /> Atualizar
                        </button>
                    </div>

                    {thermal.devices.length === 0 ? (
                        <p className="text-sm text-surface-500">
                            Nenhuma câmera detectada. Conecte a câmera e clique em "Atualizar".
                        </p>
                    ) : (
                        <select
                            value={thermal.selectedDevice}
                            onChange={e => thermal.setSelectedDevice(e.target.value)}
                            title="Selecionar câmera"
                            className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-900 px-3 py-2.5 text-sm text-surface-900 dark:text-surface-50"
                        >
                            {thermal.devices.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>
                                    {d.label}
                                </option>
                            ))}
                        </select>
                    )}
                </section>

                {/* Live Preview */}
                {thermal.isCapturing && (
                    <section className="bg-black rounded-xl overflow-hidden relative">
                        <video
                            ref={videoRef}
                            className="w-full aspect-[4/3] object-cover"
                            playsInline
                            muted
                        />
                        {/* Overlay crosshair */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-8 h-8 border-2 border-red-500 rounded-full opacity-60" />
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                            <button
                                onClick={handleSnapshot}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-orange-500 text-white text-sm font-medium shadow-lg active:bg-orange-600"
                            >
                                <Camera className="w-4 h-4" /> Capturar
                            </button>
                            <button
                                onClick={thermal.stopCapture}
                                className="px-4 py-2.5 rounded-full bg-red-500/80 text-white text-sm font-medium shadow-lg"
                            >
                                Parar
                            </button>
                        </div>
                    </section>
                )}

                {/* Start Button */}
                {!thermal.isCapturing && thermal.devices.length > 0 && (
                    <button
                        onClick={handleStart}
                        className={cn(
                            'w-full flex items-center justify-center gap-3 py-4 rounded-xl text-lg font-medium transition-all',
                            'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20 active:opacity-90',
                        )}
                    >
                        <Thermometer className="w-6 h-6" />
                        Iniciar Câmera Térmica
                    </button>
                )}

                {/* Captured Gallery */}
                {osCaptures.length > 0 && (
                    <section className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                            Capturas ({osCaptures.length})
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {osCaptures.slice().reverse().map(capture => (
                                <div
                                    key={capture.id}
                                    className="relative group rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700"
                                >
                                    <img
                                        src={capture.dataUrl}
                                        alt={`Captura ${capture.timestamp}`}
                                        className="w-full aspect-[4/3] object-cover"
                                    />
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 p-2">
                                        <p className="text-[10px] text-white/80 truncate">
                                            {new Date(capture.timestamp).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleDownload(capture)}
                                            title="Baixar captura"
                                            className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                                        >
                                            <Download className="w-3.5 h-3.5 text-white" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                thermal.deleteCapture(capture.id)
                                                toast.success('Captura removida')
                                            }}
                                            title="Excluir captura"
                                            className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Error */}
                {thermal.error && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400">{thermal.error}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
