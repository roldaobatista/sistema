import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    FileText, Upload, Trash2, Download, Plus,
    Calendar, AlertCircle, FileCheck, Loader2
} from 'lucide-react'
import api, { getApiOrigin } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
    customerId: number
}

interface CustomerDocument {
    id: number
    title: string
    type: string
    file_path: string
    file_name: string
    file_size: number
    expiry_date: string | null
    notes: string | null
    created_at: string
    uploader?: { id: number; name: string }
}

const DOC_TYPES = [
    { value: 'contract', label: 'Contrato' },
    { value: 'alvara', label: 'Alvará' },
    { value: 'avcb', label: 'AVCB' },
    { value: 'license', label: 'Licença' },
    { value: 'other', label: 'Outro' },
]

export function CustomerDocumentsTab({ customerId }: Props) {
    const qc = useQueryClient()
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [uploadForm, setUploadForm] = useState({
        title: '',
        type: 'other',
        file: null as File | null,
        expiry_date: '',
        notes: ''
    })

    // Fetch documents
    const { data: res, isLoading } = useQuery({
        queryKey: ['customer-documents', customerId],
        queryFn: () => api.get(`/advanced/customers/${customerId}/documents`).then(r => r.data),
        enabled: !!customerId,
    })

    const documents = res?.data ?? []

    // Upload mutation
    const uploadMut = useMutation({
        mutationFn: (formData: FormData) => api.post(`/advanced/customers/${customerId}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
        onSuccess: () => {
            toast.success('Documento enviado com sucesso')
            qc.invalidateQueries({ queryKey: ['customer-documents', customerId] })
            qc.invalidateQueries({ queryKey: ['customer-360', customerId.toString()] })
            setIsUploadOpen(false)
            setUploadForm({ title: '', type: 'other', file: null, expiry_date: '', notes: '' })
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Erro ao enviar documento')
        }
    })

    // Delete mutation
    const deleteMut = useMutation({
        mutationFn: (docId: number) => api.delete(`/advanced/customer-documents/${docId}`),
        onSuccess: () => {
            toast.success('Documento removido')
            qc.invalidateQueries({ queryKey: ['customer-documents', customerId] })
            qc.invalidateQueries({ queryKey: ['customer-360', customerId.toString()] })
        }
    })

    const handleUpload = () => {
        if (!uploadForm.file || !uploadForm.title) {
            toast.error('Título e arquivo são obrigatórios')
            return
        }

        const formData = new FormData()
        formData.append('title', uploadForm.title)
        formData.append('type', uploadForm.type)
        formData.append('file', uploadForm.file)
        if (uploadForm.expiry_date) formData.append('expiry_date', uploadForm.expiry_date)
        if (uploadForm.notes) formData.append('notes', uploadForm.notes)

        uploadMut.mutate(formData)
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    if (isLoading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-surface-900">Documentos e Certidões</h3>
                    <p className="text-xs text-surface-500">Gestão de arquivos anexos do cliente</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setIsUploadOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Documento
                </Button>
            </div>

            {documents.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-surface-200 p-10 text-center">
                    <FileText className="h-10 w-10 text-surface-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-surface-600">Nenhum documento anexado</p>
                    <p className="text-xs text-surface-400 mt-1">Contratos, alvarás e outros documentos podem ser salvos aqui.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents.map((doc: CustomerDocument) => (
                        <div key={doc.id} className="group relative rounded-xl border border-surface-200 bg-white p-4 hover:shadow-md transition-all">
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-surface-50 text-surface-400 group-hover:bg-brand-50 group-hover:text-brand-500 transition-colors">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-surface-900 truncate" title={doc.title}>{doc.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" size="xs" className="uppercase">{doc.type}</Badge>
                                        <span className="text-[10px] text-surface-400">{formatSize(doc.file_size)}</span>
                                    </div>
                                    {doc.expiry_date && (
                                        <div className={cn(
                                            "flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase",
                                            new Date(doc.expiry_date) < new Date() ? "text-red-500" : "text-emerald-600"
                                        )}>
                                            <Calendar className="h-3 w-3" />
                                            Expira em: {new Date(doc.expiry_date).toLocaleDateString()}
                                            {new Date(doc.expiry_date) < new Date() && <AlertCircle className="h-3 w-3" />}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <a
                                        href={`${getApiOrigin()}/storage/${doc.file_path}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <IconButton icon={<Download className="h-3.5 w-3.5" />} size="sm" variant="ghost" tooltip="Download" />
                                    </a>
                                    <IconButton
                                        icon={<Trash2 className="h-3.5 w-3.5" />}
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => deleteMut.mutate(doc.id)}
                                        disabled={deleteMut.isPending}
                                        tooltip="Remover"
                                    />
                                </div>
                            </div>
                            {doc.notes && <p className="mt-3 text-[10px] text-surface-500 italic line-clamp-1 border-t border-subtle pt-2">{doc.notes}</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            <Modal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                title="Novo Documento"
                size="sm"
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpload} disabled={uploadMut.isPending}>
                            {uploadMut.isPending ? 'Enviando...' : 'Enviar Arquivo'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Título *"
                        value={uploadForm.title}
                        onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                        placeholder="Ex: Contrato de Prestação de Serviços"
                    />
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Tipo</label>
                        <select
                            value={uploadForm.type}
                            onChange={e => setUploadForm({ ...uploadForm, type: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                        >
                            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <Input
                        label="Data de Vencimento"
                        type="date"
                        value={uploadForm.expiry_date}
                        onChange={e => setUploadForm({ ...uploadForm, expiry_date: e.target.value })}
                    />
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Arquivo *</label>
                        <div className={cn(
                            "relative border-2 border-dashed rounded-xl p-6 text-center transition-colors",
                            uploadForm.file ? "border-emerald-200 bg-emerald-50" : "border-surface-200 hover:border-brand-300"
                        )}>
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={e => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                            />
                            {uploadForm.file ? (
                                <div className="flex flex-col items-center">
                                    <FileCheck className="h-8 w-8 text-emerald-500 mb-2" />
                                    <p className="text-sm font-bold text-emerald-800">{uploadForm.file.name}</p>
                                    <p className="text-xs text-emerald-600">{formatSize(uploadForm.file.size)}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <Upload className="h-8 w-8 text-surface-400 mb-2" />
                                    <p className="text-sm font-medium text-surface-600">Clique ou arraste o arquivo</p>
                                    <p className="text-xs text-surface-400 mt-1">PDF, PNG, JPG (Máx. 10MB)</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-surface-700 mb-1">Notas</label>
                        <textarea
                            value={uploadForm.notes}
                            onChange={e => setUploadForm({ ...uploadForm, notes: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                            rows={2}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}
