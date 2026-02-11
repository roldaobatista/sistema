import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Plus, Search, FileText, Send, CheckCircle, XCircle, Copy, ArrowRight,
    Calendar, DollarSign, TrendingUp, Clock, ChevronLeft, ChevronRight
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { QUOTE_STATUS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Quote, QuoteSummary } from '@/types/quote'
import { QUOTE_STATUS_CONFIG } from '@/features/quotes/constants'

export function QuotesListPage() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [searchParams, setSearchParams] = useSearchParams()

    // State derived from URL or defaults
    const page = Number(searchParams.get('page')) || 1
    const search = searchParams.get('search') || ''
    const statusFilter = searchParams.get('status') || ''

    const updateParams = (updates: Record<string, string | number | undefined>) => {
        const newParams = new URLSearchParams(searchParams)
        Object.entries(updates).forEach(([key, value]) => {
            if (value === undefined || value === '') {
                newParams.delete(key)
            } else {
                newParams.set(key, String(value))
            }
        })
        setSearchParams(newParams)
    }

    const { data: summaryRes } = useQuery({
        queryKey: ['quotes-summary'],
        queryFn: () => api.get<QuoteSummary>('/quotes-summary'),
    })
    const summary = summaryRes?.data ?? {} as QuoteSummary

    const { data: quotesRes, isLoading } = useQuery({
        queryKey: ['quotes', page, search, statusFilter],
        queryFn: () => api.get('/quotes', {
            params: {
                page,
                search: search || undefined,
                status: statusFilter || undefined,
                per_page: 20
            }
        }),
    })

    const quotes = (quotesRes?.data?.data as Quote[]) ?? []
    const meta = quotesRes?.data?.meta
    const totalPages = meta?.last_page || 1

    const sendMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/send`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quotes-summary'] }) },
    })
    const approveMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/approve`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quotes-summary'] }) },
    })
    const duplicateMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/duplicate`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quotes-summary'] }) },
    })
    const convertMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/convert-to-os`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quotes-summary'] }) },
    })

    const stats = [
        { label: 'Rascunhos', value: summary.draft ?? 0, icon: FileText, color: 'text-surface-600' },
        { label: 'Enviados', value: summary.sent ?? 0, icon: Send, color: 'text-blue-600' },
        { label: 'Aprovados', value: summary.approved ?? 0, icon: CheckCircle, color: 'text-emerald-600' },
        { label: 'Taxa Conversão', value: `${summary.conversion_rate ?? 0}%`, icon: TrendingUp, color: 'text-brand-600' },
    ]

    const handleSearch = (val: string) => {
        updateParams({ search: val, page: 1 })
    }

    const handleStatusFilter = (val: string) => {
        updateParams({ status: val, page: 1 })
    }

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            updateParams({ page: newPage })
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Orçamentos</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Gerencie e acompanhe seus orçamentos</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/orcamentos/novo')}>Novo Orçamento</Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
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
                    <input
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Buscar por número ou cliente..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2 pl-10 pr-3 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilter(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                    <option value="">Todos os status</option>
                    {Object.entries(QUOTE_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-subtle bg-surface-50">
                                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Número</th>
                                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Cliente</th>
                                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Vendedor</th>
                                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Validade</th>
                                <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                                <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {isLoading ? (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                            ) : quotes.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhum orçamento encontrado</td></tr>
                            ) : quotes.map((q) => {
                                const sc = QUOTE_STATUS_CONFIG[q.status] ?? QUOTE_STATUS_CONFIG.draft
                                return (
                                    <tr key={q.id} className="hover:bg-surface-50 transition-colors duration-100 cursor-pointer" onClick={() => navigate(`/orcamentos/${q.id}`)}>
                                        <td className="px-4 py-3 text-sm font-mono font-semibold text-brand-700">{q.quote_number}</td>
                                        <td className="px-4 py-3 text-sm text-surface-900">{q.customer?.name}</td>
                                        <td className="px-4 py-3 text-[13px] text-surface-600">{q.seller?.name}</td>
                                        <td className="px-4 py-3"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                                        <td className="px-4 py-3 text-[13px] text-surface-500">{q.valid_until ? new Date(q.valid_until).toLocaleDateString('pt-BR') : '—'}</td>
                                        <td className="px-3.5 py-2.5 text-right text-sm font-semibold text-surface-900">
                                            {Number(q.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1">
                                                {q.status === QUOTE_STATUS.DRAFT && (
                                                    <button onClick={() => sendMut.mutate(q.id)} title="Enviar"
                                                        className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><Send className="h-4 w-4" /></button>
                                                )}
                                                {q.status === QUOTE_STATUS.SENT && (
                                                    <button onClick={() => approveMut.mutate(q.id)} title="Aprovar"
                                                        className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle className="h-4 w-4" /></button>
                                                )}
                                                {q.status === QUOTE_STATUS.APPROVED && (
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

                {/* Pagination */}
                {meta && totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-subtle bg-surface-50 px-4 py-3">
                        <div className="flex flex-1 justify-between sm:hidden">
                            <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page === 1}>Anterior</Button>
                            <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>Próximo</Button>
                        </div>
                        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs text-surface-500">
                                    Mostrando <span className="font-medium">{meta.from}</span> a <span className="font-medium">{meta.to}</span> de <span className="font-medium">{meta.total}</span> resultados
                                </p>
                            </div>
                            <div className="flex gap-1">
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(page - 1)} disabled={page === 1}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Simple logic to show window around current page could be added here
                                    // For now just showing first 5 or logic can be improved
                                    let p = i + 1;
                                    if (totalPages > 5 && page > 3) {
                                        p = page - 2 + i;
                                        if (p > totalPages) p = totalPages - (4 - i);
                                    }
                                    return (
                                        <Button
                                            key={p}
                                            variant={p === page ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => handlePageChange(p)}
                                        >
                                            {p}
                                        </Button>
                                    );
                                })}
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
