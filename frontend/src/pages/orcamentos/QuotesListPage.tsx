import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Search, FileText, Send, CheckCircle, XCircle, Copy, ArrowRight,
    Calendar, DollarSign, TrendingUp, Clock,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    draft: { label: 'Rascunho', variant: 'default', icon: FileText },
    sent: { label: 'Enviado', variant: 'info', icon: Send },
    approved: { label: 'Aprovado', variant: 'success', icon: CheckCircle },
    rejected: { label: 'Rejeitado', variant: 'danger', icon: XCircle },
    expired: { label: 'Expirado', variant: 'warning', icon: Clock },
    invoiced: { label: 'Faturado', variant: 'info', icon: DollarSign },
}

export function QuotesListPage() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const { data: summaryRes } = useQuery({
        queryKey: ['quotes-summary'],
        queryFn: () => api.get('/quotes-summary'),
    })
    const summary = summaryRes?.data ?? {}

    const { data: quotesRes } = useQuery({
        queryKey: ['quotes', search, statusFilter],
        queryFn: () => api.get('/quotes', { params: { search: search || undefined, status: statusFilter || undefined, per_page: 50 } }),
    })
    const quotes = quotesRes?.data?.data ?? []

    const sendMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/send`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    })
    const approveMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/approve`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    })
    const duplicateMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/duplicate`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    })
    const convertMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/convert-to-os`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    })

    const stats = [
        { label: 'Rascunhos', value: summary.draft ?? 0, icon: FileText, color: 'text-surface-600' },
        { label: 'Enviados', value: summary.sent ?? 0, icon: Send, color: 'text-blue-600' },
        { label: 'Aprovados', value: summary.approved ?? 0, icon: CheckCircle, color: 'text-emerald-600' },
        { label: 'Taxa Conversão', value: `${summary.conversion_rate ?? 0}%`, icon: TrendingUp, color: 'text-brand-600' },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Orçamentos</h1>
                    <p className="mt-1 text-sm text-surface-500">Gerencie e acompanhe seus orçamentos</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/orcamentos/novo')}>Novo Orçamento</Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <div className="flex items-center gap-3">
                                <div className={cn('rounded-lg bg-surface-50 p-2', s.color)}><Icon className="h-5 w-5" /></div>
                                <div>
                                    <p className="text-xs text-surface-500">{s.label}</p>
                                    <p className="text-xl font-bold text-surface-900">{s.value}</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar por número ou cliente..."
                        className="w-full rounded-lg border border-surface-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                </div>
                <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os status</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Número</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Cliente</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Vendedor</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Validade</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {quotes.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum orçamento encontrado</td></tr>
                        ) : quotes.map((q: any) => {
                            const sc = statusConfig[q.status] ?? statusConfig.draft
                            return (
                                <tr key={q.id} className="hover:bg-surface-50 transition-colors cursor-pointer" onClick={() => navigate(`/orcamentos/${q.id}`)}>
                                    <td className="px-4 py-3 text-sm font-mono font-semibold text-brand-700">{q.quote_number}</td>
                                    <td className="px-4 py-3 text-sm text-surface-900">{q.customer?.name}</td>
                                    <td className="px-4 py-3 text-sm text-surface-600">{q.seller?.name}</td>
                                    <td className="px-4 py-3"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                                    <td className="px-4 py-3 text-sm text-surface-500">{q.valid_until ? new Date(q.valid_until).toLocaleDateString('pt-BR') : '—'}</td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-surface-900">
                                        {Number(q.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end gap-1">
                                            {q.status === 'draft' && (
                                                <button onClick={() => sendMut.mutate(q.id)} title="Enviar"
                                                    className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><Send className="h-4 w-4" /></button>
                                            )}
                                            {q.status === 'sent' && (
                                                <button onClick={() => approveMut.mutate(q.id)} title="Aprovar"
                                                    className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle className="h-4 w-4" /></button>
                                            )}
                                            {q.status === 'approved' && (
                                                <button onClick={() => convertMut.mutate(q.id)} title="Converter em OS"
                                                    className="rounded p-1.5 text-brand-600 hover:bg-brand-50"><ArrowRight className="h-4 w-4" /></button>
                                            )}
                                            <button onClick={() => duplicateMut.mutate(q.id)} title="Duplicar"
                                                className="rounded p-1.5 text-surface-500 hover:bg-surface-100"><Copy className="h-4 w-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
