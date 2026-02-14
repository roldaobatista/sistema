import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
    User, Plus, Minus,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

interface Technician {
    id: number
    name: string
}

interface Expense {
    id: number
    description: string
}

interface WorkOrder {
    id: number
    number: string
    os_number?: string | null
}

interface Fund {
    id: number
    user_id: number
    technician?: Technician
    balance: string
}

interface Transaction {
    id: number
    type: 'credit' | 'debit'
    amount: string
    balance_after: string
    description: string
    transaction_date: string
    work_order?: WorkOrder | null
    expense?: Expense | null
    creator?: { name: string } | null
}

interface DetailResponse {
    fund: Fund
    transactions: {
        data: Transaction[]
        current_page: number
        last_page: number
    }
}

interface CreditPayload {
    user_id: number
    amount: number
    description: string
}

interface DebitPayload {
    user_id: number
    amount: number
    description: string
}

const woIdentifier = (wo?: WorkOrder | null) =>
    wo?.os_number ?? wo?.number ?? '—'

export function TechnicianCashPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canManageCash = hasRole('super_admin') || hasPermission('technicians.cashbox.manage')
    const [selectedTech, setSelectedTech] = useState<number | null>(null)
    const [showCreditModal, setShowCreditModal] = useState(false)
    const [showDebitModal, setShowDebitModal] = useState(false)
    const [txForm, setTxForm] = useState({ user_id: '', amount: '', description: '' })

    const [page, setPage] = useState(1)
    const [filters, setFilters] = useState({ date_from: '', date_to: '' })

    const { data: summaryRes } = useQuery({
        queryKey: ['tech-cash-summary'],
        queryFn: () => api.get('/technician-cash-summary'),
    })

    const { data: fundsRes } = useQuery({
        queryKey: ['tech-cash-funds'],
        queryFn: () => api.get('/technician-cash'),
    })

    const { data: detailRes, isLoading: detailLoading } = useQuery({
        queryKey: ['tech-cash-detail', selectedTech, page, filters],
        queryFn: () => api.get(`/technician-cash/${selectedTech}`, {
            params: { page, ...filters }
        }),
        enabled: !!selectedTech,
    })

    const creditMut = useMutation({
        mutationFn: (data: CreditPayload) => api.post('/technician-cash/credit', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tech-cash-funds'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-summary'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-detail'] })
            setShowCreditModal(false)
            toast.success('Crédito adicionado com sucesso')
        },
        onError: (err: { response?: { data?: { message?: string } } }) => { toast.error(err?.response?.data?.message ?? 'Erro ao adicionar crédito') },
    })

    const debitMut = useMutation({
        mutationFn: (data: DebitPayload) => api.post('/technician-cash/debit', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tech-cash-funds'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-summary'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-detail'] })
            setShowDebitModal(false)
            toast.success('Débito registrado com sucesso')
        },
        onError: (err: { response?: { data?: { message?: string } } }) => { toast.error(err?.response?.data?.message ?? 'Erro ao lançar débito') },
    })

    const { data: techsRes } = useQuery({
        queryKey: ['technicians-cash'],
        queryFn: () => api.get('/technicians/options'),
    })
    const allTechnicians: Technician[] = techsRes?.data ?? []

    const summary = summaryRes?.data
    const funds: Fund[] = fundsRes?.data ?? []
    const detail: DetailResponse | undefined = detailRes?.data
    const transactions: Transaction[] = detail?.transactions?.data ?? []

    // Para os selects dos modais: usa fundos existentes + técnicos sem fundo
    const techOptions = allTechnicians.map(t => ({
        user_id: t.id,
        name: t.name,
    }))

    const formatBRL = (v: string | number) =>
        parseFloat(String(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const openCreditModal = (userId?: number) => {
        if (!canManageCash) return
        setTxForm({ user_id: userId ? String(userId) : '', amount: '', description: '' })
        setShowCreditModal(true)
    }

    const openDebitModal = (userId?: number) => {
        if (!canManageCash) return
        setTxForm({ user_id: userId ? String(userId) : '', amount: '', description: '' })
        setShowDebitModal(true)
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Caixa do Técnico</h1>
                    <p className="text-[13px] text-surface-500">Controle de verba rotativa por técnico</p>
                </div>
                {canManageCash && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => openCreditModal()} icon={<Plus className="h-4 w-4" />}>Crédito</Button>
                        <Button variant="outline" onClick={() => openDebitModal()} icon={<Minus className="h-4 w-4" />}>Débito</Button>
                    </div>
                )}
            </div>

            {/* Stats */}
            {summary && (
                <div className="grid gap-4 sm:grid-cols-4">
                    {[
                        { label: 'Saldo Total', value: formatBRL(summary.total_balance), icon: Wallet, color: 'text-brand-600 bg-brand-50' },
                        { label: 'Créditos (Mês)', value: formatBRL(summary.month_credits), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
                        { label: 'Débitos (Mês)', value: formatBRL(summary.month_debits), icon: TrendingDown, color: 'text-red-600 bg-red-50' },
                        { label: 'Técnicos', value: summary.funds_count, icon: User, color: 'text-sky-600 bg-sky-50' },
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

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Fundos (lista) */}
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="border-b border-subtle px-5 py-3">
                        <h3 className="text-sm font-semibold text-surface-900">Saldos por Técnico</h3>
                    </div>
                    <div className="divide-y divide-subtle">
                        {funds.length === 0 ? (
                            <p className="py-8 text-center text-sm text-surface-400">Nenhum fundo cadastrado</p>
                        ) : funds.map((f) => (
                            <button key={f.id} onClick={() => { setSelectedTech(f.user_id); setPage(1); }}
                                className={`flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-surface-50 ${selectedTech === f.user_id ? 'bg-brand-50/50' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-100">
                                        <User className="h-4 w-4 text-surface-500" />
                                    </div>
                                    <span className="text-sm font-medium text-surface-800">{f.technician?.name}</span>
                                </div>
                                <span className={`text-sm font-bold ${parseFloat(f.balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatBRL(f.balance)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Extrato */}
                <div className="lg:col-span-2 rounded-xl border border-default bg-surface-0 shadow-card flex flex-col">
                    <div className="border-b border-subtle px-5 py-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-surface-900">
                            {selectedTech ? `Extrato — ${detail?.fund?.technician?.name ?? ''}` : 'Selecione um técnico'}
                        </h3>
                        {selectedTech && detail?.fund && (
                            <div className="flex gap-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        className="h-7 rounded-md border border-default bg-surface-50 px-2 text-xs text-surface-700 focus:border-brand-500 focus:outline-none"
                                        value={filters.date_from}
                                        onChange={e => { setFilters(p => ({ ...p, date_from: e.target.value })); setPage(1); }}
                                    />
                                    <span className="text-xs text-surface-400">até</span>
                                    <input
                                        type="date"
                                        className="h-7 rounded-md border border-default bg-surface-50 px-2 text-xs text-surface-700 focus:border-brand-500 focus:outline-none"
                                        value={filters.date_to}
                                        onChange={e => { setFilters(p => ({ ...p, date_to: e.target.value })); setPage(1); }}
                                    />
                                </div>
                                {canManageCash && (
                                    <>
                                        <div className="h-4 w-px bg-default mx-1" />
                                        <div className="flex gap-1.5">
                                            <Button variant="ghost" size="sm" onClick={() => openCreditModal(selectedTech)}
                                                icon={<ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />}>Crédito</Button>
                                            <Button variant="ghost" size="sm" onClick={() => openDebitModal(selectedTech)}
                                                icon={<ArrowDownCircle className="h-3.5 w-3.5 text-red-600" />}>Débito</Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="divide-y divide-subtle flex-1">
                        {!selectedTech ? (
                            <div className="py-16 text-center">
                                <Wallet className="mx-auto h-10 w-10 text-surface-300" />
                                <p className="mt-2 text-sm text-surface-400">Clique em um técnico para ver o extrato</p>
                            </div>
                        ) : detailLoading ? (
                            <p className="py-8 text-center text-sm text-surface-400">Carregando...</p>
                        ) : transactions.length === 0 ? (
                            <p className="py-8 text-center text-sm text-surface-400">Nenhuma movimentação no período</p>
                        ) : transactions.map((tx) => (
                            <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                                <div className={`rounded-full p-1.5 ${tx.type === 'credit' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                    {tx.type === 'credit'
                                        ? <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                                        : <ArrowDownCircle className="h-4 w-4 text-red-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-surface-800 truncate">{tx.description}</p>
                                    <div className="flex items-center gap-2 text-xs text-surface-400">
                                        <span>{new Date(tx.transaction_date).toLocaleDateString('pt-BR')}</span>
                                        {tx.work_order && <span>· OS {woIdentifier(tx.work_order)}</span>}
                                        {tx.expense && <span>· Desp. {tx.expense.description}</span>}
                                        {tx.creator && <span>· {tx.creator.name}</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}{formatBRL(tx.amount)}
                                    </p>
                                    <p className="text-[10px] text-surface-400">Saldo: {formatBRL(tx.balance_after)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedTech && detail?.transactions && detail.transactions.last_page > 1 && (
                        <div className="border-t border-subtle px-5 py-3 flex items-center justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Anterior
                            </Button>
                            <span className="text-xs text-surface-500">
                                Página {detail.transactions.current_page} de {detail.transactions.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= detail.transactions.last_page}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Próxima
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Credit Modal */}
            <Modal open={showCreditModal && canManageCash} onOpenChange={setShowCreditModal} title="Adicionar Crédito" size="sm">
                <form onSubmit={e => { e.preventDefault(); creditMut.mutate({ ...txForm, user_id: Number(txForm.user_id), amount: Number(txForm.amount) }) }} className="space-y-4">
                    {!txForm.user_id && (
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Técnico</label>
                            <select value={txForm.user_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTxForm(p => ({ ...p, user_id: e.target.value }))} required
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">— Selecionar —</option>
                                {techOptions.map((t) => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    <Input label="Valor (R$)" type="number" step="0.01" min="0.01" value={txForm.amount} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTxForm(p => ({ ...p, amount: e.target.value }))} />
                    <Input label="Descrição" value={txForm.description} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTxForm(p => ({ ...p, description: e.target.value }))} />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => setShowCreditModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={creditMut.isPending}>Confirmar Crédito</Button>
                    </div>
                </form>
            </Modal>

            {/* Debit Modal */}
            <Modal open={showDebitModal && canManageCash} onOpenChange={setShowDebitModal} title="Lançar Débito" size="sm">
                <form onSubmit={e => { e.preventDefault(); debitMut.mutate({ ...txForm, user_id: Number(txForm.user_id), amount: Number(txForm.amount) }) }} className="space-y-4">
                    {!txForm.user_id && (
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Técnico</label>
                            <select value={txForm.user_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTxForm(p => ({ ...p, user_id: e.target.value }))} required
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">— Selecionar —</option>
                                {techOptions.map((t) => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    <Input label="Valor (R$)" type="number" step="0.01" min="0.01" value={txForm.amount} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTxForm(p => ({ ...p, amount: e.target.value }))} />
                    <Input label="Descrição" value={txForm.description} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTxForm(p => ({ ...p, description: e.target.value }))} />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => setShowDebitModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={debitMut.isPending} className="bg-red-600 hover:bg-red-700">Confirmar Débito</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

