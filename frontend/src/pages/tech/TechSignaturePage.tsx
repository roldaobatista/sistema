import { useRef, useState, useCallback, useEffect , useMemo } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle2, RotateCcw } from 'lucide-react'
import { offlinePost } from '@/lib/syncEngine'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import { generateUlid } from '@/lib/offlineDb'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export default function TechSignaturePage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['tech-signature'],
    queryFn: () => api.get('/tech-signature').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tech-signature/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['tech-signature'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Search
  const [searchTerm, setSearchTerm] = useState('')

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { hasPermission } = useAuthStore()

    const { id: woId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const { put: putSignature } = useOfflineStore('signatures')
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasStrokes, setHasStrokes] = useState(false)
    const [signerName, setSignerName] = useState('')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Setup canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Retina support
        const rect = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2.5
        ctx.strokeStyle = '#1e293b'

        // Fill white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, rect.width, rect.height)
    }, [])

    const getPos = (e: React.TouchEvent | React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        if ('touches' in e) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top,
            }
        }
        return {
            x: (e as React.MouseEvent).clientX - rect.left,
            y: (e as React.MouseEvent).clientY - rect.top,
        }
    }

    const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
        const ctx = canvasRef.current?.getContext('2d')
        if (!ctx) return
        const pos = getPos(e)
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
        setIsDrawing(true)
        setHasStrokes(true)
    }

    const draw = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDrawing) return
        const ctx = canvasRef.current?.getContext('2d')
        if (!ctx) return
        const pos = getPos(e)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
    }

    const endDraw = () => setIsDrawing(false)

    const clearCanvas = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, rect.width, rect.height)
        setHasStrokes(false)
        setSaved(false)
    }

    const handleSave = useCallback(async () => {
        const canvas = canvasRef.current
        if (!canvas || !woId || !hasStrokes) return
        setSaving(true)

        try {
            // Get PNG base64
            const dataUrl = canvas.toDataURL('image/png')
            const base64 = dataUrl.split(',')[1]

            const signatureData = {
                id: generateUlid(),
                work_order_id: Number(woId),
                signer_name: signerName,
                png_base64: base64,
                captured_at: new Date().toISOString(),
                synced: false,
            }

            // Save locally
            await putSignature(signatureData as any)

            // Queue for sync
            await offlinePost('/tech/sync/batch', {
                mutations: [{
                    type: 'signature',
                    data: signatureData,
                }],
            })

            setSaved(true)
        } catch {
            // Will retry
        } finally {
            setSaving(false)
        }
    }, [woId, hasStrokes, signerName, putSignature])

    return (
        <div className="flex flex-col h-full bg-white dark:bg-surface-950">
            {/* Header */}
            <div className="px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate(`/tech/os/${woId}`)} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Assinatura do Cliente</h1>
            </div>

            {/* Signer name */}
            <div className="px-4 py-3">
                <label className="text-xs text-surface-500 font-medium mb-1.5 block">Nome do assinante</label>
                <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-800 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                />
            </div>

            {/* Canvas */}
            <div className="flex-1 px-4 pb-4">
                <div className="relative h-full rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-600 overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        className="w-full h-full touch-none cursor-crosshair"
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={endDraw}
                    />

                    {!hasStrokes && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <p className="text-sm text-surface-400">Assine aqui</p>
                        </div>
                    )}

                    {/* Clear button */}
                    {hasStrokes && (
                        <button
                            onClick={clearCanvas}
                            aria-label="Limpar assinatura"
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-500 shadow-sm"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Save */}
            <div className="p-4 border-t border-surface-200 dark:border-surface-700 safe-area-bottom">
                <button
                    onClick={handleSave}
                    disabled={saving || !hasStrokes}
                    className={cn(
                        'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors',
                        saved
                            ? 'bg-emerald-600'
                            : hasStrokes
                                ? 'bg-brand-600 active:bg-brand-700'
                                : 'bg-surface-300 dark:bg-surface-700',
                        saving && 'opacity-70',
                    )}
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                        <><CheckCircle2 className="w-4 h-4" /> Assinatura Salva</>
                    ) : (
                        'Salvar Assinatura'
                    )}
                </button>
            </div>
        </div>
    )
}
