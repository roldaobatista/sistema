import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, FileText } from 'lucide-react'
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
    service_code?: string
}

export default function FiscalEmitirDialog({ type, onClose, onSuccess }: Props) {
    const isNFe = type === 'nfe'
    const title = isNFe ? 'Emitir NF-e' : 'Emitir NFS-e'

    const [customerId, setCustomerId] = useState<number | ''>('')
    const [workOrderId, setWorkOrderId] = useState<number | ''>('')
    const [items, setItems] = useState<ItemRow[]>([
        { description: '', quantity: 1, unit_price: 0, ncm: '', service_code: '' },
    ])

    const { data: customers } = useQuery({
        queryKey: ['customers-select'],
        queryFn: async () => {
            const { data } = await api.get('/customers?per_page=500&fields=id,name')
            return data.data ?? data ?? []
        },
    })

    const mutation = useMutation({
        mutationFn: async () => {
            const endpoint = isNFe ? '/fiscal/nfe' : '/fiscal/nfse'
            const payload: any = {
                customer_id: customerId,
                work_order_id: workOrderId || null,
            }

            if (isNFe) {
                payload.items = items.map(i => ({
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    ncm: i.ncm || null,
                }))
            } else {
                payload.services = items.map(i => ({
                    description: i.description,
                    amount: i.quantity * i.unit_price,
                    service_code: i.service_code || null,
                }))
            }

            const { data } = await api.post(endpoint, payload)
            return data
        },
        onSuccess: (data) => {
            if (data.success) {
                toast.success(data.message || `${title} realizada com sucesso`)
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
        setItems([...items, { description: '', quantity: 1, unit_price: 0, ncm: '', service_code: '' }])
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
            <div className="relative bg-white dark:bg-surface-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isNFe ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            <FileText className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors" aria-label="Fechar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
                    {/* Customer & Work Order */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Cliente <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
                                aria-label="Selecionar cliente"
                                className="w-full px-3 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:ring-2 focus:ring-brand-500"
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
                                value={workOrderId}
                                onChange={(e) => setWorkOrderId(e.target.value ? Number(e.target.value) : '')}
                                className="w-full px-3 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                    </div>

                    {/* Items */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                                {isNFe ? 'Itens' : 'Serviços'} <span className="text-red-500">*</span>
                            </label>
                            <button
                                onClick={addItem}
                                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 border border-surface-100 dark:border-surface-700">
                                    <div className="col-span-5">
                                        <label className="block text-xs text-surface-500 mb-1">Descrição</label>
                                        <input
                                            value={item.description}
                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                            placeholder="Descrição do item..."
                                            className="w-full px-2.5 py-2 rounded-md border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm"
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
                                            className="w-full px-2.5 py-2 rounded-md border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm"
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
                                            aria-label="Preço unitário"
                                            className="w-full px-2.5 py-2 rounded-md border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-surface-500 mb-1">{isNFe ? 'NCM' : 'Cód. Serviço'}</label>
                                        <input
                                            value={isNFe ? (item.ncm ?? '') : (item.service_code ?? '')}
                                            onChange={(e) => updateItem(index, isNFe ? 'ncm' : 'service_code', e.target.value)}
                                            placeholder={isNFe ? '0000.00.00' : '01.02'}
                                            className="w-full px-2.5 py-2 rounded-md border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            onClick={() => removeItem(index)}
                                            disabled={items.length <= 1}
                                            className="p-1.5 rounded-md text-surface-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Remover item"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Total */}
                    <div className="flex justify-end">
                        <div className="text-right">
                            <span className="text-sm text-surface-500">Total: </span>
                            <span className="text-lg font-bold text-surface-900 dark:text-surface-100">
                                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/30">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-800 rounded-lg hover:bg-surface-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={!canSubmit || mutation.isPending}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isNFe
                            ? 'bg-brand-600 hover:bg-brand-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
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
