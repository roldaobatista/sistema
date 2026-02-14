import { useState, useEffect, useRef } from 'react'
import { Send, User, Clock, Paperclip, Loader2, FileText, Download } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'

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

interface AdminChatTabProps {
    workOrderId: number
}

export default function AdminChatTab({ workOrderId }: AdminChatTabProps) {
    const { user } = useAuthStore()
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchMessages = async () => {
        try {
            const response = await api.get(`/work-orders/${workOrderId}/chats`)
            setMessages(response.data)
        } catch (error) {
            console.error('Failed to fetch chat messages:', error)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async () => {
        try {
            await api.post(`/work-orders/${workOrderId}/chats/read`)
        } catch (error) {
            // Silent fail for mark as read 
        }
    }

    useEffect(() => {
        fetchMessages()
        markAsRead()
        const interval = setInterval(fetchMessages, 10000)
        return () => clearInterval(interval)
    }, [workOrderId])

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
        } catch (error) {
            console.error('Failed to send message:', error)
        } finally {
            setSending(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || sending) return

        const formData = new FormData()
        formData.append('file', file)
        formData.append('message', `Enviou um arquivo: ${file.name}`)
        formData.append('type', 'file')

        setSending(true)
        try {
            const response = await api.post(`/work-orders/${workOrderId}/chats`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            setMessages([...messages, response.data])
        } catch (error) {
            console.error('Failed to upload file:', error)
        } finally {
            setSending(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-surface-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium">Carregando histórico do chat...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[600px] bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-default overflow-hidden">
            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6"
            >
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                        <div className="w-16 h-16 rounded-3xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-300">
                            <Send className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-medium text-surface-500 max-w-xs">Nenhuma mensagem ainda. O chat interno registra a comunicação entre o campo e o escritório.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.user_id === user?.id
                        const isSystem = msg.type === 'system'

                        if (isSystem) {
                            return (
                                <div key={msg.id} className="flex justify-center my-4">
                                    <div className="bg-surface-200/50 dark:bg-surface-800/80 px-4 py-1.5 rounded-full border border-surface-200 dark:border-surface-700/50">
                                        <p className="text-[11px] font-bold text-surface-500 text-center uppercase tracking-wider">
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
                                    "flex gap-3 max-w-[80%]",
                                    isOwn ? "ml-auto flex-row-reverse" : "flex-row"
                                )}
                            >
                                <div className="flex-shrink-0 mt-1">
                                    <div className="w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-800 flex items-center justify-center overflow-hidden border border-default">
                                        {msg.user?.avatar_url ? (
                                            <img src={msg.user.avatar_url} alt={msg.user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-4 h-4 text-surface-400" />
                                        )}
                                    </div>
                                </div>
                                <div className={cn(
                                    "flex flex-col",
                                    isOwn ? "items-end" : "items-start"
                                )}>
                                    <div className={cn(
                                        "px-4 py-3 rounded-2xl text-sm shadow-sm",
                                        isOwn
                                            ? "bg-brand-600 text-white rounded-tr-none"
                                            : "bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50 rounded-tl-none border border-default"
                                    )}>
                                        {msg.type === 'file' ? (
                                            <div className="flex items-center gap-3 pr-2">
                                                <div className="w-10 h-10 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="font-medium text-xs truncate mb-1">Arquivo Enviado</p>
                                                    <a
                                                        href={api.defaults.baseURL + '/../storage/' + msg.file_path}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[10px] underline opacity-80 hover:opacity-100 flex items-center gap-1"
                                                    >
                                                        <Download className="w-3 h-3" /> Baixar arquivo
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 px-1">
                                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-tight">{msg.user?.name}</span>
                                        <span className="text-[10px] text-surface-400 tabular-nums">
                                            {formatDistanceToNow(new Date(msg.created_at), { locale: ptBR, addSuffix: true })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Input Area */}
            <div className="px-6 py-4 bg-white dark:bg-surface-800 border-t border-default">
                <form
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-3"
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-xl bg-surface-50 dark:bg-surface-700/50 hover:bg-surface-100 dark:hover:bg-brand-900/20"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip className="w-5 h-5 text-surface-500" />
                    </Button>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escreva uma mensagem para o técnico..."
                            className="w-full bg-surface-50 dark:bg-surface-700/50 border-none rounded-xl px-5 py-3 text-sm focus:ring-2 focus:ring-brand-500 transition-all dark:text-white"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="rounded-xl px-6 h-[44px] shadow-lg shadow-brand-500/20"
                    >
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Enviar <Send className="w-4 h-4 ml-2" /></>}
                    </Button>
                </form>
            </div>
        </div>
    )
}
