import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Upload, Image as ImageIcon, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Photo {
    id: number
    file_path: string
    type: 'before' | 'after'
    caption: string | null
    created_at: string
}

interface BeforeAfterPhotosProps {
    workOrderId: number
}

export default function BeforeAfterPhotos({ workOrderId }: BeforeAfterPhotosProps) {
    const qc = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadType, setUploadType] = useState<'before' | 'after'>('before')
    const [compareMode, setCompareMode] = useState(false)

    const { data: attachRes } = useQuery({
        queryKey: ['work-order-attachments', workOrderId],
        queryFn: () => api.get(`/work-orders/${workOrderId}/attachments`),
    })
    const allAttachments: any[] = attachRes?.data?.data ?? []

    // Filter photo attachments by tag
    const beforePhotos = allAttachments.filter(a =>
        a.tags?.includes('before') && /\.(jpg|jpeg|png|webp|gif)$/i.test(a.file_name ?? a.original_name ?? '')
    )
    const afterPhotos = allAttachments.filter(a =>
        a.tags?.includes('after') && /\.(jpg|jpeg|png|webp|gif)$/i.test(a.file_name ?? a.original_name ?? '')
    )

    const uploadMut = useMutation({
        mutationFn: (file: File) => {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', 'photo')
            fd.append('tags', uploadType)
            fd.append('description', uploadType === 'before' ? 'Foto antes do serviço' : 'Foto depois do serviço')
            return api.post(`/work-orders/${workOrderId}/attachments`, fd)
        },
        onSuccess: () => {
            toast.success(`Foto "${uploadType === 'before' ? 'antes' : 'depois'}" salva`)
            qc.invalidateQueries({ queryKey: ['work-order-attachments', workOrderId] })
        },
        onError: () => toast.error('Erro ao enviar foto'),
    })

    const handleUpload = (type: 'before' | 'after') => {
        setUploadType(type)
        fileInputRef.current?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) uploadMut.mutate(file)
        e.target.value = ''
    }

    const getUrl = (a: any) => {
        if (a.url) return a.url
        const base = (api.defaults.baseURL ?? '').replace(/\/api\/?$/, '')
        return `${base}/storage/${a.file_path}`
    }

    const hasPhotos = beforePhotos.length > 0 || afterPhotos.length > 0

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4 text-brand-500" />
                Fotos Antes / Depois
            </h3>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-label="Upload de foto"
                onChange={handleFileChange}
            />

            {/* Upload buttons */}
            <div className="flex gap-2 mb-3">
                <Button size="sm" variant="outline" onClick={() => handleUpload('before')}
                    loading={uploadMut.isPending && uploadType === 'before'}
                    icon={<Camera className="h-3.5 w-3.5" />}>
                    Antes
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleUpload('after')}
                    loading={uploadMut.isPending && uploadType === 'after'}
                    icon={<Camera className="h-3.5 w-3.5" />}>
                    Depois
                </Button>
            </div>

            {/* Photo grid */}
            {hasPhotos && (
                <div className="space-y-3">
                    {compareMode && beforePhotos.length > 0 && afterPhotos.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">Antes</p>
                                <img src={getUrl(beforePhotos[0])} alt="Antes" className="rounded-lg w-full h-24 object-cover border border-red-200" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Depois</p>
                                <img src={getUrl(afterPhotos[0])} alt="Depois" className="rounded-lg w-full h-24 object-cover border border-emerald-200" />
                            </div>
                        </div>
                    ) : (
                        <>
                            {beforePhotos.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">Antes ({beforePhotos.length})</p>
                                    <div className="flex gap-1.5 overflow-x-auto">
                                        {beforePhotos.map(p => (
                                            <img key={p.id} src={getUrl(p)} alt="Antes" className="rounded-lg h-16 w-16 object-cover border border-red-200 flex-shrink-0" />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {afterPhotos.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Depois ({afterPhotos.length})</p>
                                    <div className="flex gap-1.5 overflow-x-auto">
                                        {afterPhotos.map(p => (
                                            <img key={p.id} src={getUrl(p)} alt="Depois" className="rounded-lg h-16 w-16 object-cover border border-emerald-200 flex-shrink-0" />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {beforePhotos.length > 0 && afterPhotos.length > 0 && (
                        <button
                            onClick={() => setCompareMode(!compareMode)}
                            className="text-[11px] text-brand-600 hover:text-brand-700 font-medium"
                        >
                            {compareMode ? 'Ver todas' : 'Comparar lado a lado'}
                        </button>
                    )}
                </div>
            )}

            {!hasPhotos && (
                <p className="text-xs text-surface-400 text-center py-2">
                    Nenhuma foto registrada
                </p>
            )}
        </div>
    )
}
