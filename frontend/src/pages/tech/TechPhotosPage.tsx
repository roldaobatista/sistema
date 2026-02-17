import { useState, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Camera, Trash2, Plus, Image as ImageIcon,
    Loader2, Columns2, Grid3X3,
} from 'lucide-react'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import { generateUlid } from '@/lib/offlineDb'
import { cn } from '@/lib/utils'

const PHOTO_TAGS = ['before', 'after', 'general'] as const
type PhotoTag = (typeof PHOTO_TAGS)[number]

function PhotoCard({ photo, onRemove }: { photo: any; onRemove: (id: string) => void }) {
    if (!photo) {
        return (
            <div className="rounded-xl overflow-hidden bg-surface-100 aspect-square flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-surface-400" />
            </div>
        )
    }
    return (
        <div className="relative rounded-xl overflow-hidden bg-surface-100 aspect-square">
            {photo.preview ? (
                <img src={photo.preview} alt="Foto" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-surface-400" />
                </div>
            )}
            {!photo.synced && (
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold">
                    PENDENTE
                </span>
            )}
            <button
                onClick={() => { if (confirm('Deseja remover esta foto?')) onRemove(photo.id) }}
                aria-label="Remover foto"
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1">
                <p className="text-[10px] text-white/80">
                    {new Date(photo.created_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                    })}
                </p>
            </div>
        </div>
    )
}

async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                if (width > maxWidth) {
                    height = (height * maxWidth) / width
                    width = maxWidth
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')!
                ctx.drawImage(img, 0, 0, width, height)
                canvas.toBlob(
                    (blob) => resolve(blob || file),
                    'image/jpeg',
                    quality
                )
            }
            img.onerror = () => resolve(file)
            img.src = e.target?.result as string
        }
        reader.onerror = () => resolve(file)
        reader.readAsDataURL(file)
    })
}

export default function TechPhotosPage() {

    const { id: woId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { items: allPhotos, put: putPhoto, remove } = useOfflineStore('photos')
    const inputRef = useRef<HTMLInputElement>(null)
    const [saving, setSaving] = useState(false)
    const [selectedTag, setSelectedTag] = useState<PhotoTag>('general')
    const [viewMode, setViewMode] = useState<'gallery' | 'compare'>('gallery')

    const photos = allPhotos.filter((p: any) => p.work_order_id === Number(woId) && p.entity_type !== 'expense')

    const beforePhotos = useMemo(() =>
        photos.filter((p: any) => p.entity_type === 'before').sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ), [photos])
    const afterPhotos = useMemo(() =>
        photos.filter((p: any) => p.entity_type === 'after').sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ), [photos])
    const hasComparison = beforePhotos.length > 0 && afterPhotos.length > 0

    const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !woId) return
        setSaving(true)

        try {
            const compressed = await compressImage(file)
            const preview = URL.createObjectURL(compressed)
            await putPhoto({
                id: generateUlid(),
                work_order_id: Number(woId),
                entity_type: selectedTag,
                entity_id: null,
                blob: compressed,
                synced: false,
                created_at: new Date().toISOString(),
                preview,
            } as any)
            toast.success('Foto salva')
        } catch (err) {
            toast.error('Erro ao salvar foto. Tente novamente.')
        } finally {
            setSaving(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button onClick={() => navigate(`/tech/os/${woId}`)} className="flex items-center gap-1 text-sm text-brand-600 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-bold text-foreground">
                        Fotos ({photos.length})
                    </h1>
                    <label className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium cursor-pointer',
                        saving && 'opacity-70 pointer-events-none',
                    )}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Tirar Foto
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleCapture}
                            className="hidden"
                        />
                    </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-surface-500 self-center">Tag:</span>
                    {(['before', 'after', 'general'] as const).map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedTag(tag)}
                            className={cn(
                                'px-2.5 py-1 rounded-md text-xs font-medium',
                                selectedTag === tag
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-surface-200 text-surface-600',
                            )}
                        >
                            {tag === 'before' ? 'Antes' : tag === 'after' ? 'Depois' : 'Geral'}
                        </button>
                    ))}
                </div>

                {hasComparison && (
                    <div className="mt-2 flex gap-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('gallery')}
                            className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                                viewMode === 'gallery'
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-surface-200 text-surface-600',
                            )}
                        >
                            <Grid3X3 className="w-3.5 h-3.5" /> Galeria
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('compare')}
                            className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                                viewMode === 'compare'
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-surface-200 text-surface-600',
                            )}
                        >
                            <Columns2 className="w-3.5 h-3.5" /> Antes/Depois
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {photos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <ImageIcon className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500">Nenhuma foto registrada</p>
                        <label className="text-sm text-brand-600 font-medium cursor-pointer">
                            <Camera className="w-4 h-4 inline mr-1" />
                            Capturar foto
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleCapture}
                                className="hidden"
                            />
                        </label>
                    </div>
                ) : viewMode === 'compare' && hasComparison ? (
                    <div className="space-y-4">
                        {Array.from({ length: Math.max(beforePhotos.length, afterPhotos.length) }).map((_, i) => (
                            <div key={i} className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-medium text-surface-500 uppercase">Antes</p>
                                    {beforePhotos[i] ? <PhotoCard photo={beforePhotos[i]} onRemove={remove} /> : <div className="aspect-square rounded-lg bg-surface-100 flex items-center justify-center text-xs text-surface-400">—</div>}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-medium text-surface-500 uppercase">Depois</p>
                                    {afterPhotos[i] ? <PhotoCard photo={afterPhotos[i]} onRemove={remove} /> : <div className="aspect-square rounded-lg bg-surface-100 flex items-center justify-center text-xs text-surface-400">—</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {photos.map((photo: any) => (
                            <PhotoCard key={photo.id} photo={photo} onRemove={remove} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
