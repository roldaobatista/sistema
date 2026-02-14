import { useRef, useState , useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, ScanBarcode, Keyboard, Copy, Check, Search , Loader2 } from 'lucide-react'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export default function TechBarcodePage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['tech-barcode'],
    queryFn: () => api.get('/tech-barcode').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tech-barcode/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['tech-barcode'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { hasPermission } = useAuthStore()

    const navigate = useNavigate()
    const scanner = useBarcodeScanner()
    const videoRef = useRef<HTMLVideoElement>(null)
    const [showManualInput, setShowManualInput] = useState(false)
    const [manualValue, setManualValue] = useState('')
    const [copied, setCopied] = useState(false)

    const handleStartScan = () => {
        if (videoRef.current) {
            scanner.startScanning(videoRef.current)
        }
    }

    const handleManualSubmit = () => {
        if (manualValue.trim()) {
            scanner.manualInput(manualValue.trim())
            setShowManualInput(false)
            setManualValue('')
        }
    }

    const handleCopy = async () => {
        if (scanner.lastResult) {
            await navigator.clipboard.writeText(scanner.lastResult.rawValue)
            setCopied(true)
            toast.success('Código copiado!')
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const formatLabel: Record<string, string> = {
        qr_code: 'QR Code',
        ean_13: 'EAN-13',
        ean_8: 'EAN-8',
        code_128: 'Code 128',
        code_39: 'Code 39',
        upc_a: 'UPC-A',
        upc_e: 'UPC-E',
        data_matrix: 'Data Matrix',
        manual: 'Manual',
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-surface-50 dark:bg-surface-950">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate(-1)} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <div className="flex items-center gap-2">
                    <ScanBarcode className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Leitor de Código
                    </h1>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center px-4 py-6 space-y-4">
                {/* Camera View */}
                {scanner.isScanning && (
                    <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            playsInline
                            muted
                        />
                        {/* Scan overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-64 h-64 border-2 border-brand-400 rounded-lg">
                                <div className="w-full h-0.5 bg-brand-400 animate-pulse" style={{
                                    animation: 'scan-line 2s ease-in-out infinite',
                                }} />
                            </div>
                        </div>
                        <button
                            onClick={scanner.stopScanning}
                            className="absolute bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            Parar
                        </button>
                    </div>
                )}

                {/* Result Display */}
                {scanner.lastResult && (
                    <div className="w-full bg-white dark:bg-surface-800/80 rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <Check className="w-5 h-5" />
                            <span className="text-sm font-semibold">Código detectado</span>
                        </div>

                        <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-4">
                            <p className="text-xs text-surface-400 mb-1">
                                {formatLabel[scanner.lastResult.format] || scanner.lastResult.format}
                            </p>
                            <p className="text-lg font-mono font-bold text-surface-900 dark:text-surface-50 break-all">
                                {scanner.lastResult.rawValue}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleCopy}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copiado!' : 'Copiar'}
                            </button>
                            <button
                                onClick={() => {
                                    scanner.clearResult()
                                    handleStartScan()
                                }}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-200 text-sm font-medium"
                            >
                                <Camera className="w-4 h-4" />
                                Escanear outro
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                navigate(`/tech?search=${encodeURIComponent(scanner.lastResult!.rawValue)}`)
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-brand-500 text-brand-600 dark:text-brand-400 text-sm font-medium"
                        >
                            <Search className="w-4 h-4" />
                            Buscar este código nas OS
                        </button>
                    </div>
                )}

                {/* Action buttons */}
                {!scanner.isScanning && !scanner.lastResult && (
                    <div className="w-full space-y-3">
                        <button
                            onClick={handleStartScan}
                            className={cn(
                                'w-full flex items-center justify-center gap-3 py-4 rounded-xl text-lg font-medium transition-all',
                                'bg-brand-600 text-white active:bg-brand-700 shadow-lg shadow-brand-600/20',
                            )}
                        >
                            <Camera className="w-6 h-6" />
                            Escanear Código de Barras
                        </button>

                        <button
                            onClick={() => setShowManualInput(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-200"
                        >
                            <Keyboard className="w-4 h-4" />
                            Digitar código manualmente
                        </button>

                        {!scanner.isSupported && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                    Barcode Detection API não suportada neste navegador.
                                    Use a entrada manual.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Manual Input */}
                {showManualInput && (
                    <div className="w-full bg-white dark:bg-surface-800/80 rounded-xl p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                            Digite o código
                        </h3>
                        <input
                            type="text"
                            value={manualValue}
                            onChange={e => setManualValue(e.target.value)}
                            placeholder="Ex: 7891234567890"
                            className="w-full px-4 py-3 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-50 text-lg font-mono"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowManualInput(false); setManualValue('') }}
                                className="flex-1 py-2.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-200 text-sm font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleManualSubmit}
                                disabled={!manualValue.trim()}
                                className="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                )}

                {/* Error */}
                {scanner.error && (
                    <div className="w-full bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                        <p className="text-sm text-red-600 dark:text-red-400">{scanner.error}</p>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes scan-line {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(255px); }
                }
            `}</style>
        </div>
    )
}
