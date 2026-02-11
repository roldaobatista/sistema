import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/lib/crm-api'
import type { CrmMessageTemplate } from '@/lib/crm-api'
import { MessageCircle, Mail, Send, X, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
    customerId: number
    customerName: string
    customerPhone?: string
    customerEmail?: string
    dealId?: number
    open: boolean
    onClose: () => void
}

type Channel = 'whatsapp' | 'email'

export function SendMessageModal({ customerId, customerName, customerPhone, customerEmail, dealId, open, onClose }: Props) {
    const qc = useQueryClient()
    const [channel, setChannel] = useState<Channel>(customerPhone ? 'whatsapp' : 'email')
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState<CrmMessageTemplate | null>(null)

    const { data: templates } = useQuery({
        queryKey: ['crm', 'message-templates', channel],
        queryFn: () => crmApi.getMessageTemplates(channel).then(r => r.data),
        enabled: open,
    })

    const sendMutation = useMutation({
        mutationFn: () => crmApi.sendMessage({
            customer_id: customerId,
            channel,
            body,
            subject: channel === 'email' ? subject : undefined,
            deal_id: dealId,
            template_id: selectedTemplate?.id,
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['crm'] })
            qc.invalidateQueries({ queryKey: ['crm', 'messages'] })
            toast.success(channel === 'whatsapp' ? 'WhatsApp enviado' : 'E-mail enviado')
            onClose()
            setBody('')
            setSubject('')
            setSelectedTemplate(null)
        },
        onError: (error: any) => {
            if (error.response?.status === 422) {
                toast.error('Dados inválidos. Verifique os campos.')
            } else {
                toast.error(error.response?.data?.message || 'Erro ao enviar mensagem')
            }
        },
    })

    const applyTemplate = (t: CrmMessageTemplate) => {
        setSelectedTemplate(t)
        setBody(t.body)
        if (t.subject) setSubject(t.subject)
    }

    if (!open) return null

    const canSend = body.trim().length > 0 && (channel !== 'email' || subject.trim().length > 0)

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl border border-default bg-white shadow-modal animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-surface-900">Enviar Mensagem</h2>
                            <p className="text-xs text-surface-500 mt-0.5">Para: {customerName}</p>
                        </div>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Channel selector */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setChannel('whatsapp')}
                                disabled={!customerPhone}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                                    channel === 'whatsapp'
                                        ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                                        : 'bg-surface-50 text-surface-600 hover:bg-surface-100',
                                    !customerPhone && 'opacity-40 cursor-not-allowed'
                                )}
                            >
                                <MessageCircle className="h-4 w-4" />
                                WhatsApp
                            </button>
                            <button
                                onClick={() => setChannel('email')}
                                disabled={!customerEmail}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                                    channel === 'email'
                                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                        : 'bg-surface-50 text-surface-600 hover:bg-surface-100',
                                    !customerEmail && 'opacity-40 cursor-not-allowed'
                                )}
                            >
                                <Mail className="h-4 w-4" />
                                E-mail
                            </button>
                        </div>

                        {/* Destination info */}
                        <div className="rounded-lg bg-surface-50 px-3 py-2 text-sm text-surface-600">
                            {channel === 'whatsapp'
                                ? `📱 ${customerPhone || 'Sem telefone'}`
                                : `📧 ${customerEmail || 'Sem e-mail'}`
                            }
                        </div>

                        {/* Templates */}
                        {templates && templates.length > 0 && (
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-500">Template</label>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={() => { setSelectedTemplate(null); setBody(''); setSubject('') }}
                                        className={cn(
                                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                            !selectedTemplate
                                                ? 'bg-brand-100 text-brand-700'
                                                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                        )}
                                    >
                                        Livre
                                    </button>
                                    {templates.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => applyTemplate(t)}
                                            className={cn(
                                                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                                selectedTemplate?.id === t.id
                                                    ? 'bg-brand-100 text-brand-700'
                                                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                            )}
                                        >
                                            <FileText className="h-3 w-3" />
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Subject (email only) */}
                        {channel === 'email' && (
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-500">Assunto</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder="Assunto do e-mail..."
                                    className="w-full rounded-lg border border-default bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        )}

                        {/* Body */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-500">Mensagem</label>
                            <textarea
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                placeholder={channel === 'whatsapp' ? 'Digite sua mensagem...' : 'Conteúdo do e-mail...'}
                                rows={5}
                                className="w-full rounded-lg border border-default bg-white px-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                            />
                            <p className="mt-1 text-xs text-surface-400">{body.length} caracteres</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 border-t border-subtle px-5 py-3">
                        <button
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => sendMutation.mutate()}
                            disabled={!canSend || sendMutation.isPending}
                            className={cn(
                                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all',
                                channel === 'whatsapp'
                                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
                                    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
                            )}
                        >
                            {sendMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Enviar {channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
