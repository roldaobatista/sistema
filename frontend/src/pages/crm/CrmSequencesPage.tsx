import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi, type CrmSequence, type CrmSequenceStep } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogBody, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { TableSkeleton } from '@/components/ui/tableskeleton'
import { toast } from 'sonner'
import {
    Workflow, Plus, Trash2, Eye, Users, Play, Pause,
    Mail, Phone, MessageSquare, Clock, ChevronRight, ArrowLeft,
    UserPlus, XCircle,
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'default' | 'danger' }> = {
    active: { label: 'Ativa', variant: 'success' },
    draft: { label: 'Rascunho', variant: 'default' },
    paused: { label: 'Pausada', variant: 'warning' },
    archived: { label: 'Arquivada', variant: 'danger' },
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
    email: Mail,
    phone: Phone,
    whatsapp: MessageSquare,
    sms: MessageSquare,
}

const CHANNEL_LABELS: Record<string, string> = {
    email: 'E-mail',
    phone: 'Telefone',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
}

const ACTION_LABELS: Record<string, string> = {
    send_email: 'Enviar E-mail',
    make_call: 'Fazer Ligação',
    send_whatsapp: 'Enviar WhatsApp',
    send_sms: 'Enviar SMS',
    create_task: 'Criar Tarefa',
    wait: 'Aguardar',
}

interface StepDraft {
    step_order: number
    delay_days: number
    channel: string
    action_type: string
    subject: string
    body: string
}

const EMPTY_STEP: StepDraft = {
    step_order: 1, delay_days: 1, channel: 'email', action_type: 'send_email', subject: '', body: '',
}

export function CrmSequencesPage() {
    const qc = useQueryClient()
    const [viewSequence, setViewSequence] = useState<CrmSequence | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [enrollOpen, setEnrollOpen] = useState(false)
    const [enrollSequenceId, setEnrollSequenceId] = useState<number | null>(null)
    const [enrollCustomerId, setEnrollCustomerId] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    const [newName, setNewName] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [steps, setSteps] = useState<StepDraft[]>([{ ...EMPTY_STEP }])

    const { data: sequences = [], isLoading, isError, refetch } = useQuery({
        queryKey: ['crm-sequences'],
        queryFn: async () => (await crmFeaturesApi.getSequences()).data,
    })

    const { data: detailData, isLoading: loadingDetail } = useQuery({
        queryKey: ['crm-sequences', viewSequence?.id],
        queryFn: async () => viewSequence ? (await crmFeaturesApi.getSequence(viewSequence.id)).data : null,
        enabled: !!viewSequence,
    })

    const createMutation = useMutation({
        mutationFn: (data: { name: string; description?: string; steps: Partial<CrmSequenceStep>[] }) =>
            crmFeaturesApi.createSequence(data),
        onSuccess: () => {
            toast.success('Sequência criada com sucesso')
            qc.invalidateQueries({ queryKey: ['crm-sequences'] })
            closeCreateDialog()
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao criar sequência')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => crmFeaturesApi.deleteSequence(id),
        onSuccess: () => {
            toast.success('Sequência excluída com sucesso')
            qc.invalidateQueries({ queryKey: ['crm-sequences'] })
            setDeleteTarget(null)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao excluir sequência')
            setDeleteTarget(null)
        },
    })

    const enrollMutation = useMutation({
        mutationFn: (data: { sequence_id: number; customer_id: number }) =>
            crmFeaturesApi.enrollInSequence(data),
        onSuccess: () => {
            toast.success('Cliente inscrito na sequência com sucesso')
            qc.invalidateQueries({ queryKey: ['crm-sequences'] })
            closeEnrollDialog()
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao inscrever cliente')
        },
    })

    function closeCreateDialog() {
        setCreateOpen(false)
        setNewName('')
        setNewDescription('')
        setSteps([{ ...EMPTY_STEP }])
    }

    function closeEnrollDialog() {
        setEnrollOpen(false)
        setEnrollSequenceId(null)
        setEnrollCustomerId('')
    }

    function addStep() {
        setSteps(prev => [...prev, { ...EMPTY_STEP, step_order: prev.length + 1 }])
    }

    function removeStep(index: number) {
        setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })))
    }

    function updateStep(index: number, field: keyof StepDraft, value: string | number) {
        setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
    }

    function handleCreate() {
        if (!newName.trim()) {
            toast.error('Informe o nome da sequência')
            return
        }
        if (steps.length === 0) {
            toast.error('Adicione pelo menos uma etapa')
            return
        }
        createMutation.mutate({
            name: newName,
            description: newDescription || undefined,
            steps: steps.map(s => ({
                step_order: s.step_order,
                delay_days: s.delay_days,
                channel: s.channel,
                action_type: s.action_type,
                subject: s.subject || null,
                body: s.body || null,
            })),
        })
    }

    function handleEnroll() {
        if (!enrollSequenceId || !enrollCustomerId) {
            toast.error('Informe o ID do cliente')
            return
        }
        enrollMutation.mutate({ sequence_id: enrollSequenceId, customer_id: Number(enrollCustomerId) })
    }

    // Detail view
    if (viewSequence) {
        const detail = detailData as CrmSequence | null
        const detailSteps = detail?.steps ?? viewSequence.steps ?? []
        const statusCfg = STATUS_CONFIG[detail?.status ?? viewSequence.status] ?? STATUS_CONFIG.draft

        return (
            <div className="space-y-6">
                <PageHeader
                    title={viewSequence.name}
                    subtitle="Detalhes da sequência"
                    icon={Workflow}
                    backButton
                >
                    <Button variant="outline" size="sm" onClick={() => setViewSequence(null)}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => { setEnrollSequenceId(viewSequence.id); setEnrollOpen(true) }}
                    >
                        <UserPlus className="h-4 w-4 mr-1" /> Inscrever Cliente
                    </Button>
                </PageHeader>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardContent className="pt-5">
                            <p className="text-xs text-surface-500 mb-1">Status</p>
                            <Badge variant={statusCfg.variant} dot>{statusCfg.label}</Badge>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5">
                            <p className="text-xs text-surface-500 mb-1">Etapas</p>
                            <p className="text-xl font-bold text-surface-900">{detailSteps.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5">
                            <p className="text-xs text-surface-500 mb-1">Inscrições</p>
                            <p className="text-xl font-bold text-surface-900">{viewSequence.enrollments_count ?? 0}</p>
                        </CardContent>
                    </Card>
                </div>

                {viewSequence.description && (
                    <Card>
                        <CardContent className="pt-5">
                            <p className="text-sm text-surface-600">{viewSequence.description}</p>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Timeline de Etapas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingDetail && <TableSkeleton rows={3} cols={4} />}
                        {!loadingDetail && detailSteps.length === 0 && (
                            <EmptyState title="Nenhuma etapa" message="Esta sequência ainda não possui etapas." compact />
                        )}
                        {!loadingDetail && detailSteps.length > 0 && (
                            <div className="relative">
                                <div className="absolute left-5 top-0 bottom-0 w-px bg-surface-200" />
                                <div className="space-y-4">
                                    {[...detailSteps].sort((a, b) => a.step_order - b.step_order).map(step => {
                                        const ChannelIcon = CHANNEL_ICONS[step.channel] ?? Mail
                                        return (
                                            <div key={step.id ?? step.step_order} className="relative flex items-start gap-4 pl-2">
                                                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 border border-brand-200">
                                                    <ChannelIcon className="h-4 w-4 text-brand-600" />
                                                </div>
                                                <div className="flex-1 rounded-lg border border-subtle p-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant="info" size="xs">Etapa {step.step_order}</Badge>
                                                        <Badge variant="default" size="xs">
                                                            <Clock className="h-3 w-3 mr-0.5" />
                                                            {step.delay_days}d espera
                                                        </Badge>
                                                        <Badge variant="default" size="xs">
                                                            {CHANNEL_LABELS[step.channel] ?? step.channel}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm font-medium text-surface-900 mt-1.5">
                                                        {ACTION_LABELS[step.action_type] ?? step.action_type}
                                                    </p>
                                                    {step.subject && (
                                                        <p className="text-xs text-surface-600 mt-0.5">Assunto: {step.subject}</p>
                                                    )}
                                                    {step.body && (
                                                        <p className="text-xs text-surface-500 mt-1 line-clamp-2">{step.body}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Enroll Dialog */}
                <Dialog open={enrollOpen} onOpenChange={open => { if (!open) closeEnrollDialog() }}>
                    <DialogContent size="sm">
                        <DialogHeader>
                            <DialogTitle>Inscrever Cliente na Sequência</DialogTitle>
                        </DialogHeader>
                        <DialogBody className="space-y-4">
                            <Input
                                label="ID do Cliente *"
                                type="number"
                                placeholder="Ex: 42"
                                value={enrollCustomerId}
                                onChange={e => setEnrollCustomerId(e.target.value)}
                            />
                        </DialogBody>
                        <DialogFooter>
                            <Button variant="outline" onClick={closeEnrollDialog}>Cancelar</Button>
                            <Button onClick={handleEnroll} disabled={enrollMutation.isPending}>
                                {enrollMutation.isPending ? 'Inscrevendo...' : 'Inscrever'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    // List view
    return (
        <div className="space-y-6">
            <PageHeader
                title="Cadências de Vendas"
                subtitle="Sequências automatizadas de contato com leads e clientes"
                icon={Workflow}
                count={sequences.length}
                actions={[{
                    label: 'Nova Sequência',
                    onClick: () => setCreateOpen(true),
                    icon: <Plus className="h-4 w-4" />,
                }]}
            />

            {isLoading && (
                <Card>
                    <CardContent className="pt-5">
                        <TableSkeleton rows={5} cols={4} />
                    </CardContent>
                </Card>
            )}

            {isError && (
                <Card>
                    <CardContent className="pt-5">
                        <EmptyState
                            title="Erro ao carregar sequências"
                            message="Não foi possível carregar as sequências. Tente novamente."
                            action={{ label: 'Tentar novamente', onClick: () => refetch() }}
                        />
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && sequences.length === 0 && (
                <Card>
                    <CardContent className="pt-5">
                        <EmptyState
                            title="Nenhuma sequência cadastrada"
                            message="Crie sua primeira cadência de vendas para automatizar o contato com leads."
                            action={{ label: 'Nova Sequência', onClick: () => setCreateOpen(true) }}
                        />
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && sequences.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {sequences.map(seq => {
                        const statusCfg = STATUS_CONFIG[seq.status] ?? STATUS_CONFIG.draft
                        return (
                            <Card key={seq.id} className="hover:border-brand-200 transition-colors cursor-pointer" onClick={() => setViewSequence(seq)}>
                                <CardContent className="pt-5">
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-semibold text-surface-900 truncate">{seq.name}</h3>
                                            {seq.description && (
                                                <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{seq.description}</p>
                                            )}
                                        </div>
                                        <Badge variant={statusCfg.variant} size="xs" dot>{statusCfg.label}</Badge>
                                    </div>

                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-subtle">
                                        <div className="flex items-center gap-1 text-xs text-surface-500">
                                            <Workflow className="h-3.5 w-3.5" />
                                            <span>{seq.total_steps} etapas</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-surface-500">
                                            <Users className="h-3.5 w-3.5" />
                                            <span>{seq.enrollments_count ?? 0} inscritos</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 mt-3" onClick={e => e.stopPropagation()}>
                                        <Button variant="ghost" size="sm" onClick={() => setViewSequence(seq)}>
                                            <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                                        </Button>
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={() => { setEnrollSequenceId(seq.id); setEnrollOpen(true) }}
                                        >
                                            <UserPlus className="h-3.5 w-3.5 mr-1" /> Inscrever
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(seq.id)}>
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={createOpen} onOpenChange={open => { if (!open) closeCreateDialog() }}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Nova Sequência de Vendas</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-5">
                        <Input
                            label="Nome da Sequência *"
                            placeholder="Ex: Onboarding Novos Clientes"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                        />
                        <Textarea
                            label="Descrição"
                            placeholder="Descreva o objetivo desta sequência..."
                            value={newDescription}
                            onChange={e => setNewDescription(e.target.value)}
                        />

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-surface-900">Etapas da Sequência</h4>
                                <Button variant="outline" size="sm" onClick={addStep}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Etapa
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {steps.map((step, idx) => (
                                    <div key={idx} className="rounded-lg border border-subtle p-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="info" size="xs">Etapa {idx + 1}</Badge>
                                            {steps.length > 1 && (
                                                <Button variant="ghost" size="sm" onClick={() => removeStep(idx)}>
                                                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                                                </Button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Input
                                                label="Espera (dias)"
                                                type="number"
                                                min={0}
                                                value={step.delay_days}
                                                onChange={e => updateStep(idx, 'delay_days', Number(e.target.value))}
                                            />
                                            <div className="space-y-1.5">
                                                <label className="block text-[13px] font-medium text-surface-700">Canal</label>
                                                <Select value={step.channel} onValueChange={val => updateStep(idx, 'channel', val)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="email">E-mail</SelectItem>
                                                        <SelectItem value="phone">Telefone</SelectItem>
                                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                                        <SelectItem value="sms">SMS</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-[13px] font-medium text-surface-700">Ação</label>
                                                <Select value={step.action_type} onValueChange={val => updateStep(idx, 'action_type', val)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="send_email">Enviar E-mail</SelectItem>
                                                        <SelectItem value="make_call">Fazer Ligação</SelectItem>
                                                        <SelectItem value="send_whatsapp">Enviar WhatsApp</SelectItem>
                                                        <SelectItem value="send_sms">Enviar SMS</SelectItem>
                                                        <SelectItem value="create_task">Criar Tarefa</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Input
                                            label="Assunto"
                                            placeholder="Assunto do e-mail ou título da tarefa"
                                            value={step.subject}
                                            onChange={e => updateStep(idx, 'subject', e.target.value)}
                                        />
                                        <Textarea
                                            label="Conteúdo"
                                            placeholder="Corpo da mensagem..."
                                            value={step.body}
                                            onChange={e => updateStep(idx, 'body', e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeCreateDialog}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Criando...' : 'Criar Sequência'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Enroll Dialog (list context) */}
            <Dialog open={enrollOpen} onOpenChange={open => { if (!open) closeEnrollDialog() }}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Inscrever Cliente na Sequência</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                        <Input
                            label="ID do Cliente *"
                            type="number"
                            placeholder="Ex: 42"
                            value={enrollCustomerId}
                            onChange={e => setEnrollCustomerId(e.target.value)}
                        />
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeEnrollDialog}>Cancelar</Button>
                        <Button
                            onClick={handleEnroll}
                            disabled={enrollMutation.isPending}
                        >
                            {enrollMutation.isPending ? 'Inscrevendo...' : 'Inscrever'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Excluir Sequência</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <p className="text-sm text-surface-600">
                            Tem certeza que deseja excluir esta sequência? Todas as inscrições serão canceladas. Esta ação não pode ser desfeita.
                        </p>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
