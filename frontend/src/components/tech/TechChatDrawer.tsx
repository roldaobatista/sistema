import { useState, useEffect, useRef } from 'react'
import { X, Send, User, Clock, Paperclip, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Message {
    id: number
    user_id: number
    user?: {
        name: string
        avatar_url?: string
    }
    message: string
    type: 'text' | 'system' | 'file'
    file_path?: string
    created_at: string
}

interface TechChatDrawerProps {
    workOrderId: number
    isOpen: boolean
    onClose: () => void
}

export default function TechChatDrawer({ workOrderId, isOpen, onClose }: TechChatDrawerProps) {
    const { user } = useAuthStore()
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const fetchMessages = async () => {
        try {
            const response = await api.get(`/work-orders/${workOrderId}/chats`)
            setMessages(response.data)
        } catch {
            toast.error('Erro ao carregar mensagens')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchMessages()
            const interval = setInterval(fetchMessages, 10000) // Poll every 10s
            return () => clearInterval(interval)
        }
    }, [isOpen, workOrderId])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || sending) return

        setSending(true)
        try {
            const response = await api.post(`/work-orders/${workOrderId}/chats`, {
                message: newMessage,
                type: 'text'
            })
            setMessages([...messages, response.data])
            setNewMessage('')
        } catch {
            toast.error('Erro ao enviar mensagem. Tente novamente.')
        } finally {
            setSending(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-surface-50 animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-900">Chat Interno</h3>
                        <p className="text-[10px] text-surface-500 uppercase tracking-wider font-semibold">Comunicação OS #{workOrderId}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                    <X className="w-6 h-6 text-surface-400" />
                </button>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-surface-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="text-sm font-medium">Carregando conversa...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                        <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center text-surface-300">
                            <Send className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-medium text-surface-500">Nenhuma mensagem ainda. Use o chat para falar com o escritório.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.user_id === user?.id
                        const isSystem = msg.type === 'system'

                        if (isSystem) {
                            return (
                                <div key={msg.id} className="flex justify-center my-2">
                                    <div className="bg-surface-200/50 dark:bg-surface-800/50 px-3 py-1.5 rounded-full border border-surface-200/50 dark:border-surface-700/50">
                                        <p className="text-[10px] font-medium text-surface-500 text-center">
                                            {msg.message.replace(/\*\*/g, '')} • {formatDistanceToNow(new Date(msg.created_at), { locale: ptBR, addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col max-w-[85%]",
                                    isOwn ? "ml-auto items-end" : "items-start"
                                )}
                            >
                                <div className={cn(
                                    "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                                    isOwn
                                        ? "bg-brand-600 text-white rounded-tr-none"
                                        : "bg-card text-foreground rounded-tl-none border border-border"
                                )}>
                                    <p className="leading-relaxed">{msg.message}</p>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 px-1">
                                    {!isOwn && <span className="text-[10px] font-bold text-surface-400">{msg.user?.name}</span>}
                                    <span className="text-[10px] text-surface-400 tabular-nums">
                                        {formatDistanceToNow(new Date(msg.created_at), { locale: ptBR, addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-card border-t border-border pb-safe">
                <form
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-2"
                >
                    <button
                        type="button"
                        className="p-3 rounded-xl bg-surface-50 text-surface-500 active:scale-95 transition-all"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escreva sua mensagem..."
                            className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 transition-all dark:text-white"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="p-3 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                    >
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </form>
            </div>
        </div>
    )
}
