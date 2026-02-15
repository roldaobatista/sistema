import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    Copy,
    Download,
    EyeOff,
    FileText,
    Link2,
    Search,
    Sparkles,
    Trash2,
    Zap,
    Undo2,
    Upload,
    X,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { useAuthStore } from '@/stores/auth-store'

// ─── Types ──────────────────────────────────────────

type BankAccount = {
    id: number
    name: string
    bank_name: string
}

type BankStatement = {
    id: number
    filename: string
    format?: string
    created_at: string
    entries_count: number
    total_entries: number
    matched_entries: number
    bank_account_id?: number | null
    creator?: { id: number; name: string }
    bank_account?: { id: number; name: string; bank_name: string } | null
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
    possible_duplicate?: boolean
    category?: string | null
    reconciled_by?: 'manual' | 'auto' | 'rule' | null
    reconciled_at?: string | null
    reconciled_by_user_id?: number | null
    rule_id?: number | null
    rule?: { id: number; name: string } | null
    reconciled_by_user?: { id: number; name: string } | null
}

type Suggestion = {
    id: number
    type: string
    description: string
    amount: number
    due_date: string
    customer_name?: string
    supplier_name?: string
    score: number
}

type SearchResult = {
    id: number
    type: string
    description: string
    amount: number
    due_date: string
    customer_name?: string
    supplier_name?: string
}

type SummaryData = {
    total_entries: number
    pending_count: number
    matched_count: number
    ignored_count: number
    duplicate_count: number
    total_credits: number
    total_debits: number
}

type Paginator<T> = {
    data: T[]
    current_page: number
    last_page: number
    total: number
}

type EntryFilters = {
    status: string
    type: string
    search: string
    duplicates_only: boolean
}

// ─── Constants & Helpers ────────────────────────────

const RECEIVABLE_TYPE = 'App\\Models\\AccountReceivable'
const PAYABLE_TYPE = 'App\\Models\\AccountPayable'

const fmtBRL = (value: number | string) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (date: string) => {
    if (!date) return '—'
    return new Date(date + (date.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
}

// ─── Component ──────────────────────────────────────

export function BankReconciliationPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')
    const canManage = isSuperAdmin || hasPermission('finance.receivable.create')
    const canDelete = isSuperAdmin || hasPermission('finance.receivable.delete')

    // ── State ──
    const [statementPage, setStatementPage] = useState(1)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [entriesPage, setEntriesPage] = useState(1)
    const [matchModal, setMatchModal] = useState<BankEntry | null>(null)
    const [importAccountId, setImportAccountId] = useState<number | null>(null)
    const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
    const [filters, setFilters] = useState<EntryFilters>({ status: '', type: '', search: '', duplicates_only: false })
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [suggestionsLoading, setSuggestionsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
    const [matchType, setMatchType] = useState<string>(RECEIVABLE_TYPE)
    const [matchId, setMatchId] = useState('')

    // ── Queries ──

    const summaryQuery = useQuery({
        queryKey: ['bank-reconciliation-summary'],
        const { data, isLoading, isError } = useQuery({
        queryFn: async () => {
            const { data } = await api.get<{ success: boolean; data: SummaryData }>('/bank-reconciliation/summary')
            return data.data
        },
    })

    const bankAccountsQuery = useQuery({
        queryKey: ['bank-accounts-options'],
        queryFn: async () => {
            const { data } = await api.get<{ success: boolean; data: { data: BankAccount[] } | BankAccount[] }>('/bank-accounts')
            const list = Array.isArray(data.data) ? data.data : data.data?.data ?? []
            return list
        },
    })

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

    const entriesQueryParams = useMemo(() => {
        const params: Record<string, string | number | boolean> = { page: entriesPage }
        if (filters.status) params.status = filters.status
        if (filters.type) params.type = filters.type
        if (filters.search) params.search = filters.search
        if (filters.duplicates_only) params.duplicates_only = true
        return params
    }, [entriesPage, filters])

    const entriesQuery = useQuery({
        queryKey: ['bank-entries', expandedId, entriesQueryParams],
        queryFn: async () => {
            const { data } = await api.get<{ success: boolean; data: Paginator<BankEntry> }>(
                `/bank-reconciliation/statements/${expandedId}/entries`,
                { params: entriesQueryParams }
            )
            return data.data
        },
        enabled: !!expandedId,
    })

    // ── Mutations ──

    const invalidateAll = useCallback(() => {
        qc.invalidateQueries({ queryKey: ['bank-statements'] })
        qc.invalidateQueries({ queryKey: ['bank-entries'] })
        qc.invalidateQueries({ queryKey: ['bank-reconciliation-summary'] })
    }, [qc])

    const importMut = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData()
            formData.append('file', file)
            if (importAccountId) formData.append('bank_account_id', String(importAccountId))
            const { data } = await api.post('/bank-reconciliation/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            return data.data
        },
        onSuccess: (result) => {
            const msg = `Extrato importado — ${result?.matched_count ?? 0} conciliados automaticamente`
            const dups = result?.duplicate_count ?? 0
            if (dups > 0) {
                toast.warning(`${msg}. ${dups} possível(is) duplicata(s) detectada(s).`)
            } else {
                toast.success(msg)
            }
            invalidateAll()
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
            toast.success('Lançamento conciliado')
            invalidateAll()
            setMatchModal(null)
            setMatchId('')
            setMatchType(RECEIVABLE_TYPE)
            setSuggestions([])
            setSearchResults([])
            setSearchQuery('')
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao conciliar lançamento')
        },
    })

    const ignoreMut = useMutation({
        mutationFn: async (entryId: number) => {
            await api.post(`/bank-reconciliation/entries/${entryId}/ignore`)
        },
        onSuccess: () => {
            toast.success('Lançamento ignorado')
            invalidateAll()
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao ignorar lançamento')
        },
    })

    const unmatchMut = useMutation({
        mutationFn: async (entryId: number) => {
            await api.post(`/bank-reconciliation/entries/${entryId}/unmatch`)
        },
        onSuccess: () => {
            toast.success('Conciliação desfeita')
            invalidateAll()
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao desfazer conciliação')
        },
    })

    const suggestRuleMut = useMutation({
        mutationFn: async (entryId: number) => {
            const res = await api.post(`/bank-reconciliation/entries/${entryId}/suggest-rule`)
            return res.data
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Regra sugerida criada com sucesso')
                qc.invalidateQueries({ queryKey: ['reconciliation-rules'] })
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao sugerir regra')
        },
    })

    const deleteMut = useMutation({
        mutationFn: async (statementId: number) => {
            await api.delete(`/bank-reconciliation/statements/${statementId}`)
        },
        onSuccess: () => {
            toast.success('Extrato excluído')
                setDeleteConfirm(null)
            if (expandedId === deleteConfirm) setExpandedId(null)
            invalidateAll()
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao excluir extrato')
        },
    })

    const bulkMut = useMutation({
        mutationFn: async ({ action, entryIds }: { action: string; entryIds: number[] }) => {
            const { data } = await api.post('/bank-reconciliation/bulk-action', {
                action,
                entry_ids: entryIds,
            })
            return data.data
        },
        onSuccess: (result) => {
            toast.success(`${result?.processed ?? 0} de ${result?.total ?? 0} lançamentos processados`)
                setSelectedEntries(new Set())
            invalidateAll()
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro na ação em lote')
        },
    })

    // ── Handlers ──

    const handleUpload = () => {
        if (!canManage) return
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.ofx,.txt,.ret,.rem'
        input.onchange = (event: Event) => {
            const target = event.target as HTMLInputElement
            const file = target.files?.[0]
            if (file) importMut.mutate(file)
        }
        input.click()
    }

    const handleExport = async (statementId: number) => {
        try {
            const { data } = await api.get(`/bank-reconciliation/statements/${statementId}/export`)
            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `conciliacao-extrato-${statementId}.json`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('Relatório exportado')
        } catch {
            toast.error('Erro ao exportar relatório')
        }
    }

    const handleExportPdf = async (statementId: number) => {
        try {
            const response = await api.get(`/bank-reconciliation/statements/${statementId}/export-pdf`, {
                responseType: 'blob',
            })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `conciliacao-${statementId}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.parentNode?.removeChild(link)
            toast.success('PDF gerado com sucesso')
        } catch {
            toast.error('Erro ao gerar PDF')
        }
    }

    const loadSuggestions = async (entryId: number) => {
        setSuggestionsLoading(true)
        try {
            const { data } = await api.get(`/bank-reconciliation/entries/${entryId}/suggestions`)
            setSuggestions(data.data ?? [])
        } catch {
            setSuggestions([])
        } finally {
            setSuggestionsLoading(false)
        }
    }

    const searchFinancials = async (query: string, type: string) => {
        if (query.length < 2) {
            setSearchResults([])
            return
        }
        setSearchLoading(true)
        try {
            const searchType = type === RECEIVABLE_TYPE ? 'receivable' : 'payable'
            const { data } = await api.get('/bank-reconciliation/search-financials', {
                params: { q: query, type: searchType },
            })
            setSearchResults(data.data ?? [])
        } catch {
            setSearchResults([])
        } finally {
            setSearchLoading(false)
        }
    }

    const openMatchModal = (entry: BankEntry) => {
        const type = entry.type === 'credit' ? RECEIVABLE_TYPE : PAYABLE_TYPE
        setMatchModal(entry)
        setMatchType(type)
        setMatchId(entry.matched_id ? String(entry.matched_id) : '')
        setSuggestions([])
        setSearchResults([])
        setSearchQuery('')
        loadSuggestions(entry.id)
    }

    const toggleEntry = (id: number) => {
        setSelectedEntries((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = (entries: BankEntry[]) => {
        const allSelected = entries.every((e) => selectedEntries.has(e.id))
        if (allSelected) {
            setSelectedEntries(new Set())
        } else {
            setSelectedEntries(new Set(entries.map((e) => e.id)))
        }
    }

    // ── Derived ──
    const summary = summaryQuery.data
    const statements = statementsQuery.data?.data ?? []
    const statementsCurrentPage = statementsQuery.data?.current_page ?? 1
    const statementsLastPage = statementsQuery.data?.last_page ?? 1
    const entries = entriesQuery.data?.data ?? []
    const entriesCurrentPage = entriesQuery.data?.current_page ?? 1
    const entriesLastPage = entriesQuery.data?.last_page ?? 1
    const bankAccounts = bankAccountsQuery.data ?? []
    const hasSelected = selectedEntries.size > 0

    const statusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string; label: string }> = {
            pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pendente' },
            matched: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Conciliado' },
            ignored: { bg: 'bg-surface-100', text: 'text-surface-500', label: 'Ignorado' },
        }
        const current = styles[status] ?? styles.pending
        return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', current.bg, current.text)}>{current.label}</span>
    }

    const scoreBadge = (score: number) => {
        const color = score >= 80 ? 'text-emerald-600 bg-emerald-50' : score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
        return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', color)}>{score}%</span>
    }

    // ─── Render ──────────────────────────────────────

    return (
        <div className="space-y-5">
            <PageHeader
                title="Conciliação Bancária"
                subtitle="Importe extratos OFX ou CNAB 240/400 e concilie com contas a receber e pagar"
                actions={[{ label: 'Importar Extrato', onClick: handleUpload, icon: <Upload className="h-4 w-4" />, disabled: !canManage || importMut.isPending }]}
            />

            {/* ── F3: Summary KPIs ── */}
            {summary ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {[
                        { label: 'Total', value: summary.total_entries, icon: FileText, color: 'text-surface-600' },
                        { label: 'Pendentes', value: summary.pending_count, icon: Clock, color: 'text-amber-600' },
                        { label: 'Conciliados', value: summary.matched_count, icon: CheckCircle2, color: 'text-emerald-600' },
                        { label: 'Ignorados', value: summary.ignored_count, icon: EyeOff, color: 'text-surface-400' },
                        { label: 'Duplicatas', value: summary.duplicate_count, icon: Copy, color: 'text-orange-500' },
                        { label: 'Créditos', value: fmtBRL(summary.total_credits), icon: ArrowUpRight, color: 'text-emerald-600' },
                        { label: 'Débitos', value: fmtBRL(summary.total_debits), icon: ArrowDownRight, color: 'text-red-600' },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="rounded-xl border border-default bg-surface-0 p-3 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Icon className={cn('h-4 w-4', color)} />
                                <span className="text-[11px] font-medium text-surface-500">{label}</span>
                            </div>
                            <p className={cn('mt-1 text-lg font-bold', color)}>{value}</p>
                        </div>
                    ))}
                </div>
            ) : null}

            {/* ── F1: Bank Account Selector for Import ── */}
            {canManage && bankAccounts.length > 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 px-4 py-3">
                    <label className="text-xs font-medium text-surface-600 whitespace-nowrap">Conta bancária para importação:</label>
                    <select
                        value={importAccountId ?? ''}
                        onChange={(e) => setImportAccountId(e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 max-w-xs rounded-lg border border-surface-300 px-3 py-1.5 text-sm"
                        aria-label="Conta bancária"
                    >
                        <option value="">Nenhuma (não vincular)</option>
                        {bankAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                                {acc.bank_name} — {acc.name}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}

            {statementsQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Erro ao carregar extratos bancários.
                </div>
            ) : null}

            {/* ── Statements List ── */}
            <div className="space-y-3">
                {statementsQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-surface-400">Carregando extratos...</p>
                ) : statements.length === 0 ? (
                    <EmptyState
                        icon={<FileText className="h-5 w-5 text-surface-300" />}
                        message="Nenhum extrato importado"
                        action={canManage ? { label: 'Importar Extrato', onClick: handleUpload, icon: <Upload className="h-4 w-4" /> } : undefined}
                    />
                ) : (
                    statements.map((statement) => (
                        <div key={statement.id} className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                            <div className="flex items-center justify-between p-4">
                                <button
                                    onClick={() => {
                                        const nextId = expandedId === statement.id ? null : statement.id
                                        setExpandedId(nextId)
                                        setEntriesPage(1)
                                        setSelectedEntries(new Set())
                                        setFilters({ status: '', type: '', search: '', duplicates_only: false })
                                    }}
                                    className="flex flex-1 items-center gap-3 transition-colors duration-100 hover:opacity-80"
                                >
                                    {expandedId === statement.id ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
                                    <FileText className="h-5 w-5 text-brand-500" />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold text-surface-900">{statement.filename}</p>
                                        <p className="text-xs text-surface-500">
                                            {fmtDate(statement.created_at)} — {statement.creator?.name ?? 'Sistema'}
                                            {statement.bank_account ? ` • ${statement.bank_account.bank_name} - ${statement.bank_account.name}` : ''}
                                        </p>
                                    </div>
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <p className="text-xs text-surface-500">{statement.entries_count ?? statement.total_entries} lançamentos</p>
                                        <p className="text-xs text-emerald-600">{statement.matched_entries} conciliados</p>
                                    </div>
                                    {/* F9: Export & F6: Delete */}
                                    <div className="flex gap-1">
                                        <button onClick={() => handleExport(statement.id)} title="Exportar JSON" className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50">
                                            <Download className="h-3.5 w-3.5 text-brand-600" />
                                        </button>
                                        <button onClick={() => handleExportPdf(statement.id)} title="Exportar PDF" className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-red-300 hover:bg-red-50">
                                            <FileText className="h-3.5 w-3.5 text-red-600" />
                                        </button>
                                        {canDelete ? (
                                            <button onClick={() => setDeleteConfirm(statement.id)} title="Excluir extrato" className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-red-300 hover:bg-red-50">
                                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {expandedId === statement.id ? (
                                <div className="border-t border-surface-100 p-4">
                                    {/* F7: Filters Bar */}
                                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-surface-100 bg-surface-50 p-3">
                                        <div className="relative flex-1 min-w-[180px]">
                                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar descrição..."
                                                value={filters.search}
                                                onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setEntriesPage(1) }}
                                                className="w-full rounded-lg border border-surface-200 py-1.5 pl-8 pr-3 text-sm"
                                            />
                                        </div>
                                        <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setEntriesPage(1) }} className="rounded-lg border border-surface-200 px-2 py-1.5 text-sm" aria-label="Filtrar por status">
                                            <option value="">Todos status</option>
                                            <option value="pending">Pendentes</option>
                                            <option value="matched">Conciliados</option>
                                            <option value="ignored">Ignorados</option>
                                        </select>
                                        <select value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setEntriesPage(1) }} className="rounded-lg border border-surface-200 px-2 py-1.5 text-sm" aria-label="Filtrar por tipo">
                                            <option value="">Todos tipos</option>
                                            <option value="credit">Crédito</option>
                                            <option value="debit">Débito</option>
                                        </select>
                                        <label className="flex items-center gap-1.5 text-xs text-surface-600 cursor-pointer">
                                            <input type="checkbox" checked={filters.duplicates_only} onChange={(e) => { setFilters((f) => ({ ...f, duplicates_only: e.target.checked })); setEntriesPage(1) }} className="rounded" />
                                            Só duplicatas
                                        </label>
                                    </div>

                                    {/* F8: Bulk Actions Bar */}
                                    {hasSelected && canManage ? (
                                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                                            <span className="text-xs font-medium text-brand-700">{selectedEntries.size} selecionado(s)</span>
                                            <div className="ml-auto flex gap-1.5">
                                                <Button size="sm" variant="outline" onClick={() => bulkMut.mutate({ action: 'auto-match', entryIds: [...selectedEntries] })} disabled={bulkMut.isPending}>
                                                    <Sparkles className="mr-1 h-3 w-3" /> Auto conciliar
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => bulkMut.mutate({ action: 'ignore', entryIds: [...selectedEntries] })} disabled={bulkMut.isPending}>
                                                    <EyeOff className="mr-1 h-3 w-3" /> Ignorar
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => bulkMut.mutate({ action: 'unmatch', entryIds: [...selectedEntries] })} disabled={bulkMut.isPending}>
                                                    <Undo2 className="mr-1 h-3 w-3" /> Desfazer
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {entriesQuery.isLoading ? (
                                        <p className="py-4 text-center text-sm text-surface-400">Carregando lançamentos...</p>
                                    ) : entriesQuery.isError ? (
                                        <p className="py-4 text-center text-sm text-red-600">Erro ao carregar lançamentos.</p>
                                    ) : entries.length === 0 ? (
                                        <p className="py-4 text-center text-sm text-surface-400">Nenhum lançamento encontrado com os filtros aplicados.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {/* Select all checkbox */}
                                            {canManage ? (
                                                <label className="flex items-center gap-2 px-1 text-xs text-surface-500 cursor-pointer">
                                                    <input type="checkbox" checked={entries.length > 0 && entries.every((e) => selectedEntries.has(e.id))} onChange={() => toggleAll(entries)} className="rounded" />
                                                    Selecionar todos
                                                </label>
                                            ) : null}

                                            {entries.map((entry) => (
                                                <div key={entry.id} className={cn('flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-surface-50', entry.possible_duplicate ? 'border-orange-200 bg-orange-50/30' : 'border-surface-100')}>
                                                    {/* F8: Checkbox */}
                                                    {canManage ? (
                                                        <input type="checkbox" checked={selectedEntries.has(entry.id)} onChange={() => toggleEntry(entry.id)} className="rounded shrink-0" />
                                                    ) : null}

                                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                                        {entry.type === 'credit'
                                                            ? <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-500" />
                                                            : <ArrowDownRight className="h-4 w-4 shrink-0 text-red-500" />}
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="truncate text-[13px] font-medium text-surface-900">{entry.description}</p>
                                                                {/* F10: Duplicate badge */}
                                                                {entry.possible_duplicate ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                                                        <AlertTriangle className="h-2.5 w-2.5" /> Duplicata?
                                                                    </span>
                                                                ) : null}
                                                                {/* Rule badge */}
                                                                {entry.reconciled_by === 'rule' && entry.rule ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                                                        <Zap className="h-2.5 w-2.5" /> {entry.rule.name}
                                                                    </span>
                                                                ) : null}
                                                                {/* Category badge */}
                                                                {entry.category ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                                                                        {entry.category}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs text-surface-500">{fmtDate(entry.date)}</p>
                                                                {/* Audit info */}
                                                                {entry.reconciled_by && entry.reconciled_at ? (
                                                                    <span className="text-[10px] text-surface-400">
                                                                        {entry.reconciled_by === 'manual' ? '✋ Manual' : entry.reconciled_by === 'rule' ? '⚡ Regra' : '🤖 Auto'}
                                                                        {entry.reconciled_by_user?.name ? ` por ${entry.reconciled_by_user.name}` : ''}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className={cn('text-sm font-bold', entry.type === 'credit' ? 'text-emerald-600' : 'text-red-600')}>
                                                            {fmtBRL(entry.amount)}
                                                        </span>
                                                        {statusBadge(entry.status)}
                                                        {canManage ? (
                                                            <div className="flex gap-1">
                                                                {entry.status === 'pending' ? (
                                                                    <>
                                                                        <button onClick={() => openMatchModal(entry)} title="Conciliar" className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50">
                                                                            <Link2 className="h-3.5 w-3.5 text-brand-600" />
                                                                        </button>
                                                                        <button onClick={() => ignoreMut.mutate(entry.id)} title="Ignorar" className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-red-300 hover:bg-red-50">
                                                                            <X className="h-3.5 w-3.5 text-red-500" />
                                                                        </button>
                                                                    </>
                                                                ) : null}
                                                                {/* F5: Unmatch button */}
                                                                {entry.status === 'matched' ? (
                                                                    <>
                                                                        <button onClick={() => unmatchMut.mutate(entry.id)} title="Desfazer conciliação" className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-amber-300 hover:bg-amber-50">
                                                                            <Undo2 className="h-3.5 w-3.5 text-amber-600" />
                                                                        </button>
                                                                        {/* Suggest rule from manual match */}
                                                                        {entry.reconciled_by === 'manual' ? (
                                                                            <button
                                                                                onClick={() => suggestRuleMut.mutate(entry.id)}
                                                                                title="Criar regra a partir deste lançamento"
                                                                                className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-blue-300 hover:bg-blue-50"
                                                                            >
                                                                                <Zap className="h-3.5 w-3.5 text-blue-600" />
                                                                            </button>
                                                                        ) : null}
                                                                    </>
                                                                ) : null}
                                                                {entry.status === 'ignored' ? (
                                                                    <button onClick={() => unmatchMut.mutate(entry.id)} title="Restaurar para pendente" className="rounded-lg border border-surface-200 p-1.5 transition-colors hover:border-amber-300 hover:bg-amber-50">
                                                                        <Undo2 className="h-3.5 w-3.5 text-amber-600" />
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Entries Pagination */}
                                    <div className="mt-3 flex items-center justify-end gap-2">
                                        <Button variant="outline" size="sm" disabled={entriesCurrentPage <= 1} onClick={() => setEntriesPage((p) => Math.max(1, p - 1))}>
                                            Anterior
                                        </Button>
                                        <span className="text-xs text-surface-500">Página {entriesCurrentPage} de {entriesLastPage}</span>
                                        <Button variant="outline" size="sm" disabled={entriesCurrentPage >= entriesLastPage} onClick={() => setEntriesPage((p) => p + 1)}>
                                            Próxima
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>

            {/* Statements Pagination */}
            <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" disabled={statementsCurrentPage <= 1} onClick={() => setStatementPage((p) => Math.max(1, p - 1))}>
                    Anterior
                </Button>
                <span className="text-xs text-surface-500">Página {statementsCurrentPage} de {statementsLastPage}</span>
                <Button variant="outline" size="sm" disabled={statementsCurrentPage >= statementsLastPage} onClick={() => setStatementPage((p) => p + 1)}>
                    Próxima
                </Button>
            </div>

            {/* ── Match Modal (F2 + F4) ── */}
            {matchModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setMatchModal(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-[15px] font-semibold text-surface-900">Conciliar lançamento</h3>
                        <p className="mt-0.5 text-[13px] text-surface-500">{matchModal.description} — {fmtBRL(matchModal.amount)}</p>

                        {/* F4: Suggestions */}
                        {suggestionsLoading ? (
                            <p className="mt-3 text-xs text-surface-400">Buscando sugestões...</p>
                        ) : suggestions.length > 0 ? (
                            <div className="mt-3">
                                <p className="text-xs font-semibold text-surface-600 flex items-center gap-1"><Sparkles className="h-3 w-3 text-brand-500" /> Sugestões automáticas</p>
                                <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto">
                                    {suggestions.map((sug) => (
                                        <button
                                            key={`${sug.type}-${sug.id}`}
                                            onClick={() =>
                                                matchMut.mutate({ entryId: matchModal.id, matchedType: sug.type, matchedId: sug.id })
                                            }
                                            className="flex w-full items-center justify-between rounded-lg border border-surface-100 p-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-medium text-surface-800">
                                                    {sug.description} — {sug.customer_name ?? sug.supplier_name ?? ''}
                                                </p>
                                                <p className="text-[11px] text-surface-400">
                                                    {fmtBRL(sug.amount)} • Venc: {fmtDate(sug.due_date)}
                                                </p>
                                            </div>
                                            {scoreBadge(sug.score)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="mt-4 rounded-lg border border-surface-100 bg-surface-50 p-3">
                            <p className="text-xs font-semibold text-surface-600 mb-2">Conciliação manual</p>

                            {/* F2: Search Financials */}
                            <div className="mb-3">
                                <label className="text-xs font-medium text-surface-700">Buscar título</label>
                                <div className="relative mt-1">
                                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por descrição, cliente ou valor..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value)
                                            searchFinancials(e.target.value, matchType)
                                        }}
                                        className="w-full rounded-lg border border-surface-300 py-2 pl-8 pr-3 text-sm"
                                    />
                                </div>
                                {searchLoading ? (
                                    <p className="mt-1 text-xs text-surface-400">Buscando...</p>
                                ) : searchResults.length > 0 ? (
                                    <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto rounded-lg border border-surface-100 bg-white p-1">
                                        {searchResults.map((res) => (
                                            <button
                                                key={`${res.type}-${res.id}`}
                                                onClick={() => {
                                                    setMatchType(res.type)
                                                    setMatchId(String(res.id))
                                                    setSearchResults([])
                                                    setSearchQuery('')
                                                }}
                                                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors hover:bg-surface-50"
                                            >
                                                <span className="truncate text-xs text-surface-700">{res.description} — {res.customer_name ?? res.supplier_name ?? ''}</span>
                                                <span className="shrink-0 text-xs font-medium text-surface-600">{fmtBRL(res.amount)}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            <form
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    const id = Number(matchId)
                                    if (!Number.isInteger(id) || id <= 0) {
                                        toast.error('Informe um ID válido para conciliação')
                                        return
                                    }
                                    matchMut.mutate({ entryId: matchModal.id, matchedType: matchType, matchedId: id })
                                }}
                                className="space-y-3"
                            >
                                <div>
                                    <label className="text-xs font-medium text-surface-700">Tipo</label>
                                    <select
                                        value={matchType}
                                        onChange={(e) => {
                                            setMatchType(e.target.value)
                                            if (searchQuery.length >= 2) searchFinancials(searchQuery, e.target.value)
                                        }}
                                        className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                                        aria-label="Tipo de conciliação"
                                    >
                                        <option value={RECEIVABLE_TYPE}>Conta a receber</option>
                                        <option value={PAYABLE_TYPE}>Conta a pagar</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-surface-700">ID do título</label>
                                    <input
                                        value={matchId}
                                        onChange={(e) => setMatchId(e.target.value)}
                                        type="number"
                                        required
                                        aria-label="ID do título"
                                        placeholder="Ex: 42"
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
                </div>
            ) : null}

            {/* ── F6: Delete Confirmation Dialog ── */}
            {deleteConfirm !== null ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-red-100 p-2">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-surface-900">Excluir extrato</h3>
                                <p className="text-xs text-surface-500">Tem certeza? Todos os lançamentos serão removidos.</p>
                            </div>
                        </div>
                        <div className="mt-5 flex gap-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                                Cancelar
                            </Button>
                            <Button type="button" variant="destructive" className="flex-1" loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleteConfirm)}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
