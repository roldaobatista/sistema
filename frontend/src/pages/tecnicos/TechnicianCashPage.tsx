import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
    User, Search, Calendar, Plus, Minus,
} from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

export function TechnicianCashPage() {
    const qc = useQueryClient()
    const [selectedTech, setSelectedTech] = useState<number | null>(null)
    const [showCreditModal, setShowCreditModal] = useState(false)
    const [showDebitModal, setShowDebitModal] = useState(false)
    const [txForm, setTxForm] = useState({ user_id: '', amount: '', description: '' })

    const { data: summaryRes } = useQuery({
        queryKey: ['tech-cash-summary'],
        queryFn: () => api.get('/technician-cash-summary'),
    })

    const { data: fundsRes } = useQuery({
        queryKey: ['tech-cash-funds'],
        queryFn: () => api.get('/technician-cash'),
    })

    const { data: detailRes, isLoading: detailLoading } = useQuery({
        queryKey: ['tech-cash-detail', selectedTech],
        queryFn: () => api.get(`/technician-cash/${selectedTech}`),
        enabled: !!selectedTech,
    })

    const creditMut = useMutation({
        mutationFn: (data: any) => api.post('/technician-cash/credit', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tech-cash-funds'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-summary'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-detail'] })
            setShowCreditModal(false)
        },
    })

    const debitMut = useMutation({
        mutationFn: (data: any) => api.post('/technician-cash/debit', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tech-cash-funds'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-summary'] })
            qc.invalidateQueries({ queryKey: ['tech-cash-detail'] })
            setShowDebitModal(false)
        },
    })

    const summary = summaryRes?.data
    const funds: any[] = fundsRes?.data ?? []
    const detail = detailRes?.data
    const transactions = detail?.transactions?.data ?? []

    const formatBRL = (v: string | number) =>
        parseFloat(String(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const openCreditModal = (userId?: number) => {
        setTxForm({ user_id: userId ? String(userId) : '', amount: '', description: '' })
        setShowCreditModal(true)
    }

    const openDebitModal = (userId?: number) => {
        setTxForm({ user_id: userId ? String(userId) : '', amount: '', description: '' })
        setShowDebitModal(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Caixa do Técnico</h1>
                    <p className="text-sm text-surface-500">Controle de verba rotativa por técnico</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openCreditModal()} icon={<Plus className="h-4 w-4" />}>Crédito</Button>
                    <Button variant="outline" onClick={() => openDebitModal()} icon={<Minus className="h-4 w-4" />}>Débito</Button>
                </div>
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
                        <div key={s.label} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-lg p-2.5 ${s.color}`}><s.icon className="h-5 w-5" /></div>
                                <div>
                                    <p className="text-xs text-surface-500">{s.label}</p>
                                    <p className="text-lg font-bold text-surface-900">{s.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Fundos (lista) */}
                <div className="rounded-xl border border-surface-200 bg-white shadow-card">
                    <div className="border-b border-surface-200 px-5 py-3">
                        <h3 className="text-sm font-semibold text-surface-900">Saldos por Técnico</h3>
                    </div>
                    <div className="divide-y divide-surface-100">
                        {funds.length === 0 ? (
                            <p className="py-8 text-center text-sm text-surface-400">Nenhum fundo cadastrado</p>
                        ) : funds.map((f: any) => (
                            <button key={f.id} onClick={() => setSelectedTech(f.user_id)}
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
                <div className="lg:col-span-2 rounded-xl border border-surface-200 bg-white shadow-card">
                    <div className="border-b border-surface-200 px-5 py-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-surface-900">
                            {selectedTech ? `Extrato — ${detail?.fund?.technician?.name ?? ''}` : 'Selecione um técnico'}
                        </h3>
                        {selectedTech && detail?.fund && (
                            <div className="flex gap-1.5">
                                <Button variant="ghost" size="sm" onClick={() => openCreditModal(selectedTech)}
                                    icon={<ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />}>Crédito</Button>
                                <Button variant="ghost" size="sm" onClick={() => openDebitModal(selectedTech)}
                                    icon={<ArrowDownCircle className="h-3.5 w-3.5 text-red-600" />}>Débito</Button>
                            </div>
                        )}
                    </div>
                    <div className="divide-y divide-surface-100">
                        {!selectedTech ? (
                            <div className="py-16 text-center">
                                <Wallet className="mx-auto h-10 w-10 text-surface-300" />
                                <p className="mt-2 text-sm text-surface-400">Clique em um técnico para ver o extrato</p>
                            </div>
                        ) : detailLoading ? (
                            <p className="py-8 text-center text-sm text-surface-400">Carregando...</p>
                        ) : transactions.length === 0 ? (
                            <p className="py-8 text-center text-sm text-surface-400">Nenhuma movimentação</p>
                        ) : transactions.map((tx: any) => (
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
                                        {tx.work_order && <span>· OS {tx.work_order.number}</span>}
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
                </div>
            </div>

            {/* Credit Modal */}
            <Modal open={showCreditModal} onOpenChange={setShowCreditModal} title="Adicionar Crédito" size="sm">
                <form onSubmit={e => { e.preventDefault(); creditMut.mutate(txForm) }} className="space-y-4">
                    {!txForm.user_id && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Técnico</label>
                            <select value={txForm.user_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTxForm(p => ({ ...p, user_id: e.target.value }))} required
                                className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">— Selecionar —</option>
                                {funds.map((f: any) => <option key={f.user_id} value={f.user_id}>{f.technician?.name}</option>)}
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
            <Modal open={showDebitModal} onOpenChange={setShowDebitModal} title="Lançar Débito" size="sm">
                <form onSubmit={e => { e.preventDefault(); debitMut.mutate(txForm) }} className="space-y-4">
                    {!txForm.user_id && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Técnico</label>
                            <select value={txForm.user_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTxForm(p => ({ ...p, user_id: e.target.value }))} required
                                className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">— Selecionar —</option>
                                {funds.map((f: any) => <option key={f.user_id} value={f.user_id}>{f.technician?.name}</option>)}
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
