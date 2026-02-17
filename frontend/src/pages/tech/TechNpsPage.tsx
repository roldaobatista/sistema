import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Star, MessageSquare, CheckCircle2, Loader2, ArrowLeft, Send,
} from 'lucide-react'
import { cn, getApiErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

const CATEGORIES = ['Atendimento', 'Prazo', 'Qualidade', 'Preço', 'Comunicação']

const NPS_LABELS: Record<number, string> = {
    0: 'Detrator', 1: 'Detrator', 2: 'Detrator', 3: 'Detrator', 4: 'Detrator', 5: 'Detrator', 6: 'Detrator',
    7: 'Neutro', 8: 'Neutro',
    9: 'Promotor', 10: 'Promotor',
}

function getScoreClass(score: number, selected: boolean): string {
    if (!selected) return 'bg-surface-100 text-surface-600'
    if (score <= 6) return 'bg-red-500 text-white'
    if (score <= 8) return 'bg-amber-500 text-white'
    return 'bg-emerald-500 text-white'
}

interface WorkOrderInfo {
    id: number
    os_number?: string
    number?: string
    customer?: { name?: string }
}

export default function TechNpsPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [wo, setWo] = useState<WorkOrderInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [score, setScore] = useState<number | null>(null)
    const [comment, setComment] = useState('')
    const [tags, setTags] = useState<string[]>([])

    useEffect(() => {
        if (!id) return
        api.get(`/work-orders/${id}`)
            .then((res) => res.data)
            .then((data) => setWo(data.data ?? data))
            .catch(() => toast.error('Erro ao carregar OS'))
            .finally(() => setLoading(false))
    }, [id])

    const toggleTag = (tag: string) => {
        setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
    }

    const handleSubmit = async () => {
        if (score === null || !id) {
            toast.error('Selecione uma nota')
            return
        }
        setSubmitting(true)
        try {
            await api.post('/operational/nps', {
                work_order_id: Number(id),
                score,
                comment: comment || undefined,
                tags: tags.length ? tags : undefined,
            })
            setSuccess(true)
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao enviar avaliação'))
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 flex items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    <p className="text-sm text-surface-500">Carregando...</p>
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center justify-center gap-4">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-foreground">Avaliação registrada!</h2>
                        <p className="text-sm text-surface-500 mt-1">Obrigado pelo feedback.</p>
                    </div>
                    <button
                        onClick={() => navigate(`/tech/os/${id}`)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar à OS
                    </button>
                </div>
            </div>
        )
    }

    const osNumber = wo?.os_number ?? wo?.number ?? (wo?.id ? `#${wo.id}` : String(id ?? ''))
    const customerName = wo?.customer?.name ?? 'Cliente'

    return (
        <div className="flex flex-col h-full">
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/tech/os/${id}`)}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600" />
                    </button>
                    <h1 className="text-lg font-bold text-foreground">Avaliação do Cliente</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div className="bg-card rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-foreground">{customerName}</span>
                    </div>
                    <p className="text-xs text-surface-500">OS {osNumber}</p>
                </div>

                <div className="bg-card rounded-xl p-4">
                    <p className="text-sm font-medium text-surface-700 mb-3">
                        De 0 a 10, qual a probabilidade de indicar nosso serviço?
                    </p>
                    <div className="flex flex-wrap gap-2 justify-between">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setScore(n)}
                                className={cn(
                                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                                    getScoreClass(n, score === n)
                                )}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    {score !== null && (
                        <p className="text-sm text-surface-500 mt-2 text-center">
                            {NPS_LABELS[score]}
                        </p>
                    )}
                </div>

                <div className="bg-card rounded-xl p-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                        <MessageSquare className="w-4 h-4" />
                        O que motivou sua nota?
                    </label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Comentário opcional..."
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                    />
                </div>

                <div className="bg-card rounded-xl p-4">
                    <p className="text-sm font-medium text-surface-700 mb-2">
                        Categorias (opcional)
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => toggleTag(cat)}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                                    tags.includes(cat)
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-surface-100 text-surface-600'
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={submitting || score === null}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    Enviar Avaliação
                </button>
            </div>
        </div>
    )
}
