import React, { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/lib/crm-api'
import type { CrmMessageTemplate } from '@/lib/crm-api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Plus, Edit, Trash2, MessageCircle, Mail, Smartphone,
    X, Save, Loader2, FileText
} from 'lucide-react'

type Channel = 'whatsapp' | 'email' | 'sms'

const CHANNEL_META: Record<Channel, { icon: React.ElementType; color: string; label: string }> = {
    whatsapp: { icon: MessageCircle, color: 'text-green-600 bg-green-50', label: 'WhatsApp' },
    email: { icon: Mail, color: 'text-blue-600 bg-blue-50', label: 'E-mail' },
    sms: { icon: Smartphone, color: 'text-amber-600 bg-amber-50', label: 'SMS' },
}

export function MessageTemplatesPage() {
    const qc = useQueryClient()
    const [editing, setEditing] = useState<CrmMessageTemplate | null>(null)
    const [creating, setCreating] = useState(false)
    const [filterChannel, setFilterChannel] = useState<Channel | ''>('')

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['crm', 'message-templates'],
        queryFn: () => crmApi.getMessageTemplates().then(r => r.data),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => crmApi.deleteMessageTemplate(id),
        onSuccess: () => {
            toast.success('OperaÃ§Ã£o realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['crm', 'message-templates'] })
        },
    })

    const filtered = filterChannel
        ? templates.filter((t: CrmMessageTemplate) => t.channel === filterChannel)
        : templates

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900">Templates de Mensagem</h1>
                    <p className="text-[13px] text-surface-500 mt-1">Modelos reutilizÃ¡veis para WhatsApp e E-mail</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Novo Template
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFilterChannel('')}
                    className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        !filterChannel ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    )}
                >
                    Todos ({templates.length})
                </button>
                {(['whatsapp', 'email', 'sms'] as Channel[]).map(ch => {
                    const count = templates.filter((t: CrmMessageTemplate) => t.channel === ch).length
                    const meta = CHANNEL_META[ch]
                    return (
                        <button
                            key={ch}
                            onClick={() => setFilterChannel(ch)}
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                                filterChannel === ch ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            )}
                        >
                            <meta.icon className="h-3 w-3" />
                            {meta.label} ({count})
                        </button>
                    )
                })}
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-surface-100 p-4 mb-3">
                        <FileText className="h-6 w-6 text-surface-400" />
                    </div>
                    <p className="text-[13px] text-surface-500">Nenhum template encontrado</p>
                    <p className="text-xs text-surface-400 mt-1">Crie um template para agilizar o envio de mensagens</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(filtered as CrmMessageTemplate[]).map(t => {
                        const meta = CHANNEL_META[t.channel]
                        return (
                            <div
                                key={t.id}
                                className="group rounded-xl border border-default bg-surface-0 p-5 shadow-card hover:shadow-elevated transition-all"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', meta.color)}>
                                            <meta.icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-surface-900">{t.name}</h3>
                                            <p className="text-[10px] text-surface-400 font-mono">{t.slug}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setEditing(t)}
                                            className="rounded-md p-1 text-surface-400 hover:bg-surface-100 hover:text-brand-600"
                                        >
                                            <Edit className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('Excluir template?')) deleteMut.mutate(t.id) }}
                                            className="rounded-md p-1 text-surface-400 hover:bg-red-50 hover:text-red-600"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Subject */}
                                {t.subject && (
                                    <p className="text-xs font-medium text-surface-600 mb-2">ðŸ“§ {t.subject}</p>
                                )}

                                {/* Body preview */}
                                <p className="text-xs text-surface-500 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                                    {t.body}
                                </p>

                                {/* Variables */}
                                {t.variables && t.variables.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        {t.variables.map((v, i) => (
                                            <Badge key={i} variant="default">
                                                {`{{${v.name}}}`}
                                            </Badge>
                                        ))}
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100">
                                    <Badge variant={t.is_active ? 'success' : 'default'}>
                                        {t.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                    <Badge variant="info">{meta.label}</Badge>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(creating || editing) && (
                <TemplateFormModal
                    template={editing}
                    onClose={() => { setCreating(false); setEditing(null) }}
                />
            )}
        </div>
    )
}

// â”€â”€â”€ Template Form Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TemplateFormModal({ template, onClose }: { template: CrmMessageTemplate | null; onClose: () => void }) {
    const qc = useQueryClient()
    const isEdit = !!template

    const [name, setName] = useState(template?.name ?? '')
    const [slug, setSlug] = useState(template?.slug ?? '')
    const [channel, setChannel] = useState<Channel>(template?.channel ?? 'whatsapp')
    const [subject, setSubject] = useState(template?.subject ?? '')
    const [body, setBody] = useState(template?.body ?? '')

    const createMut = useMutation({
        mutationFn: (data: Partial<CrmMessageTemplate>) => crmApi.createMessageTemplate(data),
        onSuccess: () => {
            toast.success('OperaÃ§Ã£o realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['crm', 'message-templates'] })
            onClose()
        },
    })

    const updateMut = useMutation({
        mutationFn: (data: Partial<CrmMessageTemplate>) => crmApi.updateMessageTemplate(template!.id, data),
        onSuccess: () => {
            toast.success('OperaÃ§Ã£o realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['crm', 'message-templates'] })
            onClose()
        },
    })

    const isPending = createMut.isPending || updateMut.isPending

    const handleSubmit = () => {
        const data: Partial<CrmMessageTemplate> = { name, slug, channel, body, subject: channel === 'email' ? subject : null }
        if (isEdit) {
            updateMut.mutate(data)
        } else {
            createMut.mutate(data)
        }
    }

    const canSave = name.trim() && slug.trim() && body.trim() && (channel !== 'email' || subject.trim())

    // Auto-generate slug from name
    const autoSlug = (val: string) => {
        setName(val)
        if (!isEdit) {
            setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
        }
    }

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 shadow-modal animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
                        <h2 className="text-lg font-semibold text-surface-900">
                            {isEdit ? 'Editar Template' : 'Novo Template'}
                        </h2>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Channel */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-500">Canal</label>
                            <div className="flex gap-2">
                                {(['whatsapp', 'email', 'sms'] as Channel[]).map(ch => {
                                    const meta = CHANNEL_META[ch]
                                    return (
                                        <button
                                            key={ch}
                                            onClick={() => setChannel(ch)}
                                            className={cn(
                                                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all',
                                                channel === ch
                                                    ? 'ring-1 ring-brand-300 bg-brand-50 text-brand-700'
                                                    : 'bg-surface-50 text-surface-600 hover:bg-surface-100'
                                            )}
                                        >
                                            <meta.icon className="h-3.5 w-3.5" />
                                            {meta.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Name + slug */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-500">Nome</label>
                                <input
                                    value={name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => autoSlug(e.target.value)}
                                    placeholder="Ex: Boas-vindas"
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-500">Slug</label>
                                <input
                                    value={slug}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)}
                                    placeholder="boas-vindas"
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm text-surface-900 font-mono placeholder:text-surface-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Subject (email only) */}
                        {channel === 'email' && (
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-500">Assunto</label>
                                <input
                                    value={subject}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
                                    placeholder="Assunto do e-mail..."
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        )}

                        {/* Body */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-medium text-surface-500">Corpo da mensagem</label>
                                <span className="text-[10px] text-surface-400">Use {'{{nome}}'}, {'{{valor}}'} para variÃ¡veis</span>
                            </div>
                            <textarea
                                value={body}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                                placeholder="OlÃ¡ {{nome}}, ..."
                                rows={6}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none font-mono"
                            />
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
                            onClick={handleSubmit}
                            disabled={!canSave || isPending}
                            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300 transition-colors"
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isEdit ? 'Salvar' : 'Criar'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
