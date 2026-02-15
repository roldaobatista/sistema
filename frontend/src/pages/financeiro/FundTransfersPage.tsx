import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowRightLeft, Plus, Ban, Search, Wallet, TrendingUp, Users,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

interface BankAccount {
    id: number
    name: string
    bank_name: string
}

interface Technician {
    id: number
    name: string
}

interface FundTransfer {
    id: number
    amount: string
    transfer_date: string
    payment_method: string
    description: string
    status: 'completed' | 'cancelled'
    bank_account?: BankAccount
    technician?: Technician
    creator?: { id: number; name: string }
    created_at: string
}

interface TransferSummary {
    month_total: number
    total_all: number
    by_technician: Array<{
        to_user_id: number
        total: string
        technician?: Technician
    }>
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    completed: { label: 'Concluída', color: 'bg-emerald-50 text-emerald-700' },
    cancelled: { label: 'Cancelada', color: 'bg-red-50 text-red-700' },
}

const PAYMENT_METHODS: Record<string, string> = {
    pix: 'PIX', ted: 'TED', doc: 'DOC', dinheiro: 'Dinheiro', transferencia: 'Transferência',
}

const emptyForm = {
    bank_account_id: '', to_user_id: '', amount: '', transfer_date: '', payment_method: 'pix', description: '',
}

export function FundTransfersPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')
    const canCreate = isSuperAdmin || hasPermission('financial.fund_transfer.create')
    const canCancel = isSuperAdmin || hasPermission('financial.fund_transfer.cancel')

    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [cancelTarget, setCancelTarget] = useState<FundTransfer | null>(null)
    const [page, setPage] = useState(1)
    const [filters, setFilters] = useState({
        search: '', to_user_id: '', bank_account_id: '', status: '', date_from: '', date_to: '',
    })

    const { data: transfersRes, isLoading } = useQuery({
        queryKey: ['fund-transfers', page, filters],
        queryFn: () => api.get('/fund-transfers', {
            params: {
                page,
                ...(filters.search ? { search: filters.search } : {}),
                ...(filters.to_user_id ? { to_user_id: filters.to_user_id } : {}),
                ...(filters.bank_account_id ? { bank_account_id: filters.bank_account_id } : {}),
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.date_from ? { date_from: filters.date_from } : {}),
                ...(filters.date_to ? { date_to: filters.date_to } : {}),
            },
        }),
    })

    const { data: summaryRes } = useQuery({
        queryKey: ['fund-transfers-summary'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/fund-transfers/summary'),
    })

    const { data: accountsRes } = useQuery({
        queryKey: ['bank-accounts-active'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/bank-accounts', { params: { is_active: true } }),
    })

    const { data: techsRes } = useQuery({
        queryKey: ['technicians-options'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/technicians/options'),
    })

    const transfers: FundTransfer[] = transfersRes?.data?.data ?? []
    const pagination = transfersRes?.data
    const summary: TransferSummary | undefined = summaryRes?.data
    const bankAccounts: BankAccount[] = accountsRes?.data ?? []
    const technicians: Technician[] = techsRes?.data ?? []

    const createMut = useMutation({
        mutationFn: (data: typeof emptyForm) => api.post('/fund-transfers', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['fund-transfers'] })
            qc.invalidateQueries({ queryKey: ['fund-transfers-summary'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-funds'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-summary'] })
            qc.invalidateQueries({ queryKey: ['accounts-payable'] })
            setShowModal(false)
            toast.success('Transferência realizada com sucesso')
        },
        onError: (err: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
            const errors = err?.response?.data?.errors
            if (errors) {
                const firstError = Object.values(errors).flat()[0]
                toast.error(firstError)
            } else {
                toast.error(err?.response?.data?.message ?? 'Erro ao criar transferência')
            }
        },
    })

    const cancelMut = useMutation({
        mutationFn: (id: number) => api.post(`/fund-transfers/${id}/cancel`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['fund-transfers'] })
            qc.invalidateQueries({ queryKey: ['fund-transfers-summary'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-funds'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-summary'] })
            qc.invalidateQueries({ queryKey: ['accounts-payable'] })
            setCancelTarget(null)
            toast.success('Transferência cancelada com sucesso')
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao cancelar transferência')
        },
    })

    const openCreate = () => {
        setForm({
            ...emptyForm,
            transfer_date: new Date().toISOString().split('T')[0],
        })
        setShowModal(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        createMut.mutate(form)
    }

    const formatBRL = (v: string | number) =>
        parseFloat(String(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Transferências p/ Técnicos</h1>
                    <p className="text-[13px] text-surface-500">Transferências de verba empresa → caixa do técnico</p>
                </div>
                {canCreate && (
                    <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>Nova Transferência</Button>
                )}
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid gap-4 sm:grid-cols-3">
                    {[
                        { label: 'Total do Mês', value: formatBRL(summary.month_total), icon: ArrowRightLeft, color: 'text-brand-600 bg-brand-50' },
                        { label: 'Total Geral', value: formatBRL(summary.total_all), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
                        { label: 'Técnicos (Mês)', value: summary.by_technician.length, icon: Users, color: 'text-sky-600 bg-sky-50' },
                    ].map(s => (
                        <div key={s.label} className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-lg p-2.5 ${s.color}`}><s.icon className="h-5 w-5" /></div>
                                <div>
                                    <p className="text-xs text-surface-500">{s.label}</p>
                                    <p className="text-[15px] font-semibold tabular-nums text-surface-900">{s.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input type="text" placeholder="Buscar..."
                        value={filters.search}
                        onChange={e => { setFilters(p => ({ ...p, search: e.target.value })); setPage(1); }}
                        className="w-full rounded-lg border border-default bg-surface-50 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
                <select value={filters.status}
                    onChange={e => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1); }}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
                    <option value="">Todos os status</option>
                    <option value="completed">Concluída</option>
                    <option value="cancelled">Cancelada</option>
                </select>
                <input type="date" value={filters.date_from}
                    onChange={e => { setFilters(p => ({ ...p, date_from: e.target.value })); setPage(1); }}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
                <input type="date" value={filters.date_to}
                    onChange={e => { setFilters(p => ({ ...p, date_to: e.target.value })); setPage(1); }}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                {isLoading ? (
                    <div className="py-12 text-center text-sm text-surface-400">Carregando...</div>
                ) : transfers.length === 0 ? (
                    <div className="py-12 text-center">
                        <Wallet className="mx-auto h-10 w-10 text-surface-300" />
                        <p className="mt-2 text-sm text-surface-400">Nenhuma transferência encontrada</p>
                        {canCreate && (
                            <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                                Realizar primeira transferência
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50/50">
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Data</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Técnico</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Conta Origem</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Método</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Descrição</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-600">Valor</th>
                                    <th className="px-4 py-3 text-center font-medium text-surface-600">Status</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-600">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {transfers.map(tx => {
                                    const st = STATUS_LABELS[tx.status]
                                    return (
                                        <tr key={tx.id} className="hover:bg-surface-50/50 transition-colors">
                                            <td className="px-4 py-3 text-surface-700 tabular-nums">
                                                {new Date(tx.transfer_date).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-surface-800">
                                                {tx.technician?.name ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-surface-600">
                                                {tx.bank_account ? `${tx.bank_account.name}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-surface-600">
                                                {PAYMENT_METHODS[tx.payment_method] ?? tx.payment_method}
                                            </td>
                                            <td className="px-4 py-3 text-surface-600 max-w-[200px] truncate" title={tx.description}>
                                                {tx.description}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-800">
                                                {formatBRL(tx.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st?.color ?? ''}`}>
                                                    {st?.label ?? tx.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {canCancel && tx.status === 'completed' && (
                                                    <button onClick={() => setCancelTarget(tx)}
                                                        className="rounded-md p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        title="Cancelar transferência">
                                                        <Ban className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.last_page > 1 && (
                    <div className="border-t border-subtle px-5 py-3 flex items-center justify-between">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                            Anterior
                        </Button>
                        <span className="text-xs text-surface-500">
                            Página {pagination.current_page} de {pagination.last_page}
                        </span>
                        <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage(p => p + 1)}>
                            Próxima
                        </Button>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal open={showModal} onOpenChange={setShowModal} title="Nova Transferência" size="md">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Conta Bancária *</label>
                            <select value={form.bank_account_id} required
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, bank_account_id: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">— Selecionar —</option>
                                {bankAccounts.map(ba => (
                                    <option key={ba.id} value={ba.id}>{ba.name} ({ba.bank_name})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Técnico Destino *</label>
                            <select value={form.to_user_id} required
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, to_user_id: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">— Selecionar —</option>
                                {technicians.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="Valor (R$) *" type="number" step="0.01" min="0.01" value={form.amount} required
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, amount: e.target.value }))} />
                        <Input label="Data *" type="date" value={form.transfer_date} required
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, transfer_date: e.target.value }))} />
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Método *</label>
                            <select value={form.payment_method} required
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, payment_method: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <Input label="Descrição *" value={form.description} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Ex: Verba operacional janeiro" />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={createMut.isPending}>Confirmar Transferência</Button>
                    </div>
                </form>
            </Modal>

            {/* Cancel Confirm */}
            <Modal open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)} title="Cancelar Transferência" size="sm">
                <p className="text-sm text-surface-600">
                    Tem certeza que deseja cancelar esta transferência de{' '}
                    <strong>{cancelTarget && formatBRL(cancelTarget.amount)}</strong> para{' '}
                    <strong>{cancelTarget?.technician?.name}</strong>?
                </p>
                <p className="mt-2 text-xs text-surface-400">
                    O saldo será revertido do caixa do técnico e a conta a pagar será cancelada.
                </p>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" type="button" onClick={() => setCancelTarget(null)}>Voltar</Button>
                    <Button className="bg-red-600 hover:bg-red-700" loading={cancelMut.isPending}
                        onClick={() => cancelTarget && cancelMut.mutate(cancelTarget.id)}>
                        Cancelar Transferência
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
