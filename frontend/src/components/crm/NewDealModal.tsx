import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { crmApi } from '@/lib/crm-api'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import api from '@/lib/api'
import { toast } from 'sonner'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { Lightbulb } from 'lucide-react'

interface Props {
    open: boolean
    onClose: () => void
    pipelineId: number
    stageId: number
    initialCustomerId?: number
    initialTitle?: string
    initialSource?: string
}

export function NewDealModal({ open, onClose, pipelineId, stageId, initialCustomerId, initialTitle, initialSource }: Props) {
    const queryClient = useQueryClient()
    const [form, setForm] = useState({
        title: '',
        customer_id: '',
        value: '',
        expected_close_date: '',
        source: '',
        notes: '',
    })

    useEffect(() => {
        if (open && (initialCustomerId != null || initialTitle != null || initialSource != null)) {
            setForm(prev => ({
                ...prev,
                ...(initialCustomerId != null && { customer_id: String(initialCustomerId) }),
                ...(initialTitle != null && initialTitle !== '' && { title: initialTitle }),
                ...(initialSource != null && initialSource !== '' && { source: initialSource }),
            }))
        }
    }, [open, initialCustomerId, initialTitle, initialSource])

    // Fetch customers for select
    const { data: customersRes } = useQuery({
        queryKey: ['customers-list'],
        queryFn: () => api.get('/customers', { params: { per_page: 500 } }),
        enabled: open,
    })

    const customers = customersRes?.data?.data ?? []

    // Smart suggestions when customer is selected (#13)
    const { data: suggestions } = useQuery({
        queryKey: ['crm-smart-suggestions', form.customer_id],
        queryFn: async () => {
            const customerId = Number(form.customer_id)
            const [crossSell, recentDeals] = await Promise.allSettled([
                crmFeaturesApi.getCrossSellRecommendations(customerId),
                crmApi.getDeals({ customer_id: customerId, per_page: 5 }),
            ])
            const recs = crossSell.status === 'fulfilled' ? (crossSell.value.data ?? []) : []
            const recent = recentDeals.status === 'fulfilled' ? (recentDeals.value.data?.data ?? []) : []
            return { recommendations: recs.slice(0, 3), recentDeals: recent.slice(0, 3) }
        },
        enabled: open && !!form.customer_id,
    })

    const resetForm = () => {
        setForm({ title: '', customer_id: '', value: '', expected_close_date: '', source: '', notes: '' })
    }

    const createMutation = useMutation({
        mutationFn: () => crmApi.createDeal({
            title: form.title,
            customer_id: Number(form.customer_id),
            pipeline_id: pipelineId,
            stage_id: stageId,
            value: Number(form.value) || 0,
            expected_close_date: form.expected_close_date || null,
            source: form.source || null,
            notes: form.notes || null,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            broadcastQueryInvalidation(['crm'], 'Deal')
            toast.success('Deal criado com sucesso')
            resetForm()
            onClose()
        },
        onError: (error: any) => {
            if (error.response?.status === 422) {
                toast.error('Dados inválidos. Verifique os campos.')
            } else {
                toast.error(error.response?.data?.message || 'Erro ao criar deal')
            }
        },
    })

    const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))

    return (
        <Modal open={open} onOpenChange={v => !v && onClose()} title="Novo Deal" size="lg">
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-medium text-surface-600 mb-1 block">Título *</label>
                    <Input
                        value={form.title}
                        onChange={e => set('title', e.target.value)}
                        placeholder="Ex: Calibração Balança 500kg"
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-surface-600 mb-1 block" id="new-deal-customer-label">Cliente *</label>
                    <select
                        aria-labelledby="new-deal-customer-label"
                        value={form.customer_id}
                        onChange={e => set('customer_id', e.target.value)}
                        className="w-full rounded-lg border border-default px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                        <option value="">Selecione um cliente</option>
                        {customers.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Smart Suggestions (#13) */}
                {form.customer_id && suggestions && (suggestions.recommendations.length > 0 || suggestions.recentDeals.length > 0) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                            <Lightbulb className="h-3.5 w-3.5" /> Sugestões Inteligentes
                        </div>
                        {suggestions.recommendations.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Cross-sell</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {suggestions.recommendations.map((r: any, i: number) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => set('title', r.service || r.product || r.name || '')}
                                            className="rounded-md bg-white border border-amber-200 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 transition-colors"
                                        >
                                            {r.service || r.product || r.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {suggestions.recentDeals.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Deals recentes</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {suggestions.recentDeals.map((d: any) => (
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => {
                                                set('title', d.title)
                                                if (d.value) set('value', String(d.value))
                                                if (d.source) set('source', d.source)
                                            }}
                                            className="rounded-md bg-white border border-amber-200 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 transition-colors"
                                        >
                                            {d.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-surface-600 mb-1 block">Valor (R$)</label>
                        <Input
                            type="number"
                            value={form.value}
                            onChange={e => set('value', e.target.value)}
                            placeholder="0,00"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-surface-600 mb-1 block">Previsão de Fechamento</label>
                        <Input
                            type="date"
                            value={form.expected_close_date}
                            onChange={e => set('expected_close_date', e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-surface-600 mb-1 block" id="new-deal-source-label">Origem</label>
                    <select
                        aria-labelledby="new-deal-source-label"
                        value={form.source}
                        onChange={e => set('source', e.target.value)}
                        className="w-full rounded-lg border border-default px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                        <option value="">Selecione</option>
                        <option value="calibracao_vencendo">Calibração Vencendo</option>
                        <option value="indicacao">Indicação</option>
                        <option value="prospeccao">Prospecção</option>
                        <option value="chamado">Chamado Técnico</option>
                        <option value="contrato_renovacao">Renovação de Contrato</option>
                        <option value="retorno">Retorno de Cliente</option>
                        <option value="outro">Outro</option>
                    </select>
                </div>

                <div>
                    <label className="text-xs font-medium text-surface-600 mb-1 block">Observações</label>
                    <textarea
                        value={form.notes}
                        onChange={e => set('notes', e.target.value)}
                        className="w-full rounded-lg border border-default px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        rows={3}
                        placeholder="Notas opcionais..."
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        variant="primary"
                        onClick={() => createMutation.mutate()}
                        disabled={!form.title || !form.customer_id || createMutation.isPending}
                    >
                        {createMutation.isPending ? 'Criando…' : 'Criar Deal'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
