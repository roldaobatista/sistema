import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, FileText, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Props {
    type: 'nfe' | 'nfse'
    onClose: () => void
    onSuccess: () => void
}

interface ItemRow {
    description: string
    quantity: number
    unit_price: number
    ncm?: string
    cfop?: string
    service_code?: string
    lc116_code?: string
    iss_rate?: number
    iss_retained?: boolean
}

export default function FiscalEmitirDialog({ type, onClose, onSuccess }: Props) {
    const isNFe = type === 'nfe'
    const title = isNFe ? 'Emitir NF-e' : 'Emitir NFS-e'

    const [customerId, setCustomerId] = useState<number | null>(null)
    const [workOrderId, setWorkOrderId] = useState<number | null>(null)
    const [notes, setNotes] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [items, setItems] = useState<ItemRow[]>([
        { description: '', quantity: 1, unit_price: 0, ncm: '', cfop: '', service_code: '', lc116_code: '', iss_rate: 0, iss_retained: false },
    ])

    // NF-e advanced
    const [paymentMethod, setPaymentMethod] = useState('01')
    const [cfopGlobal, setCfopGlobal] = useState('')

    // NFS-e advanced
    const [issRate, setIssRate] = useState<number>(0)
    const [issRetained, setIssRetained] = useState(false)
    const [exigibilidadeIss, setExigibilidadeIss] = useState('1')

    const { data: customers } = useQuery({
        queryKey: ['customers-select'],
        queryFn: async () => {
            const { data } = await api.get('/customers?per_page=500&fields=id,name')
            return data.data ?? data ?? []
        },
    })

    const { data: cfopOptions } = useQuery({
        queryKey: ['fiscal-cfop-options'],
        queryFn: async () => {
            const { data } = await api.get('/fiscal/config/cfop-options')
            return data.data ?? []
        },
        enabled: isNFe,
    })

    const { data: issOptions } = useQuery({
        queryKey: ['fiscal-iss-exigibilidade-options'],
        queryFn: async () => {
            const { data } = await api.get('/fiscal/config/iss-exigibilidade-options')
            return data.data ?? []
        },
        enabled: !isNFe,
    })

    const { data: lc116Options } = useQuery({
        queryKey: ['fiscal-lc116-options'],
        queryFn: async () => {
            const { data } = await api.get('/fiscal/config/lc116-options')
            return data.data ?? []
        },
        enabled: !isNFe,
    })

    const mutation = useMutation({
        mutationFn: async () => {
            const endpoint = isNFe ? '/fiscal/nfe' : '/fiscal/nfse'
            const payload: any = {
                customer_id: customerId,
                work_order_id: workOrderId || null,
                informacoes_complementares: notes || null,
            }

            if (isNFe) {
                payload.payment_method = paymentMethod
                payload.cfop = cfopGlobal || undefined
                payload.items = items.map(i => ({
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    ncm: i.ncm || null,
                    cfop: i.cfop || cfopGlobal || null,
                }))
            } else {
                payload.iss_rate = issRate || undefined
                payload.iss_retained = issRetained
                payload.exigibilidade_iss = exigibilidadeIss
                payload.services = items.map(i => ({
                    description: i.description,
                    amount: i.quantity * i.unit_price,
                    quantity: i.quantity,
                    service_code: i.service_code || null,
                    lc116_code: i.lc116_code || null,
                    iss_rate: i.iss_rate || issRate || null,
                    iss_retained: i.iss_retained ?? issRetained,
                }))
            }

            const { data } = await api.post(endpoint, payload)
            return data
        },
        onSuccess: (data) => {
            if (data.success) {
                toast.success(data.contingency
                    ? 'Nota salva em contingência (SEFAZ indisponível)'
                    : (data.message || `${title} realizada com sucesso`)
                )
                onSuccess()
            } else {
                toast.error(data.message || 'Erro na emissão')
            }
        },
        onError: (error: any) => {
            if (error.response?.status === 422) {
                const errors = error.response.data.errors
                if (errors) {
                    Object.values(errors).flat().forEach((msg: any) => toast.error(msg))
                } else {
                    toast.error(error.response.data.message || 'Erro de validação')
                }
            } else if (error.response?.status === 403) {
                toast.error('Você não tem permissão para esta ação')
            } else {
                toast.error(error.response?.data?.message || 'Erro ao emitir nota fiscal')
            }
        },
    })

    const addItem = () => {
        setItems([...items, { description: '', quantity: 1, unit_price: 0, ncm: '', cfop: '', service_code: '', lc116_code: '', iss_rate: 0, iss_retained: false }])
    }

    const removeItem = (index: number) => {
        if (items.length <= 1) return
        setItems(items.filter((_, i) => i !== index))
    }

    const updateItem = (index: number, field: keyof ItemRow, value: any) => {
        setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
    }

    const total = items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0)
    const canSubmit = customerId && items.every(i => i.description && i.quantity > 0 && i.unit_price >= 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isNFe ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400'}`}>
                            <FileText className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors" aria-label="Fechar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
                    {/* Customer & WO */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Cliente <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={customerId ?? ''}
                                onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
                                aria-label="Selecionar cliente"
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-brand-500"
                            >
                                <option value="">Selecione...</option>
                                {(customers ?? []).map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Ordem de Serviço
                            </label>
                            <input
                                type="number"
                                placeholder="ID da OS (opcional)"
                                value={workOrderId ?? ''}
                                onChange={(e) => setWorkOrderId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                    </div>

                    {/* Items/Services */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                                {isNFe ? 'Itens' : 'Serviços'} <span className="text-red-500">*</span>
                            </label>
                            <button onClick={addItem} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 border border-border space-y-2">
                                    <div className="grid grid-cols-12 gap-2 items-end">
                                        <div className={isNFe ? 'col-span-4' : 'col-span-5'}>
                                            <label className="block text-xs text-surface-500 mb-1">Descrição</label>
                                            <input
                                                value={item.description}
                                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                placeholder="Descrição..."
                                                className="w-full px-2.5 py-2 rounded-md border border-border bg-card text-sm"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs text-surface-500 mb-1">Qtd</label>
                                            <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                aria-label="Quantidade"
                                                className="w-full px-2.5 py-2 rounded-md border border-border bg-card text-sm"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs text-surface-500 mb-1">{isNFe ? 'Preço Unit.' : 'Valor'}</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.unit_price}
                                                onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                aria-label="Preço"
                                                className="w-full px-2.5 py-2 rounded-md border border-border bg-card text-sm"
                                            />
                                        </div>
                                        {isNFe ? (
                                            <>
                                                <div className="col-span-2">
                                                    <label className="block text-xs text-surface-500 mb-1">NCM</label>
                                                    <input
                                                        value={item.ncm ?? ''}
                                                        onChange={(e) => updateItem(index, 'ncm', e.target.value)}
                                                        placeholder="0000.00.00"
                                                        className="w-full px-2.5 py-2 rounded-md border border-border bg-card text-sm"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-xs text-surface-500 mb-1">CFOP</label>
                                                    <input
                                                        value={item.cfop ?? ''}
                                                        onChange={(e) => updateItem(index, 'cfop', e.target.value)}
                                                        placeholder="5102"
                                                        className="w-full px-2.5 py-2 rounded-md border border-border bg-card text-sm"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="col-span-2">
                                                <label className="block text-xs text-surface-500 mb-1">LC 116</label>
                                                <select
                                                    value={item.lc116_code ?? ''}
                                                    onChange={(e) => updateItem(index, 'lc116_code', e.target.value)}
                                                    aria-label="Código LC 116"
                                                    className="w-full px-2.5 py-2 rounded-md border border-border bg-card text-sm"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {(lc116Options ?? []).map((opt: any) => (
                                                        <option key={opt.code} value={opt.code}>{opt.code} - {opt.description.substring(0, 30)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="col-span-1 flex justify-center">
                                            <button
                                                onClick={() => removeItem(index)}
                                                disabled={items.length <= 1}
                                                className="p-1.5 rounded-md text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 transition-colors"
                                                aria-label="Remover"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* NFS-e per-item ISS */}
                                    {!isNFe && (
                                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-surface-200 dark:border-surface-700">
                                            <div>
                                                <label className="block text-xs text-surface-500 mb-1">Cód. Serviço</label>
                                                <input
                                                    value={item.service_code ?? ''}
                                                    onChange={(e) => updateItem(index, 'service_code', e.target.value)}
                                                    placeholder="Código..."
                                                    className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-surface-500 mb-1">Alíquota ISS (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.iss_rate ?? 0}
                                                    onChange={(e) => updateItem(index, 'iss_rate', parseFloat(e.target.value) || 0)}
                                                    aria-label="Alíquota ISS"
                                                    className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-xs"
                                                />
                                            </div>
                                            <div className="flex items-end pb-0.5">
                                                <label className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-400 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.iss_retained ?? false}
                                                        onChange={(e) => updateItem(index, 'iss_retained', e.target.checked)}
                                                        aria-label="ISS Retido"
                                                        className="rounded border-surface-300"
                                                    />
                                                    ISS Retido
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Advanced Settings Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                        Configurações avançadas
                    </button>

                    {showAdvanced && (
                        <div className="p-4 rounded-lg border border-border bg-surface-50 dark:bg-surface-800/50 space-y-4">
                            {isNFe ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">CFOP padrão</label>
                                            <select
                                                value={cfopGlobal}
                                                onChange={(e) => setCfopGlobal(e.target.value)}
                                                aria-label="CFOP padrão"
                                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm"
                                            >
                                                <option value="">Selecione...</option>
                                                {(cfopOptions ?? []).map((opt: any) => (
                                                    <option key={opt.code} value={opt.code}>{opt.code} - {opt.description}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Forma de Pagamento</label>
                                            <select
                                                value={paymentMethod}
                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                aria-label="Forma de pagamento"
                                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm"
                                            >
                                                <option value="01">Dinheiro</option>
                                                <option value="02">Cheque</option>
                                                <option value="03">Cartão de Crédito</option>
                                                <option value="04">Cartão de Débito</option>
                                                <option value="05">Crédito Loja</option>
                                                <option value="10">Vale Alimentação</option>
                                                <option value="15">Boleto Bancário</option>
                                                <option value="16">Depósito Bancário</option>
                                                <option value="17">PIX</option>
                                                <option value="99">Outros</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Alíquota ISS Global (%)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={issRate}
                                                onChange={(e) => setIssRate(parseFloat(e.target.value) || 0)}
                                                aria-label="Alíquota ISS Global"
                                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Exigibilidade ISS</label>
                                            <select
                                                value={exigibilidadeIss}
                                                onChange={(e) => setExigibilidadeIss(e.target.value)}
                                                aria-label="Exigibilidade ISS"
                                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm"
                                            >
                                                {(issOptions ?? []).map((opt: any) => (
                                                    <option key={opt.code} value={opt.code}>{opt.code} - {opt.description}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-end pb-1">
                                            <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={issRetained}
                                                    onChange={(e) => setIssRetained(e.target.checked)}
                                                    aria-label="ISS Retido na Fonte"
                                                    className="rounded border-surface-300"
                                                />
                                                ISS Retido na Fonte
                                            </label>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Informações Complementares</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Informações adicionais que aparecerão na nota..."
                                    rows={2}
                                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-end">
                        <div className="text-right">
                            <span className="text-sm text-surface-500">Total: </span>
                            <span className="text-lg font-bold">
                                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-50 dark:bg-surface-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-800 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={!canSubmit || mutation.isPending}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isNFe
                            ? 'bg-brand-600 hover:bg-brand-700'
                            : 'bg-teal-600 hover:bg-teal-700'
                            }`}
                    >
                        {mutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Emitindo...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                {title}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
