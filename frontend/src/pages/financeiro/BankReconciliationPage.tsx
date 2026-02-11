import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, Check, X, Link2, Eye, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const fmtBRL = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

export function BankReconciliationPage() {
    const qc = useQueryClient()
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [matchModal, setMatchModal] = useState<any>(null)

    // ─── Dados ────────────────────────────────────────────
    const { data: statementsRes, isLoading } = useQuery({
        queryKey: ['bank-statements'],
        queryFn: () => api.get('/bank-reconciliation/statements'),
    })
    const statements = statementsRes?.data?.data ?? []

    const { data: entriesRes } = useQuery({
        queryKey: ['bank-entries', expandedId],
        queryFn: () => api.get(`/bank-reconciliation/statements/${expandedId}/entries`),
        enabled: !!expandedId,
    })
    const entries = entriesRes?.data?.data ?? []

    // ─── Mutations ────────────────────────────────────────
    const importMut = useMutation({
        mutationFn: (file: File) => {
            const fd = new FormData()
            fd.append('file', file)
            return api.post('/bank-reconciliation/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-statements'] }) },
    })

    const matchMut = useMutation({
        mutationFn: ({ entryId, matchedType, matchedId }: any) =>
            api.post(`/bank-reconciliation/entries/${entryId}/match`, { matched_type: matchedType, matched_id: matchedId }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bank-entries'] })
            setMatchModal(null)
        },
    })

    const ignoreMut = useMutation({
        mutationFn: (entryId: number) => api.post(`/bank-reconciliation/entries/${entryId}/ignore`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-entries'] }) },
    })

    const handleUpload = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.ofx,.txt'
        input.onchange = (e: any) => {
            const file = e.target.files?.[0]
            if (file) importMut.mutate(file)
        }
        input.click()
    }

    const statusBadge = (s: string) => {
        const map: Record<string, { bg: string; text: string; label: string }> = {
            pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pendente' },
            matched: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Conciliado' },
            ignored: { bg: 'bg-surface-100', text: 'text-surface-500', label: 'Ignorado' },
        }
        const cfg = map[s] ?? map.pending
        return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cfg.bg, cfg.text)}>{cfg.label}</span>
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Conciliação Bancária</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Importe extratos OFX e concilie com contas a receber/pagar</p>
                </div>
                <button onClick={handleUpload} disabled={importMut.isPending}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-600 transition-colors disabled:opacity-50">
                    <Upload className="h-4 w-4" />
                    {importMut.isPending ? 'Importando...' : 'Importar OFX'}
                </button>
            </div>

            {/* Lista de Extratos */}
            <div className="space-y-3">
                {isLoading && <p className="text-sm text-surface-400 text-center py-8">Carregando extratos...</p>}
                {!isLoading && statements.length === 0 && (
                    <div className="rounded-xl border border-dashed border-default bg-surface-50 p-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-surface-300" />
                        <p className="mt-3 text-[13px] text-surface-500">Nenhum extrato importado</p>
                        <p className="text-xs text-surface-400">Importe um arquivo OFX para começar a conciliação</p>
                    </div>
                )}
                {(statements as any[]).map((st: any) => (
                    <div key={st.id} className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                        <button onClick={() => setExpandedId(expandedId === st.id ? null : st.id)}
                            className="flex w-full items-center justify-between p-4 hover:bg-surface-50 transition-colors duration-100">
                            <div className="flex items-center gap-3">
                                {expandedId === st.id ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
                                <FileText className="h-5 w-5 text-brand-500" />
                                <div className="text-left">
                                    <p className="text-sm font-semibold text-surface-900">Extrato #{st.id}</p>
                                    <p className="text-xs text-surface-500">{fmtDate(st.created_at)} • {st.creator?.name ?? 'Sistema'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-surface-500">{st.entries_count ?? '?'} lançamentos</p>
                            </div>
                        </button>

                        {expandedId === st.id && (
                            <div className="border-t border-surface-100 p-4">
                                {entries.length === 0 ? (
                                    <p className="text-sm text-surface-400 text-center py-4">Carregando lançamentos...</p>
                                ) : (
                                    <div className="space-y-2">
                                        {(entries as any[]).map((entry: any) => (
                                            <div key={entry.id} className="flex items-center justify-between rounded-lg border border-surface-100 p-3 hover:bg-surface-50">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {Number(entry.amount) >= 0
                                                        ? <ArrowUpRight className="h-4 w-4 text-emerald-500 shrink-0" />
                                                        : <ArrowDownRight className="h-4 w-4 text-red-500 shrink-0" />
                                                    }
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-medium text-surface-900 truncate">{entry.description}</p>
                                                        <p className="text-xs text-surface-500">{fmtDate(entry.date)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={cn('text-sm font-bold', Number(entry.amount) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                                        {fmtBRL(entry.amount)}
                                                    </span>
                                                    {statusBadge(entry.status)}
                                                    {entry.status === 'pending' && (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => setMatchModal(entry)} title="Conciliar"
                                                                className="rounded-lg border border-surface-200 p-1.5 hover:bg-brand-50 hover:border-brand-300 transition-colors">
                                                                <Link2 className="h-3.5 w-3.5 text-brand-600" />
                                                            </button>
                                                            <button onClick={() => ignoreMut.mutate(entry.id)} title="Ignorar"
                                                                className="rounded-lg border border-surface-200 p-1.5 hover:bg-red-50 hover:border-red-300 transition-colors">
                                                                <X className="h-3.5 w-3.5 text-red-500" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal de conciliação manual */}
            {matchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setMatchModal(null)}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-[15px] font-semibold tabular-nums text-surface-900">Conciliar Lançamento</h3>
                        <p className="mt-0.5 text-[13px] text-surface-500">{matchModal.description} — {fmtBRL(matchModal.amount)}</p>
                        <form onSubmit={e => {
                            e.preventDefault()
                            const fd = new FormData(e.currentTarget)
                            matchMut.mutate({ entryId: matchModal.id, matchedType: fd.get('type'), matchedId: fd.get('id') })
                        }} className="mt-4 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-surface-700">Tipo</label>
                                <select name="type" required className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                    <option value="AccountReceivable">Conta a Receber</option>
                                    <option value="AccountPayable">Conta a Pagar</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-surface-700">ID do Título</label>
                                <input name="id" type="number" required className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setMatchModal(null)} className="flex-1 rounded-xl border border-surface-300 px-4 py-2 text-sm font-medium">Cancelar</button>
                                <button type="submit" disabled={matchMut.isPending} className="flex-1 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                                    {matchMut.isPending ? 'Conciliando...' : 'Conciliar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
