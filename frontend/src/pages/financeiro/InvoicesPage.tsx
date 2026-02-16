import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Eye, FileText, Plus, Search, Send, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'

type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'cancelled'

type Invoice = {
    id: number
    invoice_number: string
    nf_number: string | null
    customer?: { id: number; name: string } | null
    work_order?: { id: number; number: string; os_number?: string | null; business_number?: string | null } | null
    status: InvoiceStatus
    total: number | string
    issued_at: string | null
    due_date: string | null
    observations: string | null
    items: Array<{ description: string; quantity: number; unit_price: number; total: number }> | null
    created_at: string
}

type InvoicePaginator = {
    data: Invoice[]
    current_page: number
    last_page: number
    total: number
}

type InvoiceMetadata = {
    customers: Array<{ id: number; name: string }>
    work_orders: Array<{
        id: number
        customer_id: number
        number: string
        os_number?: string | null
        business_number?: string | null
        status: string
        total: number
    }>
    statuses: Record<string, string>
}

type ApiErrorLike = {
    response?: {
        status?: number
        data?: {
            message?: string
        }
    }
}

type ConfirmAction =
    | { type: 'delete'; invoice: Invoice }
    | { type: 'status'; invoice: Invoice; nextStatus: InvoiceStatus }

const statusMap: Record<InvoiceStatus, { label: string; variant: 'default' | 'info' | 'success' | 'danger' }> = {
    draft: { label: 'Rascunho', variant: 'default' },
    issued: { label: 'Emitida', variant: 'info' },
    sent: { label: 'Enviada', variant: 'success' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
}

const fmtBRL = (value: number | string) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const woIdentifier = (workOrder?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    workOrder?.business_number ?? workOrder?.os_number ?? workOrder?.number ?? '-'

export function InvoicesPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')

    const canCreate = isSuperAdmin || hasPermission('finance.receivable.create')
    const canUpdate = isSuperAdmin || hasPermission('finance.receivable.update')
    const canDelete = isSuperAdmin || hasPermission('finance.receivable.delete')

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [page, setPage] = useState(1)
    const [showModal, setShowModal] = useState(false)
    const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null)
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
    const [form, setForm] = useState({
        customer_id: '',
        work_order_id: '',
        nf_number: '',
        due_date: '',
        observations: '',
    })

    const invoicesQuery = useQuery({
        queryKey: ['invoices', search, statusFilter, page],
        queryFn: async () => {
            const { data } = await api.get<InvoicePaginator>('/invoices', {
                params: {
                    search: search || undefined,
                    status: statusFilter || undefined,
                    page,
                    per_page: 20,
                },
            })
            return data
        },
    })

    const metadataQuery = useQuery({
        queryKey: ['invoices-metadata'],
        queryFn: async () => {
            const { data } = await api.get<InvoiceMetadata>('/invoices/metadata')
            return data
        },
        enabled: showModal && canCreate,
    })

    const createMut = useMutation({
        mutationFn: async () => {
            await api.post('/invoices', {
                customer_id: Number(form.customer_id),
                work_order_id: form.work_order_id ? Number(form.work_order_id) : null,
                nf_number: form.nf_number || null,
                due_date: form.due_date || null,
                observations: form.observations || null,
            })
        },
        onSuccess: () => {
            toast.success('Fatura criada com sucesso')
                qc.invalidateQueries({ queryKey: ['invoices'] })
            setShowModal(false)
            setForm({ customer_id: '', work_order_id: '', nf_number: '', due_date: '', observations: '' })
        },
        onError: (error: ApiErrorLike) => {
            if (error?.response?.status === 403) {
                toast.error('Sem permissao para criar fatura')
                return
            }
            toast.error(error?.response?.data?.message ?? 'Erro ao criar fatura')
        },
    })

    const deleteMut = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/invoices/${id}`)
        },
        onSuccess: () => {
            toast.success('Fatura excluida com sucesso')
                qc.invalidateQueries({ queryKey: ['invoices'] })
        },
        onError: (error: ApiErrorLike) => {
            if (error?.response?.status === 403) {
                toast.error('Sem permissao para excluir fatura')
                return
            }
            toast.error(error?.response?.data?.message ?? 'Erro ao excluir fatura')
        },
    })

    const statusMut = useMutation({
        mutationFn: async ({ id, status }: { id: number; status: InvoiceStatus }) => {
            await api.put(`/invoices/${id}`, { status })
        },
        onSuccess: () => {
            toast.success('Status da fatura atualizado')
                qc.invalidateQueries({ queryKey: ['invoices'] })
            if (detailInvoice) {
                loadInvoiceDetail(detailInvoice.id)
            }
        },
        onError: (error: ApiErrorLike) => {
            if (error?.response?.status === 403) {
                toast.error('Sem permissao para alterar status da fatura')
                return
            }
            toast.error(error?.response?.data?.message ?? 'Erro ao atualizar fatura')
        },
    })

    const invoices = invoicesQuery.data?.data ?? []
    const currentPage = invoicesQuery.data?.current_page ?? 1
    const lastPage = invoicesQuery.data?.last_page ?? 1
    const total = invoicesQuery.data?.total ?? 0

    const customers = metadataQuery.data?.customers ?? []
    const workOrders = metadataQuery.data?.work_orders ?? []

    const loadInvoiceDetail = async (id: number) => {
        try {
            const { data } = await api.get<Invoice>(`/invoices/${id}`)
            setDetailInvoice(data)
        } catch (error: unknown) {
            toast.error((error as ApiErrorLike | undefined)?.response?.data?.message ?? 'Erro ao carregar detalhes da fatura')
        }
    }

    const closeModal = () => {
        setShowModal(false)
        setForm({ customer_id: '', work_order_id: '', nf_number: '', due_date: '', observations: '' })
    }

    const handleWorkOrderChange = (value: string) => {
        const selected = workOrders.find((workOrder) => String(workOrder.id) === value)
        if (!selected) {
            setForm((prev) => ({ ...prev, work_order_id: '', customer_id: prev.customer_id }))
            return
        }

        setForm((prev) => ({
            ...prev,
            work_order_id: value,
            customer_id: String(selected.customer_id),
        }))
    }

    const changeStatus = (invoice: Invoice, nextStatus: InvoiceStatus) => {
        if (!canUpdate) {
            toast.error('Sem permissao para alterar status da fatura')
            return
        }
        setConfirmAction({ type: 'status', invoice, nextStatus })
    }

    const removeInvoice = (invoice: Invoice) => {
        if (!canDelete) {
            toast.error('Sem permissao para excluir fatura')
            return
        }
        setConfirmAction({ type: 'delete', invoice })
    }

    const runConfirmAction = () => {
        if (!confirmAction) return

        if (confirmAction.type === 'status') {
            statusMut.mutate({ id: confirmAction.invoice.id, status: confirmAction.nextStatus })
            setConfirmAction(null)
            return
        }

        deleteMut.mutate(confirmAction.invoice.id)
        setConfirmAction(null)
    }

    const confirmLoading = confirmAction?.type === 'status' ? statusMut.isPending : deleteMut.isPending
    const confirmTitle = confirmAction?.type === 'status' ? 'Alterar Status da Fatura' : 'Excluir Fatura'
    const confirmDescription = confirmAction?.type === 'status'
        ? `Alterar a fatura ${confirmAction.invoice.invoice_number} para ${statusMap[confirmAction.nextStatus].label}?`
        : `Excluir a fatura ${confirmAction?.invoice.invoice_number}? Esta acao nao pode ser desfeita.`
    const confirmButtonText = confirmAction?.type === 'status' ? 'Confirmar Status' : 'Excluir'
    const confirmButtonVariant = confirmAction?.type === 'status' ? 'primary' : 'danger'

    return (
        <div className="space-y-5">
            <PageHeader
                title="Faturamento / NF"
                subtitle="Notas fiscais e faturamento"
                count={total}
                actions={canCreate ? [{ label: 'Nova Fatura', onClick: () => setShowModal(true), icon: <Plus className="h-4 w-4" /> }] : []}
            />

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar por numero, NF, cliente ou OS..."
                        value={search}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            setSearch(event.target.value)
                            setPage(1)
                        }}
                        className="w-full rounded-lg border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                        setStatusFilter(event.target.value)
                        setPage(1)
                    }}
                    className="rounded-lg border border-default bg-surface-0 px-3 py-2.5 text-sm shadow-sm"
                >
                    <option value="">Todos os status</option>
                    {Object.entries(statusMap).map(([status, meta]) => (
                        <option key={status} value={status}>{meta.label}</option>
                    ))}
                </select>
            </div>

            {invoicesQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Erro ao carregar faturas.
                </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface-50 text-surface-600">
                            <tr>
                                <th className="px-3.5 py-2.5 text-left font-medium">Nº Fatura</th>
                                <th className="px-3.5 py-2.5 text-left font-medium">Cliente</th>
                                <th className="px-3.5 py-2.5 text-left font-medium">OS</th>
                                <th className="px-3.5 py-2.5 text-left font-medium">Status</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">Total</th>
                                <th className="px-3.5 py-2.5 text-left font-medium">Emissao</th>
                                <th className="px-3.5 py-2.5 text-center font-medium">Acoes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {invoicesQuery.isLoading ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>
                            ) : invoices.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-2">
                                    <EmptyState icon={<FileText className="h-5 w-5 text-surface-300" />} message="Nenhuma fatura encontrada" action={canCreate ? { label: 'Nova Fatura', onClick: () => setShowModal(true), icon: <Plus className="h-4 w-4" /> } : undefined} compact />
                                </td></tr>
                            ) : invoices.map((invoice) => (
                                <tr key={invoice.id} className="transition-colors duration-100 hover:bg-surface-50">
                                    <td className="px-4 py-3 font-bold text-brand-600">{invoice.invoice_number}</td>
                                    <td className="px-4 py-3 text-surface-700">{invoice.customer?.name ?? '-'}</td>
                                    <td className="px-4 py-3 text-surface-500">{woIdentifier(invoice.work_order)}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={statusMap[invoice.status]?.variant ?? 'default'}>
                                            {statusMap[invoice.status]?.label ?? invoice.status}
                                        </Badge>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-semibold text-surface-900">{fmtBRL(invoice.total)}</td>
                                    <td className="px-4 py-3 text-surface-500">
                                        {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('pt-BR') : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => loadInvoiceDetail(invoice.id)}
                                                className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"
                                                title="Ver detalhes"
                                            >
                                                <Eye size={16} />
                                            </button>

                                            {invoice.status === 'draft' && canUpdate ? (
                                                <button
                                                    onClick={() => changeStatus(invoice, 'issued')}
                                                    className="rounded p-1.5 text-surface-400 hover:bg-blue-50 hover:text-blue-600"
                                                    title="Emitir"
                                                >
                                                    <Send size={16} />
                                                </button>
                                            ) : null}

                                            {invoice.status === 'issued' && canUpdate ? (
                                                <button
                                                    onClick={() => changeStatus(invoice, 'sent')}
                                                    className="rounded p-1.5 text-surface-400 hover:bg-emerald-50 hover:text-emerald-600"
                                                    title="Marcar como enviada"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            ) : null}

                                            {(invoice.status === 'draft' || invoice.status === 'issued' || invoice.status === 'sent') && canUpdate ? (
                                                <button
                                                    onClick={() => changeStatus(invoice, 'cancelled')}
                                                    className="rounded p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"
                                                    title="Cancelar"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            ) : null}

                                            {invoice.status === 'draft' && canDelete ? (
                                                <button
                                                    onClick={() => removeInvoice(invoice)}
                                                    className="rounded p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <span className="text-xs text-surface-500">Total: {total}</span>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                        Anterior
                    </Button>
                    <span className="text-xs text-surface-500">Pagina {currentPage} de {lastPage}</span>
                    <Button variant="outline" size="sm" disabled={currentPage >= lastPage} onClick={() => setPage((prev) => prev + 1)}>
                        Proxima
                    </Button>
                </div>
            </div>

            <Modal open={!!detailInvoice} onOpenChange={() => setDetailInvoice(null)} title={`Fatura ${detailInvoice?.invoice_number ?? ''}`} size="lg">
                {detailInvoice ? (
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-surface-500">Cliente:</span><span className="font-medium">{detailInvoice.customer?.name ?? '-'}</span></div>
                        <div className="flex justify-between"><span className="text-surface-500">OS:</span><span className="font-medium">{woIdentifier(detailInvoice.work_order)}</span></div>
                        <div className="flex justify-between"><span className="text-surface-500">Status:</span><Badge variant={statusMap[detailInvoice.status]?.variant ?? 'default'}>{statusMap[detailInvoice.status]?.label ?? detailInvoice.status}</Badge></div>
                        <div className="flex justify-between"><span className="text-surface-500">Numero NF:</span><span className="font-medium">{detailInvoice.nf_number ?? '-'}</span></div>
                        <div className="flex justify-between"><span className="text-surface-500">Vencimento:</span><span className="font-medium">{detailInvoice.due_date ? new Date(detailInvoice.due_date).toLocaleDateString('pt-BR') : '-'}</span></div>
                        <div className="flex justify-between"><span className="text-surface-500">Total:</span><span className="text-lg font-bold">{fmtBRL(detailInvoice.total)}</span></div>
                        {detailInvoice.observations ? (
                            <div>
                                <span className="text-surface-500">Observacoes:</span>
                                <p className="mt-1 text-surface-700">{detailInvoice.observations}</p>
                            </div>
                        ) : null}
                        {detailInvoice.items && detailInvoice.items.length > 0 ? (
                            <div>
                                <span className="font-medium text-surface-500">Itens:</span>
                                <div className="mt-2 overflow-hidden rounded-lg border border-default">
                                    <table className="w-full text-xs">
                                        <thead className="bg-surface-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Descricao</th>
                                                <th className="px-3 py-2 text-right">Qtd</th>
                                                <th className="px-3 py-2 text-right">Unit</th>
                                                <th className="px-3 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-subtle">
                                            {detailInvoice.items.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="px-3 py-2">{item.description}</td>
                                                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                                                    <td className="px-3 py-2 text-right">{fmtBRL(item.unit_price)}</td>
                                                    <td className="px-3 py-2 text-right font-medium">{fmtBRL(item.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </Modal>

            <Modal open={showModal} onOpenChange={closeModal} title="Nova Fatura">
                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (!canCreate) return
                        createMut.mutate()
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="mb-1 block text-sm font-medium text-surface-700">Cliente *</label>
                        <select
                            required
                            value={form.customer_id}
                            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setForm((prev) => ({ ...prev, customer_id: event.target.value }))}
                            className="w-full rounded-lg border border-default px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        >
                            <option value="">Selecione o cliente</option>
                            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-surface-700">OS (opcional)</label>
                        <select
                            value={form.work_order_id}
                            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => handleWorkOrderChange(event.target.value)}
                            className="w-full rounded-lg border border-default px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        >
                            <option value="">Nenhuma OS vinculada</option>
                            {workOrders.map((workOrder) => (
                                <option key={workOrder.id} value={workOrder.id}>
                                    {workOrder.business_number ?? workOrder.os_number ?? workOrder.number}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-surface-700">Numero da NF</label>
                        <input
                            value={form.nf_number}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, nf_number: event.target.value }))}
                            className="w-full rounded-lg border border-default px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-surface-700">Data de vencimento</label>
                        <input
                            type="date"
                            value={form.due_date}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
                            className="w-full rounded-lg border border-default px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-surface-700">Observacoes</label>
                        <textarea
                            value={form.observations}
                            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setForm((prev) => ({ ...prev, observations: event.target.value }))}
                            rows={3}
                            className="w-full rounded-lg border border-default px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        />
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button variant="outline" type="button" onClick={closeModal}>Cancelar</Button>
                        <Button type="submit" loading={createMut.isPending}>Criar Fatura</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!confirmAction} onOpenChange={() => setConfirmAction(null)} title={confirmTitle ?? 'Confirmacao'}>
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">{confirmDescription}</p>
                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
                        <Button variant={confirmButtonVariant} loading={confirmLoading} onClick={runConfirmAction}>
                            {confirmButtonText}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
