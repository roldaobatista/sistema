import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    X, DollarSign, User, Calendar, FileText, Phone, Mail,
    MessageCircle, CheckCircle2, XCircle, Loader2, Pencil,
    Save, Clock, Plus, Activity, Target,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { DEAL_STATUS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { crmApi, type CrmDeal, type CrmActivity } from '@/lib/crm-api'
import { SendMessageModal } from '@/components/crm/SendMessageModal'
import { MessageHistory } from '@/components/crm/MessageHistory'
import { toast } from 'sonner'

const woIdentifier = (wo?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

const typeIcons: Record<string, React.ElementType> = {
    ligacao: Phone,
    email: Mail,
    whatsapp: MessageCircle,
    nota: FileText,
    system: Activity,
    reuniao: User,
    visita: Target,
    tarefa: CheckCircle2,
}

const typeColors: Record<string, string> = {
    ligacao: 'bg-blue-100 text-blue-600',
    email: 'bg-indigo-100 text-indigo-600',
    whatsapp: 'bg-emerald-100 text-emerald-600',
    nota: 'bg-amber-100 text-amber-600',
    system: 'bg-surface-100 text-surface-500',
    reuniao: 'bg-purple-100 text-purple-600',
    visita: 'bg-teal-100 text-teal-600',
    tarefa: 'bg-green-100 text-green-600',
}

const WO_STATUS_LABELS: Record<string, string> = {
    open: 'Aberta',
    in_progress: 'Em Andamento',
    waiting_parts: 'Aguardando Peças',
    waiting_approval: 'Aguardando Aprovação',
    completed: 'Concluída',
    delivered: 'Entregue',
    invoiced: 'Faturada',
    cancelled: 'Cancelada',
}

interface Props {
    dealId: number | null
    open: boolean
    onClose: () => void
}

export function DealDetailDrawer({ dealId, open, onClose }: Props) {
    const queryClient = useQueryClient()
    const [lostReason, setLostReason] = useState('')
    const [showLostForm, setShowLostForm] = useState(false)
    const [sendMessageOpen, setSendMessageOpen] = useState(false)
    const [editingField, setEditingField] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [showNewActivity, setShowNewActivity] = useState(false)
    const [newActivity, setNewActivity] = useState({ title: '', type: 'nota', description: '' })

    const { data: deal, isLoading } = useQuery({
        queryKey: ['crm-deal', dealId],
        queryFn: () => crmApi.getDeal(dealId!).then(r => r.data),
        enabled: !!dealId && open,
    })

    const wonMutation = useMutation({
        mutationFn: (id: number) => crmApi.markDealWon(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
            toast.success('Deal marcado como ganho!')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao marcar deal como ganho')
        },
    })

    const lostMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) => crmApi.markDealLost(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
            toast.success('Deal marcado como perdido')
            setShowLostForm(false)
            setLostReason('')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao marcar deal como perdido')
        },
    })

    const updateMutation = useMutation({
        mutationFn: (data: Partial<CrmDeal>) => crmApi.updateDeal(deal!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            toast.success('Deal atualizado')
            setEditingField(null)
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao atualizar deal')
        },
    })

    const activityMutation = useMutation({
        mutationFn: (data: Partial<CrmActivity>) => crmApi.createActivity(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
            toast.success('Atividade registrada')
            setShowNewActivity(false)
            setNewActivity({ title: '', type: 'nota', description: '' })
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao registrar atividade')
        },
    })

    const startEdit = (field: string, currentValue: string) => {
        setEditingField(field)
        setEditValue(currentValue)
    }

    const saveEdit = (field: string) => {
        if (!deal) return
        const payload: Partial<CrmDeal> = {}
        switch (field) {
            case 'value': payload.value = Number(editValue) || 0; break
            case 'notes': payload.notes = editValue; break
            case 'expected_close_date': payload.expected_close_date = editValue || null; break
            case 'probability': payload.probability = Number(editValue) || 0; break
            case 'title': payload.title = editValue; break
        }
        updateMutation.mutate(payload)
    }

    const cancelEdit = () => {
        setEditingField(null)
        setEditValue('')
    }

    const submitNewActivity = () => {
        if (!deal || !newActivity.title.trim()) return
        activityMutation.mutate({
            deal_id: deal.id,
            customer_id: deal.customer_id,
            title: newActivity.title,
            type: newActivity.type,
            description: newActivity.description || undefined,
        })
    }

    if (!open) return null

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer */}
            <div className={cn(
                'fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-subtle bg-surface-0 shadow-modal',
                'animate-in slide-in-from-right duration-300'
            )}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
                    {editingField === 'title' ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                            <Input
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="h-8 text-lg font-semibold"
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter') saveEdit('title')
                                    if (e.key === 'Escape') cancelEdit()
                                }}
                            />
                            <button onClick={() => saveEdit('title')} title="Salvar" className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50">
                                <Save className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEdit} title="Cancelar" className="rounded-md p-1 text-surface-400 hover:bg-surface-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <h2
                            className="text-lg font-semibold text-surface-900 truncate cursor-pointer group flex items-center gap-2"
                            onClick={() => deal && startEdit('title', deal.title)}
                        >
                            {isLoading ? 'Carregando…' : deal?.title}
                            {deal && <Pencil className="h-3.5 w-3.5 text-surface-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </h2>
                    )}
                    <button
                        onClick={onClose}
                        title="Fechar"
                        className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                    </div>
                ) : deal ? (
                    <div className="flex-1 overflow-y-auto">
                        {/* Status + Actions */}
                        <div className="border-b border-subtle px-5 py-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Badge variant={deal.status === DEAL_STATUS.WON ? 'success' : deal.status === DEAL_STATUS.LOST ? 'danger' : 'info'} dot>
                                    {deal.status === DEAL_STATUS.WON ? 'Ganho' : deal.status === DEAL_STATUS.LOST ? 'Perdido' : 'Aberto'}
                                </Badge>
                                {deal.stage && (
                                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                                        style={{ backgroundColor: `${deal.stage.color}20`, color: deal.stage.color || undefined }}>
                                        {deal.stage.name}
                                    </span>
                                )}
                            </div>

                            {deal.status === DEAL_STATUS.OPEN && (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => wonMutation.mutate(deal.id)}
                                        disabled={wonMutation.isPending}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                        Marcar Ganho
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-600 hover:bg-red-50"
                                        onClick={() => setShowLostForm(!showLostForm)}
                                    >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Marcar Perdido
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setSendMessageOpen(true)}
                                    >
                                        <MessageCircle className="h-4 w-4 mr-1" />
                                        Mensagem
                                    </Button>
                                </div>
                            )}

                            {showLostForm && (
                                <div className="mt-3 space-y-2">
                                    <textarea
                                        value={lostReason}
                                        onChange={e => setLostReason(e.target.value)}
                                        placeholder="Motivo da perda (opcional)"
                                        className="w-full rounded-lg border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                                        rows={2}
                                    />
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => lostMutation.mutate({ id: deal.id, reason: lostReason })}
                                        disabled={lostMutation.isPending}
                                    >
                                        Confirmar Perda
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Editable Info Grid */}
                        <div className="border-b border-subtle px-5 py-4 space-y-2">
                            <EditableField
                                icon={DollarSign}
                                label="Valor"
                                value={formatCurrency(deal.value)}
                                rawValue={String(deal.value)}
                                field="value"
                                editingField={editingField}
                                editValue={editValue}
                                onStartEdit={startEdit}
                                onSave={saveEdit}
                                onCancel={cancelEdit}
                                onChange={setEditValue}
                                type="number"
                            />
                            <EditableField
                                icon={Target}
                                label="Probabilidade"
                                value={`${deal.probability ?? 0}%`}
                                rawValue={String(deal.probability ?? 0)}
                                field="probability"
                                editingField={editingField}
                                editValue={editValue}
                                onStartEdit={startEdit}
                                onSave={saveEdit}
                                onCancel={cancelEdit}
                                onChange={setEditValue}
                                type="number"
                            />
                            <InfoRow icon={User} label="Cliente" value={deal.customer?.name ?? '—'} />
                            <InfoRow icon={User} label="Responsável" value={deal.assignee?.name ?? 'Não atribuído'} />
                            <EditableField
                                icon={Calendar}
                                label="Previsão"
                                value={deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString('pt-BR') : 'Não definida'}
                                rawValue={deal.expected_close_date ?? ''}
                                field="expected_close_date"
                                editingField={editingField}
                                editValue={editValue}
                                onStartEdit={startEdit}
                                onSave={saveEdit}
                                onCancel={cancelEdit}
                                onChange={setEditValue}
                                type="date"
                            />
                            {deal.source && <InfoRow icon={FileText} label="Origem" value={deal.source} />}
                            {deal.quote && (
                                <InfoRow icon={FileText} label="Orçamento" value={`#${deal.quote.quote_number} — ${formatCurrency(deal.quote.total)}`} />
                            )}
                            {deal.workOrder && (
                                <InfoRow icon={FileText} label="OS" value={`#${woIdentifier(deal.workOrder)} — ${WO_STATUS_LABELS[deal.workOrder.status] ?? deal.workOrder.status}`} />
                            )}
                            {deal.equipment && (
                                <InfoRow icon={FileText} label="Equipamento" value={`${deal.equipment.code} — ${deal.equipment.brand} ${deal.equipment.model}`} />
                            )}
                        </div>

                        {/* Editable Notes */}
                        <div className="border-b border-subtle px-5 py-4">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Observações</p>
                                {editingField !== 'notes' && (
                                    <button onClick={() => startEdit('notes', deal.notes ?? '')} title="Editar observações" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            {editingField === 'notes' ? (
                                <div className="space-y-2">
                                    <textarea
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        className="w-full rounded-lg border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                                        rows={3}
                                        autoFocus
                                    />
                                    <div className="flex gap-1.5">
                                        <Button size="sm" variant="primary" onClick={() => saveEdit('notes')} disabled={updateMutation.isPending}>
                                            <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancelar</Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-surface-700 whitespace-pre-wrap min-h-[24px]">
                                    {deal.notes || <span className="text-surface-400 italic">Clique no ícone para adicionar observações</span>}
                                </p>
                            )}
                        </div>

                        {/* Messages */}
                        {deal.customer && (
                            <div className="border-b border-subtle px-5 py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mensagens</h3>
                                    <button
                                        onClick={() => setSendMessageOpen(true)}
                                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                                    >
                                        + Nova
                                    </button>
                                </div>
                                <MessageHistory customerId={deal.customer.id} dealId={deal.id} />
                            </div>
                        )}

                        {/* Timeline de Atividades */}
                        <div className="px-5 py-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Timeline de Atividades</h3>
                                <button
                                    onClick={() => setShowNewActivity(!showNewActivity)}
                                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Nova Atividade
                                </button>
                            </div>

                            {/* New Activity Form */}
                            {showNewActivity && (
                                <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50/50 p-3 space-y-2.5">
                                    <div className="flex gap-2">
                                        <Input
                                            value={newActivity.title}
                                            onChange={e => setNewActivity(v => ({ ...v, title: e.target.value }))}
                                            placeholder="Título da atividade"
                                            className="h-8 text-sm flex-1"
                                            autoFocus
                                        />
                                        <select
                                            value={newActivity.type}
                                            onChange={e => setNewActivity(v => ({ ...v, type: e.target.value }))}
                                            title="Tipo de atividade"
                                            className="h-8 rounded-md border border-default bg-white px-2 text-xs"
                                        >
                                            <option value="nota">Nota</option>
                                            <option value="ligacao">Ligação</option>
                                            <option value="email">E-mail</option>
                                            <option value="whatsapp">WhatsApp</option>
                                            <option value="reuniao">Reunião</option>
                                            <option value="visita">Visita</option>
                                            <option value="tarefa">Tarefa</option>
                                        </select>
                                    </div>
                                    <textarea
                                        value={newActivity.description}
                                        onChange={e => setNewActivity(v => ({ ...v, description: e.target.value }))}
                                        placeholder="Descrição (opcional)"
                                        className="w-full rounded-lg border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                                        rows={2}
                                    />
                                    <div className="flex gap-1.5">
                                        <Button size="sm" variant="primary" onClick={submitNewActivity} disabled={activityMutation.isPending || !newActivity.title.trim()}>
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Registrar
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setShowNewActivity(false)}>Cancelar</Button>
                                    </div>
                                </div>
                            )}

                            {/* Timeline Visual */}
                            <div className="relative">
                                {(deal.activities ?? []).length === 0 ? (
                                    <p className="text-sm text-surface-400 text-center py-6">Nenhuma atividade registrada</p>
                                ) : (
                                    <div className="space-y-0">
                                        {(deal.activities ?? []).map((act: CrmActivity, idx: number) => {
                                            const Icon = typeIcons[act.type] ?? FileText
                                            const colorClass = typeColors[act.type] ?? 'bg-surface-100 text-surface-500'
                                            const isLast = idx === (deal.activities ?? []).length - 1

                                            return (
                                                <div key={act.id} className="relative flex gap-3 pb-4 group">
                                                    {/* Timeline line */}
                                                    {!isLast && (
                                                        <div className="absolute left-[15px] top-9 bottom-0 w-0.5 bg-surface-200" />
                                                    )}

                                                    {/* Icon circle */}
                                                    <div className={cn(
                                                        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface-0 transition-shadow',
                                                        colorClass,
                                                        'group-hover:ring-2 group-hover:ring-brand-200',
                                                    )}>
                                                        <Icon className="h-3.5 w-3.5" />
                                                    </div>

                                                    {/* Content */}
                                                    <div className="min-w-0 flex-1 rounded-lg border border-transparent group-hover:border-surface-200 group-hover:bg-surface-50/50 px-2 py-1 -mt-0.5 transition-all">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="text-sm font-medium text-surface-800">{act.title}</p>
                                                            <Badge variant="outline" className="text-[9px] shrink-0 uppercase">{act.type}</Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
                                                            {act.user?.name && (
                                                                <>
                                                                    <span className="font-medium text-surface-500">{act.user.name}</span>
                                                                    <span>•</span>
                                                                </>
                                                            )}
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {new Date(act.created_at).toLocaleDateString('pt-BR', {
                                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                                                })}
                                                            </span>
                                                            {act.completed_at && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-emerald-500 font-medium">✓ Concluído</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {act.description && (
                                                            <p className="text-xs text-surface-500 mt-1.5 leading-relaxed">{act.description}</p>
                                                        )}
                                                        {act.outcome && (
                                                            <p className="text-xs text-brand-600 mt-1 font-medium">Resultado: {act.outcome}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Send Message Modal */}
            {deal?.customer && (
                <SendMessageModal
                    open={sendMessageOpen}
                    onClose={() => setSendMessageOpen(false)}
                    customerId={deal.customer.id}
                    customerName={deal.customer.name}
                    customerPhone={deal.customer.phone}
                    customerEmail={deal.customer.email}
                    dealId={deal.id}
                />
            )}
        </>
    )
}

// ─── Sub-components ─────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 py-1">
            <Icon className="h-4 w-4 text-surface-400 shrink-0" />
            <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs text-surface-500 w-24 shrink-0">{label}</span>
                <span className="text-sm font-medium text-surface-800 truncate">{value}</span>
            </div>
        </div>
    )
}

interface EditableFieldProps {
    icon: React.ElementType
    label: string
    value: string
    rawValue: string
    field: string
    editingField: string | null
    editValue: string
    onStartEdit: (field: string, value: string) => void
    onSave: (field: string) => void
    onCancel: () => void
    onChange: (value: string) => void
    type?: 'text' | 'number' | 'date'
}

function EditableField({
    icon: Icon, label, value, rawValue, field, editingField, editValue,
    onStartEdit, onSave, onCancel, onChange, type = 'text',
}: EditableFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editingField === field && inputRef.current) {
            inputRef.current.focus()
        }
    }, [editingField, field])

    if (editingField === field) {
        return (
            <div className="flex items-center gap-3 py-1">
                <Icon className="h-4 w-4 text-brand-500 shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-surface-500 w-24 shrink-0">{label}</span>
                    <input
                        ref={inputRef}
                        type={type}
                        value={editValue}
                        onChange={e => onChange(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') onSave(field)
                            if (e.key === 'Escape') onCancel()
                        }}
                        className="h-7 flex-1 rounded-md border border-brand-300 bg-white px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                    <button onClick={() => onSave(field)} title="Salvar" className="rounded p-1 text-emerald-600 hover:bg-emerald-50"><Save className="h-3.5 w-3.5" /></button>
                    <button onClick={onCancel} title="Cancelar" className="rounded p-1 text-surface-400 hover:bg-surface-100"><X className="h-3.5 w-3.5" /></button>
                </div>
            </div>
        )
    }

    return (
        <div
            className="flex items-center gap-3 py-1 group cursor-pointer rounded-md hover:bg-surface-50 -mx-1 px-1 transition-colors"
            onClick={() => onStartEdit(field, rawValue)}
        >
            <Icon className="h-4 w-4 text-surface-400 shrink-0" />
            <div className="flex items-baseline gap-2 min-w-0 flex-1">
                <span className="text-xs text-surface-500 w-24 shrink-0">{label}</span>
                <span className="text-sm font-medium text-surface-800 truncate">{value}</span>
            </div>
            <Pencil className="h-3 w-3 text-surface-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
    )
}
