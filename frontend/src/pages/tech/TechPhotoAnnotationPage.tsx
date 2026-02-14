import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Pencil, MousePointer2, Circle, Type, ArrowRight,
    Undo2, Trash2, Save, Palette, Download,
} from 'lucide-react'
import { usePhotoAnnotation } from '@/hooks/usePhotoAnnotation'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

const COLORS = ['#ff0000', '#ffff00', '#00ff00', '#0088ff', '#ff00ff', '#ffffff', '#000000']

const TOOLS = [
    { id: 'freehand' as const, icon: Pencil, label: 'Desenho livre' },
    { id: 'arrow' as const, icon: ArrowRight, label: 'Seta' },
    { id: 'circle' as const, icon: Circle, label: 'Círculo' },
    { id: 'text' as const, icon: Type, label: 'Texto' },
]

export default function TechPhotoAnnotationPage() {
  const { hasPermission } = useAuthStore()

    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ann = usePhotoAnnotation()
    const [imageLoaded, setImageLoaded] = useState(false)
    const [showColorPicker, setShowColorPicker] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleLoadImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !canvasRef.current) return

        const url = URL.createObjectURL(file)
        try {
            await ann.loadImage(canvasRef.current, url)
            setImageLoaded(true)
        } catch {
            toast.error('Erro ao carregar imagem')
        } finally {
            URL.revokeObjectURL(url)
        }
    }, [ann])

    useEffect(() => {
        if (imageLoaded) ann.redraw()
    }, [ann.annotations.length, imageLoaded]) // eslint-disable-line

    const handleSave = () => {
        const dataUrl = ann.exportAnnotated()
        if (!dataUrl) {
            toast.error('Nenhuma imagem para salvar')
            return
        }

        // Create download link
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `foto-anotada-os-${id || 'nova'}-${Date.now()}.jpg`
        a.click()
        toast.success('Foto anotada salva!')
    }

    return (
        <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-950">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700 shrink-0">
                <button onClick={() => navigate(-1)} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <div className="flex-1">
                    <h1 className="text-sm font-bold text-surface-900 dark:text-surface-50">
                        Anotação de Foto
                    </h1>
                    <p className="text-xs text-surface-500">
                        {id ? `OS #${id}` : 'Nova anotação'}
                    </p>
                </div>
                {imageLoaded && (
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium"
                    >
                        <Download className="w-4 h-4" />
                        Salvar
                    </button>
                )}
            </div>

            {/* Canvas Area */}
            <div className="flex-1 overflow-auto p-2">
                {!imageLoaded ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-32 h-32 rounded-2xl bg-surface-200 dark:bg-surface-800 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
                        >
                            <Pencil className="w-8 h-8 text-surface-400 mb-2" />
                            <p className="text-xs text-surface-500">Selecionar foto</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleLoadImage}
                        />
                        <p className="text-sm text-surface-500">
                            Tire uma foto ou selecione da galeria para anotar
                        </p>
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        className="w-full h-auto rounded-lg touch-none"
                        onMouseDown={ann.startDraw}
                        onMouseMove={ann.moveDraw}
                        onMouseUp={ann.endDraw}
                        onTouchStart={ann.startDraw}
                        onTouchMove={ann.moveDraw}
                        onTouchEnd={ann.endDraw}
                    />
                )}
            </div>

            {/* Toolbar */}
            {imageLoaded && (
                <div className="bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 px-3 py-2 shrink-0">
                    <div className="flex items-center justify-between">
                        {/* Tool selector */}
                        <div className="flex gap-1">
                            {TOOLS.map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => ann.setTool(tool.id)}
                                    title={tool.label}
                                    className={cn(
                                        'p-2.5 rounded-lg transition-colors',
                                        ann.currentTool === tool.id
                                            ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                                            : 'text-surface-500 dark:text-surface-400'
                                    )}
                                >
                                    <tool.icon className="w-5 h-5" />
                                </button>
                            ))}
                        </div>

                        {/* Color + Actions */}
                        <div className="flex items-center gap-1">
                            <div className="relative">
                                <button
                                    onClick={() => setShowColorPicker(!showColorPicker)}
                                    className="p-2.5 rounded-lg text-surface-500"
                                >
                                    <div
                                        className="w-5 h-5 rounded-full border-2 border-surface-300 dark:border-surface-500"
                                        style={{ backgroundColor: ann.currentColor }}
                                    />
                                </button>

                                {showColorPicker && (
                                    <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-surface-800 rounded-xl shadow-lg p-2 flex gap-1.5">
                                        {COLORS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => { ann.setColor(c); setShowColorPicker(false) }}
                                                className={cn(
                                                    'w-7 h-7 rounded-full border-2 transition-transform',
                                                    ann.currentColor === c
                                                        ? 'border-brand-500 scale-110'
                                                        : 'border-surface-300 dark:border-surface-500'
                                                )}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={ann.undo}
                                disabled={ann.annotations.length === 0}
                                className="p-2.5 rounded-lg text-surface-500 disabled:opacity-30"
                            >
                                <Undo2 className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => { ann.clearAll(); ann.redraw() }}
                                disabled={ann.annotations.length === 0}
                                className="p-2.5 rounded-lg text-red-500 disabled:opacity-30"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
