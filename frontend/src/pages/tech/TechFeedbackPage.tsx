import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    MessageSquare, Send, Camera, Loader2, ArrowLeft, MessageCircle, Reply,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

const TYPE_OPTIONS = [
    { id: 'praise', label: 'Positivo', apiType: 'praise', color: 'emerald' },
    { id: 'suggestion', label: 'Sugestão', apiType: 'suggestion', color: 'blue' },
    { id: 'concern', label: 'Problema', apiType: 'concern', color: 'amber' },
    { id: 'urgent', label: 'Urgente', apiType: 'concern', color: 'red' },
] as const

const CATEGORIES = ['Processo', 'Equipamento', 'Cliente', 'Segurança', 'Ferramenta', 'Veículo']

const TYPE_COLORS: Record<string, string> = {
    praise: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    suggestion: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    concern: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const STATUS_LABELS: Record<string, string> = {
    sent: 'Enviado',
    read: 'Lido',
    replied: 'Respondido',
}

interface FeedbackItem {
    id: number
    type: string
    content: string
    created_at: string
    from_user?: { name: string }
    to_user?: { name: string }
    manager_reply?: string
}

export default function TechFeedbackPage() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [tab, setTab] = useState<'enviar' | 'historico'>('enviar')
    const [type, setType] = useState<string>('praise') // praise | suggestion | concern | urgent
    const [category, setCategory] = useState<string>('')
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [attachment, setAttachment] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [history, setHistory] = useState<FeedbackItem[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [managerId, setManagerId] = useState<number | null>(null)

    useEffect(() => {
        api.get('/me').then((res) => {
            const data = res.data?.data ?? res.data
            setManagerId(data?.manager_id ?? null)
        }).catch(() => {
            // Manager ID is optional, continue without it
        })
    }, [])

    useEffect(() => {
        if (tab === 'historico') fetchHistory()
    }, [tab, user?.id])

    async function fetchHistory() {
        setLoadingHistory(true)
        try {
            const { data } = await api.get('/hr/continuous-feedback', { params: { per_page: 50 } })
            const raw = data?.data ?? data ?? []
            const list = Array.isArray(raw) ? raw : raw?.data ?? []
            const myId = user?.id
            const fromMe = (f: any) => (f.from_user_id ?? f.from_user?.id) === myId
            setHistory(myId ? list.filter(fromMe) : list)
        } catch {
            toast.error('Erro ao carregar histórico')
        } finally {
            setLoadingHistory(false)
        }
    }

    async function handleSubmit() {
        if (!title.trim() || !message.trim()) {
            toast.error('Preencha título e mensagem')
            return
        }
        const toId = managerId
        if (!toId) {
            toast.error('Gestor não configurado. Entre em contato com o RH.')
            return
        }
        setSubmitting(true)
        try {
            const apiType = type === 'urgent' ? 'concern' : type
            const content = category ? `[${category}] ${title}\n\n${message}` : `${title}\n\n${message}`
            
            if (attachment) {
                const formData = new FormData()
                formData.append('type', apiType)
                formData.append('category', category)
                formData.append('title', title)
                formData.append('message', message)
                if (toId) formData.append('manager_id', String(toId))
                formData.append('attachment', attachment)
                await api.post('/hr/continuous-feedback', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            } else {
                await api.post('/hr/continuous-feedback', {
                    type: apiType,
                    category,
                    title,
                    message,
                    ...(toId ? { manager_id: toId } : {}),
                })
            }
            toast.success('Feedback enviado!')
            setTitle('')
            setMessage('')
            setCategory('')
            setAttachment(null)
            setTab('historico')
            fetchHistory()
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Erro ao enviar feedback')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <header className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <MessageSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Feedback</h1>
            </header>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
                <button
                    onClick={() => setTab('enviar')}
                    className={cn(
                        'flex-1 py-3 text-sm font-medium',
                        tab === 'enviar'
                            ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                            : 'text-surface-500 dark:text-surface-400'
                    )}
                >
                    Enviar
                </button>
                <button
                    onClick={() => setTab('historico')}
                    className={cn(
                        'flex-1 py-3 text-sm font-medium',
                        tab === 'historico'
                            ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                            : 'text-surface-500 dark:text-surface-400'
                    )}
                >
                    Histórico
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {tab === 'enviar' && (
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                            <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-2">Tipo</p>
                            <div className="flex flex-wrap gap-2">
                                {TYPE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setType(opt.id)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-medium',
                                            type === opt.id && opt.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                            type === opt.id && opt.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                                            type === opt.id && opt.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                            type === opt.id && opt.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                            type !== opt.id && 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                            <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-2">Categoria</p>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategory(category === cat ? '' : cat)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-medium',
                                            category === cat
                                                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                                                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                                        )}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Título"
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                            />
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Mensagem"
                                rows={4}
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                            />
                            <label className="block">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                                />
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-700 text-sm font-medium text-surface-700 dark:text-surface-300 cursor-pointer">
                                    <Camera className="w-4 h-4" />
                                    Anexar Foto
                                    {attachment && <span className="text-xs">({attachment.name})</span>}
                                </span>
                            </label>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-medium disabled:opacity-60"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            Enviar Feedback
                        </button>
                    </div>
                )}

                {tab === 'historico' && (
                    <div className="space-y-3">
                        {loadingHistory ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <MessageCircle className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhum feedback enviado</p>
                            </div>
                        ) : (
                            history.map((item) => {
                                    const isFromMe = !item.to_user || (item as any).from_user_id
                                    const typeColor = TYPE_COLORS[item.type] || 'bg-surface-200 text-surface-600'
                                    const status = (item as any).manager_reply ? 'replied' : (item as any).read_at ? 'read' : 'sent'
                                    return (
                                        <div key={item.id} className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', typeColor)}>
                                                    {item.type === 'praise' ? 'Positivo' : item.type === 'suggestion' ? 'Sugestão' : 'Problema'}
                                                </span>
                                                <span className="text-[10px] text-surface-500">
                                                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                                </span>
                                                <span className={cn(
                                                    'text-[10px] px-1.5 py-0.5 rounded',
                                                    status === 'replied' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                                                    status === 'read' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
                                                    status === 'sent' && 'bg-surface-100 text-surface-600 dark:bg-surface-700'
                                                )}>
                                                    {STATUS_LABELS[status]}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                                {item.content?.split('\n')[0]?.replace(/^\[.*?\]\s*/, '') || 'Feedback'}
                                            </p>
                                            <p className="text-xs text-surface-500 line-clamp-2">{item.content}</p>
                                            {(item as any).manager_reply && (
                                                <div className="mt-2 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border-l-2 border-brand-500">
                                                    <p className="text-xs font-medium text-brand-700 dark:text-brand-400 flex items-center gap-1">
                                                        <Reply className="w-3 h-3" /> Resposta do gestor
                                                    </p>
                                                    <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">{(item as any).manager_reply}</p>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
