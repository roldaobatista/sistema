import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileUp, X, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface DragDropUploadProps {
    workOrderId: number
}

export default function DragDropUpload({ workOrderId }: DragDropUploadProps) {
    const qc = useQueryClient()
    const [isDragging, setIsDragging] = useState(false)
    const [uploads, setUploads] = useState<{ name: string; status: 'uploading' | 'done' | 'error' }[]>([])

    const uploadMut = useMutation({
        mutationFn: (file: File) => {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', 'document')
            return api.post(`/work-orders/${workOrderId}/attachments`, fd)
        },
        onSuccess: (_d, file) => {
            setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'done' as const } : u))
            qc.invalidateQueries({ queryKey: ['work-order-attachments', workOrderId] })
        },
        onError: (_e, file) => {
            setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'error' as const } : u))
        },
    })

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return
        const newUploads = Array.from(files).map(f => ({ name: f.name, status: 'uploading' as const }))
        setUploads(prev => [...prev, ...newUploads])
        Array.from(files).forEach(f => uploadMut.mutate(f))
        toast.info(`Enviando ${files.length} arquivo(s)...`)
    }, [uploadMut])

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
    const onDragLeave = () => setIsDragging(false)
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleFiles(e.dataTransfer.files)
    }

    const removeUpload = (name: string) => setUploads(prev => prev.filter(u => u.name !== name))

    return (
        <div className="space-y-2">
            {/* Drop zone */}
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                    'rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer',
                    isDragging
                        ? 'border-brand-400 bg-brand-50 scale-[1.01]'
                        : 'border-surface-200 bg-surface-50 hover:border-brand-300 hover:bg-brand-50/50'
                )}
                onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.multiple = true
                    input.onchange = () => handleFiles(input.files)
                    input.click()
                }}
            >
                <FileUp className={cn('mx-auto h-8 w-8 mb-2', isDragging ? 'text-brand-500' : 'text-surface-300')} />
                <p className="text-sm font-medium text-surface-600">
                    {isDragging ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para enviar'}
                </p>
                <p className="text-xs text-surface-400 mt-1">
                    Fotos, documentos, PDFs — até 50MB cada
                </p>
            </div>

            {/* Upload progress */}
            {uploads.length > 0 && (
                <div className="space-y-1">
                    {uploads.map(u => (
                        <div key={u.name} className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-1.5 text-xs">
                            {u.status === 'uploading' && <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />}
                            {u.status === 'done' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                            {u.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
                            <span className="flex-1 truncate text-surface-600">{u.name}</span>
                            {u.status !== 'uploading' && (
                                <button onClick={() => removeUpload(u.name)} className="text-surface-400 hover:text-red-500" aria-label={`Remover ${u.name}`}>
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
