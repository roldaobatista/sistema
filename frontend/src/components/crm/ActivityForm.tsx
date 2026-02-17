import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { crmApi } from '@/lib/crm-api'
import { toast } from 'sonner'

interface Props {
    open: boolean
    onClose: () => void
    customerId: number
    dealId?: number | null
}

const TYPES = [
    { value: 'ligacao', label: '📞 Ligação' },
    { value: 'email', label: '📧 E-mail' },
    { value: 'whatsapp', label: '💬 WhatsApp' },
    { value: 'reuniao', label: '👥 Reunião' },
    { value: 'visita', label: '📍 Visita' },
    { value: 'nota', label: '📝 Nota' },
    { value: 'tarefa', label: '✅ Tarefa' },
]

const OUTCOMES = [
    { value: 'conectou', label: 'Conectou' },
    { value: 'nao_atendeu', label: 'Não Atendeu' },
    { value: 'reagendar', label: 'Reagendar' },
    { value: 'sucesso', label: 'Sucesso' },
    { value: 'sem_interesse', label: 'Sem Interesse' },
]

const CHANNELS = [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'E-mail' },
    { value: 'telefone', label: 'Telefone' },
    { value: 'presencial', label: 'Presencial' },
]

export function ActivityForm({ open, onClose, customerId, dealId }: Props) {
    const queryClient = useQueryClient()
    const [form, setForm] = useState({
        type: 'nota',
        title: '',
        description: '',
        channel: '',
        outcome: '',
        scheduled_at: '',
        completed_at: '',
        duration_minutes: '',
    })

    const mutation = useMutation({
        mutationFn: () => crmApi.createActivity({
            type: form.type,
            customer_id: customerId,
            deal_id: dealId ?? null,
            title: form.title,
            description: form.description || null,
            channel: form.channel || null,
            outcome: form.outcome || null,
            scheduled_at: form.scheduled_at || null,
            completed_at: form.completed_at || new Date().toISOString(),
            duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            queryClient.invalidateQueries({ queryKey: ['customer-360'] })
            toast.success('Atividade registrada com sucesso')
            onClose()
            setForm({ type: 'nota', title: '', description: '', channel: '', outcome: '', scheduled_at: '', completed_at: '', duration_minutes: '' })
        },
        onError: (error: any) => {
            if (error.response?.status === 422) {
                toast.error('Dados inválidos. Verifique os campos.')
            } else {
                toast.error(error.response?.data?.message || 'Erro ao registrar atividade')
            }
        },
    })

    const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))

    return (
        <Modal open={open} onOpenChange={v => !v && onClose()} title="Registrar Atividade" size="lg">
            <div className="space-y-4">
                {/* Type picker */}
                <div>
                    <label className="text-xs font-medium text-surface-600 mb-2 block">Tipo</label>
                    <div className="flex flex-wrap gap-2">
                        {TYPES.map(t => (
                            <button
                                key={t.value}
                                onClick={() => set('type', t.value)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${form.type === t.value
                                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                                    : 'border-subtle bg-surface-0 text-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-surface-600 mb-1 block">Título *</label>
                    <Input
                        value={form.title}
                        onChange={e => set('title', e.target.value)}
                        placeholder="Ex: Retorno sobre proposta"
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-surface-600 mb-1 block">Descrição</label>
                    <textarea
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                        className="w-full rounded-lg border border-default px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        rows={3}
                        placeholder="Detalhes opcionais..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-surface-600 mb-1 block">Canal</label>
                        <select
                            value={form.channel}
                            onChange={e => set('channel', e.target.value)}
                            className="w-full rounded-lg border border-default px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        >
                            <option value="">—</option>
                            {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-surface-600 mb-1 block">Resultado</label>
                        <select
                            value={form.outcome}
                            onChange={e => set('outcome', e.target.value)}
                            className="w-full rounded-lg border border-default px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        >
                            <option value="">—</option>
                            {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-surface-600 mb-1 block">Agendado para</label>
                        <Input
                            type="datetime-local"
                            value={form.scheduled_at}
                            onChange={e => set('scheduled_at', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-surface-600 mb-1 block">Concluído em</label>
                        <Input
                            type="datetime-local"
                            value={form.completed_at}
                            onChange={e => set('completed_at', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-surface-600 mb-1 block">Duração (min)</label>
                        <Input
                            type="number"
                            value={form.duration_minutes}
                            onChange={e => set('duration_minutes', e.target.value)}
                            placeholder="—"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        variant="primary"
                        onClick={() => mutation.mutate()}
                        disabled={!form.title || mutation.isPending}
                    >
                        {mutation.isPending ? 'Salvando…' : 'Registrar Atividade'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
