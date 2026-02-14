import { useState, useRef, useEffect , useMemo } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Mic, MicOff, Image, Clock } from 'lucide-react'
import { useChatStoreForward, type ChatMessage } from '@/hooks/useChatStoreForward'
import { useVoiceToText } from '@/hooks/useVoiceToText'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export default function TechChatPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['tech-chat'],
    queryFn: () => api.get('/tech-chat').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tech-chat/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['tech-chat'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const workOrderId = parseInt(id || '0')
    const { user } = useAuthStore()
    const chat = useChatStoreForward(workOrderId)
    const voice = useVoiceToText()
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const scrollToBottom = () => {
  const [searchTerm, setSearchTerm] = useState('')
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [chat.messages])

    const handleSend = async () => {
        const text = input.trim() || voice.transcript.trim()
        if (!text || !user) return

        await chat.sendMessage(text, user.id, user.name)
        setInput('')
        voice.clearTranscript()
    }

    const handleVoiceToggle = () => {
        if (voice.isListening) {
            voice.stopListening()
        } else {
            voice.startListening()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    const isOwnMessage = (msg: ChatMessage) => msg.sender_id === user?.id

    return (
        <div className="flex flex-col h-full bg-surface-100 dark:bg-surface-950">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700 shrink-0">
                <button onClick={() => navigate(-1)} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <div className="flex-1">
                    <h1 className="text-sm font-bold text-surface-900 dark:text-surface-50">
                        Chat da OS #{workOrderId}
                    </h1>
                    <p className="text-xs text-surface-500">
                        {chat.pendingCount > 0
                            ? `${chat.pendingCount} mensagem(ns) pendente(s) de envio`
                            : 'Mensagens sincronizadas'
                        }
                    </p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {chat.messages.length === 0 && !chat.isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-surface-400">
                        <Send className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">Nenhuma mensagem ainda</p>
                        <p className="text-xs">Envie uma mensagem sobre esta OS</p>
                    </div>
                )}

                {chat.messages.map(msg => (
                    <div
                        key={msg.id}
                        className={cn(
                            'flex',
                            isOwnMessage(msg) ? 'justify-end' : 'justify-start'
                        )}
                    >
                        <div className={cn(
                            'max-w-[80%] rounded-2xl px-4 py-2.5',
                            isOwnMessage(msg)
                                ? 'bg-brand-600 text-white rounded-br-sm'
                                : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50 rounded-bl-sm'
                        )}>
                            {!isOwnMessage(msg) && (
                                <p className="text-xs font-medium text-brand-600 dark:text-brand-400 mb-0.5">
                                    {msg.sender_name}
                                </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                            <div className={cn(
                                'flex items-center gap-1 mt-1',
                                isOwnMessage(msg) ? 'justify-end' : 'justify-start'
                            )}>
                                <Clock className="w-3 h-3 opacity-60" />
                                <span className="text-[10px] opacity-60">{formatTime(msg.created_at)}</span>
                                {!msg.synced && (
                                    <span className="text-[10px] opacity-60 ml-1">⏳</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Voice transcript preview */}
            {voice.isListening && (voice.transcript || voice.interimTranscript) && (
                <div className="px-4 py-2 bg-brand-50 dark:bg-brand-900/20 border-t border-brand-200 dark:border-brand-800">
                    <p className="text-sm text-brand-700 dark:text-brand-300">
                        {voice.transcript}
                        <span className="opacity-50">{voice.interimTranscript}</span>
                    </p>
                </div>
            )}

            {/* Input */}
            <div className="bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 px-3 py-2 shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleVoiceToggle}
                        className={cn(
                            'p-2.5 rounded-full transition-colors',
                            voice.isListening
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300'
                        )}
                    >
                        {voice.isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    <input
                        ref={inputRef}
                        type="text"
                        value={voice.transcript || input}
                        onChange={e => {
                            if (voice.transcript) {
                                voice.clearTranscript()
                            }
                            setInput(e.target.value)
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={voice.isListening ? 'Ouvindo...' : 'Mensagem...'}
                        className="flex-1 px-4 py-2.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-50 text-sm border-none outline-none placeholder:text-surface-400"
                    />

                    <button
                        onClick={handleSend}
                        disabled={!input.trim() && !voice.transcript.trim()}
                        className="p-2.5 rounded-full bg-brand-600 text-white disabled:opacity-40 transition-opacity"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>

                {voice.error && (
                    <p className="text-xs text-red-500 mt-1 px-2">{voice.error}</p>
                )}
            </div>
        </div>
    )
}
