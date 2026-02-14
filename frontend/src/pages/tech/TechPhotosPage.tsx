import { useState, useRef , useMemo } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Camera, Trash2, Plus, Image as ImageIcon,
    Loader2,
} from 'lucide-react'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import { generateUlid } from '@/lib/offlineDb'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export default function TechPhotosPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['tech-photos'],
    queryFn: () => api.get('/tech-photos').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tech-photos/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['tech-photos'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { hasPermission } = useAuthStore()

    const { id: woId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { items: allPhotos, put: putPhoto, remove } = useOfflineStore('photos')
    const inputRef = useRef<HTMLInputElement>(null)
    const [saving, setSaving] = useState(false)

    const photos = allPhotos.filter((p: any) => p.work_order_id === Number(woId) && p.entity_type !== 'expense')

    const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !woId) return
        setSaving(true)

        try {
            await putPhoto({
                id: generateUlid(),
                work_order_id: Number(woId),
                entity_type: 'general',
                entity_id: null,
                blob: file,
                synced: false,
                created_at: new Date().toISOString(),
                preview: URL.createObjectURL(file),
            } as any)
        } catch {
            // Ignore
        } finally {
            setSaving(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate(`/tech/os/${woId}`)} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
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
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {photos.map((photo: any) => (
                            <div key={photo.id} className="relative rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-800 aspect-square">
                                {photo.preview ? (
                                    <img
                                        src={photo.preview}
                                        alt="Foto"
                                        className="w-full h-full object-cover"
                                    />
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
                                    onClick={() => remove(photo.id)}
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
