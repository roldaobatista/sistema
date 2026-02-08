import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Search, X, Eye, Trash2, Edit } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/Badge'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const statusMap: Record<string, { label: string; variant: string }> = {
    draft: { label: 'Rascunho', variant: 'default' },
    issued: { label: 'Emitida', variant: 'info' },
    paid: { label: 'Paga', variant: 'success' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
}

interface Invoice {
    id: number
    invoice_number: string
    customer?: { id: number; name: string }
    work_order?: { id: number; number: string }
    type: string
    status: string
    total: number
    issued_at: string | null
    due_date: string | null
    notes: string | null
    items: any[] | null
    created_at: string
}

export function InvoicesPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null)
    const [form, setForm] = useState({
        customer_id: '',
        work_order_id: '',
        type: 'nf_servico',
        notes: '',
    })

    const { data: res, isLoading } = useQuery({
        queryKey: ['invoices', search, statusFilter],
        queryFn: () => api.get('/invoices', {
            params: { search, status: statusFilter || undefined },
        }),
    })

    const invoices: Invoice[] = res?.data?.data ?? res?.data ?? []

    const createMut = useMutation({
        mutationFn: (data: typeof form) => api.post('/invoices', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); closeModal() },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/invoices/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
    })

    function closeModal() {
        setShowModal(false)
        setForm({ customer_id: '', work_order_id: '', type: 'nf_servico', notes: '' })
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        createMut.mutate(form)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-surface-900">Faturamento / NF</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-700 transition-colors"
                >
                    <Plus size={16} /> Nova Fatura
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nº ou cliente..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-surface-200 bg-white pl-10 pr-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-sm shadow-sm"
                >
                    <option value="">Todos os status</option>
                    {Object.entries(statusMap).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-surface-200 bg-white shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface-50 text-surface-600">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Nº NF</th>
                                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                                <th className="px-4 py-3 text-left font-medium">OS</th>
                                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                                <th className="px-4 py-3 text-left font-medium">Status</th>
                                <th className="px-4 py-3 text-right font-medium">Total</th>
                                <th className="px-4 py-3 text-left font-medium">Emissão</th>
                                <th className="px-4 py-3 text-center font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {isLoading ? (
                                <tr><td colSpan={8} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>
                            ) : invoices.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-surface-400">
                                    <FileText className="mx-auto h-8 w-8 mb-2 text-surface-300" />
                                    Nenhuma fatura encontrada
                                </td></tr>
                            ) : invoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-surface-50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-brand-600">{inv.invoice_number}</td>
                                    <td className="px-4 py-3 text-surface-700">{inv.customer?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-surface-500">{inv.work_order?.number ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-medium text-surface-600 uppercase">{inv.type?.replace('_', ' ')}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={(statusMap[inv.status]?.variant ?? 'default') as any}>
                                            {statusMap[inv.status]?.label ?? inv.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-surface-900">
                                        {fmtBRL(parseFloat(String(inv.total ?? 0)))}
                                    </td>
                                    <td className="px-4 py-3 text-surface-500">
                                        {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('pt-BR') : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => setDetailInvoice(inv)}
                                                className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"
                                                title="Ver detalhes"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {inv.status === 'draft' && (
                                                <button
                                                    onClick={() => { if (confirm('Excluir esta fatura?')) deleteMut.mutate(inv.id) }}
                                                    className="rounded p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {detailInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-surface-900">Fatura {detailInvoice.invoice_number}</h2>
                            <button onClick={() => setDetailInvoice(null)} className="rounded-lg p-1.5 hover:bg-surface-100">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-surface-500">Cliente:</span><span className="font-medium">{detailInvoice.customer?.name ?? '—'}</span></div>
                            <div className="flex justify-between"><span className="text-surface-500">OS:</span><span className="font-medium">{detailInvoice.work_order?.number ?? '—'}</span></div>
                            <div className="flex justify-between"><span className="text-surface-500">Tipo:</span><span className="font-medium uppercase">{detailInvoice.type?.replace('_', ' ')}</span></div>
                            <div className="flex justify-between"><span className="text-surface-500">Status:</span><Badge variant={(statusMap[detailInvoice.status]?.variant ?? 'default') as any}>{statusMap[detailInvoice.status]?.label ?? detailInvoice.status}</Badge></div>
                            <div className="flex justify-between"><span className="text-surface-500">Total:</span><span className="font-bold text-lg">{fmtBRL(parseFloat(String(detailInvoice.total ?? 0)))}</span></div>
                            {detailInvoice.notes && (
                                <div><span className="text-surface-500">Observações:</span><p className="mt-1 text-surface-700">{detailInvoice.notes}</p></div>
                            )}
                            {detailInvoice.items && detailInvoice.items.length > 0 && (
                                <div>
                                    <span className="text-surface-500 font-medium">Itens:</span>
                                    <div className="mt-2 rounded-lg border border-surface-200 overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-surface-50"><tr>
                                                <th className="px-3 py-2 text-left">Descrição</th>
                                                <th className="px-3 py-2 text-right">Qtd</th>
                                                <th className="px-3 py-2 text-right">Unit</th>
                                                <th className="px-3 py-2 text-right">Total</th>
                                            </tr></thead>
                                            <tbody className="divide-y divide-surface-100">
                                                {detailInvoice.items.map((it: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="px-3 py-2">{it.description}</td>
                                                        <td className="px-3 py-2 text-right">{it.quantity}</td>
                                                        <td className="px-3 py-2 text-right">{fmtBRL(it.unit_price)}</td>
                                                        <td className="px-3 py-2 text-right font-medium">{fmtBRL(it.total)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-surface-900">Nova Fatura</h2>
                            <button onClick={closeModal} className="rounded-lg p-1.5 hover:bg-surface-100">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">ID do Cliente</label>
                                <input
                                    type="number"
                                    required
                                    value={form.customer_id}
                                    onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))}
                                    className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">ID da OS (opcional)</label>
                                <input
                                    type="number"
                                    value={form.work_order_id}
                                    onChange={e => setForm(p => ({ ...p, work_order_id: e.target.value }))}
                                    className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                                    placeholder="Copiar itens da OS automaticamente"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Tipo</label>
                                <select
                                    value={form.type}
                                    onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                                    className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm"
                                >
                                    <option value="nf_servico">NF Serviço</option>
                                    <option value="nf_produto">NF Produto</option>
                                    <option value="recibo">Recibo</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Observações</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                    className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={closeModal} className="rounded-lg border border-surface-200 px-4 py-2.5 text-sm hover:bg-surface-50">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMut.isPending}
                                    className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-50"
                                >
                                    {createMut.isPending ? 'Criando...' : 'Criar Fatura'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
