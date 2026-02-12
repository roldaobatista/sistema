import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, FileText, Link2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/auth-store'

type BankStatement = {
    id: number
    filename: string
    created_at: string
    entries_count: number
    total_entries: number
    matched_entries: number
    creator?: { id: number; name: string }
}

type BankEntry = {
    id: number
    date: string
    description: string
    amount: number | string
    type: 'credit' | 'debit'
    status: 'pending' | 'matched' | 'ignored'
    matched_type: string | null
    matched_id: number | null
}

type Paginator<T> = {
    data: T[]
    current_page: number
    last_page: number
    total: number
}

const RECEIVABLE_TYPE = 'App\\Models\\AccountReceivable'
const PAYABLE_TYPE = 'App\\Models\\AccountPayable'

const fmtBRL = (value: number | string) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (date: string) => new Date(date).toLocaleDateString('pt-BR')

export function BankReconciliationPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')
    const canManage = isSuperAdmin || hasPermission('finance.receivable.create')

    const [statementPage, setStatementPage] = useState(1)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [entriesPage, setEntriesPage] = useState(1)
    const [matchModal, setMatchModal] = useState<BankEntry | null>(null)
    const [matchType, setMatchType] = useState<string>(RECEIVABLE_TYPE)
    const [matchId, setMatchId] = useState('')

    const statementsQuery = useQuery({
        queryKey: ['bank-statements', statementPage],
        queryFn: async () => {
            const { data } = await api.get<{ success: boolean; data: Paginator<BankStatement> }>(
                '/bank-reconciliation/statements',
                { params: { page: statementPage } }
            )
            return data.data
        },
    })

    const entriesQuery = useQuery({
        queryKey: ['bank-entries', expandedId, entriesPage],
        queryFn: async () => {
            const { data } = await api.get<{ success: boolean; data: Paginator<BankEntry> }>(
                `/bank-reconciliation/statements/${expandedId}/entries`,
                { params: { page: entriesPage } }
            )
            return data.data
        },
        enabled: !!expandedId,
    })

    const importMut = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData()
            formData.append('file', file)
            await api.post('/bank-reconciliation/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
        },
        onSuccess: () => {
            toast.success('Extrato importado com sucesso')
            qc.invalidateQueries({ queryKey: ['bank-statements'] })
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao importar extrato')
        },
    })

    const matchMut = useMutation({
        mutationFn: async ({ entryId, matchedType, matchedId }: { entryId: number; matchedType: string; matchedId: number }) => {
            await api.post(`/bank-reconciliation/entries/${entryId}/match`, {
                matched_type: matchedType,
                matched_id: matchedId,
            })
        },
        onSuccess: () => {
            toast.success('Lancamento conciliado')
            qc.invalidateQueries({ queryKey: ['bank-entries'] })
            qc.invalidateQueries({ queryKey: ['bank-statements'] })
            setMatchModal(null)
            setMatchId('')
            setMatchType(RECEIVABLE_TYPE)
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao conciliar lancamento')
        },
    })

    const ignoreMut = useMutation({
        mutationFn: async (entryId: number) => {
            await api.post(`/bank-reconciliation/entries/${entryId}/ignore`)
        },
        onSuccess: () => {
            toast.success('Lancamento ignorado')
            qc.invalidateQueries({ queryKey: ['bank-entries'] })
            qc.invalidateQueries({ queryKey: ['bank-statements'] })
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao ignorar lancamento')
        },
    })

    const openMatchModal = (entry: BankEntry) => {
        setMatchModal(entry)
        setMatchType(entry.type === 'credit' ? RECEIVABLE_TYPE : PAYABLE_TYPE)
        setMatchId(entry.matched_id ? String(entry.matched_id) : '')
    }

    const handleUpload = () => {
        if (!canManage) return

        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.ofx,.txt'
        input.onchange = (event: Event) => {
            const target = event.target as HTMLInputElement
            const file = target.files?.[0]
            if (file) {
                importMut.mutate(file)
            }
        }
        input.click()
    }

    const statements = statementsQuery.data?.data ?? []
    const statementsCurrentPage = statementsQuery.data?.current_page ?? 1
    const statementsLastPage = statementsQuery.data?.last_page ?? 1

    const entries = entriesQuery.data?.data ?? []
    const entriesCurrentPage = entriesQuery.data?.current_page ?? 1
    const entriesLastPage = entriesQuery.data?.last_page ?? 1

    const statusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string; label: string }> = {
            pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pendente' },
            matched: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Conciliado' },
            ignored: { bg: 'bg-surface-100', text: 'text-surface-500', label: 'Ignorado' },
        }
        const current = styles[status] ?? styles.pending
        return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', current.bg, current.text)}>{current.label}</span>
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Conciliacao bancaria</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Importe extratos OFX e concilie com contas a receber e pagar</p>
                </div>
                <Button icon={<Upload className="h-4 w-4" />} onClick={handleUpload} disabled={!canManage} loading={importMut.isPending}>
                    Importar OFX
                </Button>
            </div>

            {statementsQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Erro ao carregar extratos bancarios.
                </div>
            ) : null}

            <div className="space-y-3">
                {statementsQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-surface-400">Carregando extratos...</p>
                ) : statements.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-default bg-surface-50 p-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-surface-300" />
                        <p className="mt-3 text-[13px] text-surface-500">Nenhum extrato importado</p>
                        <p className="text-xs text-surface-400">Importe um arquivo OFX para iniciar a conciliacao</p>
                    </div>
                ) : (
                    statements.map((statement) => (
                        <div key={statement.id} className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                            <button
                                onClick={() => {
                                    const nextId = expandedId === statement.id ? null : statement.id
                                    setExpandedId(nextId)
                                    setEntriesPage(1)
                                }}
                                className="flex w-full items-center justify-between p-4 transition-colors duration-100 hover:bg-surface-50"
                            >
                                <div className="flex items-center gap-3">
                                    {expandedId === statement.id ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
                                    <FileText className="h-5 w-5 text-brand-500" />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold text-surface-900">{statement.filename}</p>
                                        <p className="text-xs text-surface-500">{fmtDate(statement.created_at)} - {statement.creator?.name ?? 'Sistema'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-surface-500">{statement.entries_count} lancamentos</p>
                                    <p className="text-xs text-emerald-600">{statement.matched_entries} conciliados</p>
                                </div>
                            </button>

                            {expandedId === statement.id ? (
                                <div className="border-t border-surface-100 p-4">
                                    {entriesQuery.isLoading ? (
                                        <p className="py-4 text-center text-sm text-surface-400">Carregando lancamentos...</p>
                                    ) : entriesQuery.isError ? (
                                        <p className="py-4 text-center text-sm text-red-600">Erro ao carregar lancamentos.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {entries.map((entry) => (
                                                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-surface-100 p-3 hover:bg-surface-50">
                                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                                        {Number(entry.amount) >= 0
                                                            ? <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-500" />
                                                            : <ArrowDownRight className="h-4 w-4 shrink-0 text-red-500" />}
                                                        <div className="min-w-0">
                                                            <p className="truncate text-[13px] font-medium text-surface-900">{entry.description}</p>
                                                            <p className="text-xs text-surface-500">{fmtDate(entry.date)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn('text-sm font-bold', Number(entry.amount) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                                            {fmtBRL(entry.amount)}
                                                        </span>
                                                        {statusBadge(entry.status)}
                                                        {canManage ? (
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => openMatchModal(entry)}
                                                                    title="Conciliar"
                                                                    className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50"
                                                                >
                                                                    <Link2 className="h-3.5 w-3.5 text-brand-600" />
                                                                </button>
                                                                <button
                                                                    onClick={() => ignoreMut.mutate(entry.id)}
                                                                    title="Ignorar"
                                                                    className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-red-300 hover:bg-red-50"
                                                                >
                                                                    <X className="h-3.5 w-3.5 text-red-500" />
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-3 flex items-center justify-end gap-2">
                                        <Button variant="outline" size="sm" disabled={entriesCurrentPage <= 1} onClick={() => setEntriesPage((prev) => Math.max(1, prev - 1))}>
                                            Anterior
                                        </Button>
                                        <span className="text-xs text-surface-500">Pagina {entriesCurrentPage} de {entriesLastPage}</span>
                                        <Button variant="outline" size="sm" disabled={entriesCurrentPage >= entriesLastPage} onClick={() => setEntriesPage((prev) => prev + 1)}>
                                            Proxima
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>

            <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" disabled={statementsCurrentPage <= 1} onClick={() => setStatementPage((prev) => Math.max(1, prev - 1))}>
                    Anterior
                </Button>
                <span className="text-xs text-surface-500">Pagina {statementsCurrentPage} de {statementsLastPage}</span>
                <Button variant="outline" size="sm" disabled={statementsCurrentPage >= statementsLastPage} onClick={() => setStatementPage((prev) => prev + 1)}>
                    Proxima
                </Button>
            </div>

            {matchModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setMatchModal(null)}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <h3 className="text-[15px] font-semibold text-surface-900">Conciliar lancamento</h3>
                        <p className="mt-0.5 text-[13px] text-surface-500">{matchModal.description} - {fmtBRL(matchModal.amount)}</p>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault()
                                const id = Number(matchId)
                                if (!Number.isInteger(id) || id <= 0) {
                                    toast.error('Informe um ID valido para conciliacao')
                                    return
                                }
                                matchMut.mutate({ entryId: matchModal.id, matchedType: matchType, matchedId: id })
                            }}
                            className="mt-4 space-y-3"
                        >
                            <div>
                                <label className="text-xs font-medium text-surface-700">Tipo</label>
                                <select
                                    value={matchType}
                                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setMatchType(event.target.value)}
                                    className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                                >
                                    <option value={RECEIVABLE_TYPE}>Conta a receber</option>
                                    <option value={PAYABLE_TYPE}>Conta a pagar</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-surface-700">ID do titulo</label>
                                <input
                                    value={matchId}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMatchId(event.target.value)}
                                    type="number"
                                    required
                                    className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={() => setMatchModal(null)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" className="flex-1" loading={matchMut.isPending}>
                                    Conciliar
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
