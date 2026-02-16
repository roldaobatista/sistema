import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft, AlertTriangle, Camera, Shield, CheckCircle2,
    Loader2, Flag, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

const TYPE_OPTIONS = [
    { value: 'customer_complaint', label: 'Reclamação do Cliente' },
    { value: 'nonconformity', label: 'Não Conformidade' },
    { value: 'safety', label: 'Problema de Segurança' },
    { value: 'equipment_damage', label: 'Dano ao Equipamento' },
    { value: 'other', label: 'Outro' },
]

const SEVERITY_OPTIONS = [
    { value: 'low', label: 'Baixa', className: 'bg-surface-100 dark:bg-surface-700' },
    { value: 'medium', label: 'Média', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
    { value: 'high', label: 'Alta', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
    { value: 'critical', label: 'Crítica', className: 'bg-red-700/30 text-red-200 dark:text-red-300' },
]

const CATEGORY_MAP: Record<string, string> = {
    customer_complaint: 'service',
    nonconformity: 'other',
    safety: 'other',
    equipment_damage: 'other',
    other: 'other',
}

export default function TechComplaintPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [wo, setWo] = useState<{ number?: string; os_number?: string; customer?: { name: string } } | null>(null)
    const [type, setType] = useState('')
    const [severity, setSeverity] = useState('')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [openCorrectiveAction, setOpenCorrectiveAction] = useState(false)
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        if (!id) return
        api.get(`/work-orders/${id}`)
            .then((res) => setWo(res.data?.data ?? res.data))
            .catch(() => toast.error('Não foi possível carregar a OS'))
            .finally(() => setLoading(false))
    }, [id])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const customerId = (wo as { customer_id?: number; customer?: { id?: number } }).customer_id
            ?? (wo as { customer?: { id?: number } }).customer?.id
        if (!id || !customerId) {
            toast.error('OS sem cliente vinculado')
            return
        }
        if (!type || !severity || !title.trim()) {
            toast.error('Preencha tipo, severidade e título')
            return
        }

        setSubmitting(true)
        try {
            const desc = description.trim() ? `${title}\n\n${description}` : title
            await api.post('/quality/complaints', {
                work_order_id: Number(id),
                customer_id: customerId,
                category: CATEGORY_MAP[type] || 'other',
                severity,
                description: desc,
                open_corrective_action: openCorrectiveAction,
            })

            if (photoFile && id) {
                const formData = new FormData()
                formData.append('file', photoFile)
                try {
                    await api.post(`/work-orders/${id}/attachments`, formData)
                } catch {
                    toast.warning('Ocorrência registrada, mas a foto não foi enviada')
                }
            }

            setSuccess(true)
            toast.success('Ocorrência registrada com sucesso')
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg || 'Erro ao registrar ocorrência')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                <span className="text-sm text-surface-500">Carregando OS...</span>
            </div>
        )
    }

    if (success) {
        return (
            <div className="flex flex-col h-full">
                <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                    <button
                        onClick={() => navigate(`/tech/os/${id}`)}
                        className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center justify-center gap-4">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                    <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                        Ocorrência registrada
                    </h2>
                    <p className="text-sm text-surface-500 text-center max-w-xs">
                        A ocorrência foi registrada com sucesso e será analisada pela equipe de qualidade.
                    </p>
                    <button
                        onClick={() => navigate(`/tech/os/${id}`)}
                        className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium"
                    >
                        Voltar para a OS
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button
                    onClick={() => navigate(`/tech/os/${id}`)}
                    className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                    <Flag className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    Registrar Ocorrência
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {wo && (
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <p className="text-xs text-surface-500 mb-1">OS</p>
                        <p className="font-semibold text-surface-900 dark:text-surface-50">
                            {wo.os_number ?? wo.number} · {wo.customer?.name ?? '—'}
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2 block">
                            Tipo
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {TYPE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setType(opt.value)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                        type === opt.value
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2 block">
                            Severidade
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {SEVERITY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setSeverity(opt.value)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                        severity === opt.value ? cn(opt.className, 'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-surface-900') : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1 block">
                            Título *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Resumo da ocorrência"
                            className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1 block">
                            Descrição
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Detalhes adicionais..."
                            className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                        />
                    </div>

                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 text-sm font-medium"
                        >
                            <Camera className="w-4 h-4" />
                            {photoFile ? photoFile.name : 'Adicionar foto'}
                        </button>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={openCorrectiveAction}
                            onChange={(e) => setOpenCorrectiveAction(e.target.checked)}
                            className="rounded border-surface-300"
                        />
                        <span className="text-sm text-surface-700 dark:text-surface-300">
                            Abrir Ação Corretiva
                        </span>
                        <Shield className="w-4 h-4 text-surface-500" />
                    </label>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm disabled:opacity-60"
                    >
                        {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Registrar Ocorrência
                    </button>
                </form>
            </div>
        </div>
    )
}
