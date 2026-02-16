import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Edit2, FolderTree, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'

type AccountType = 'asset' | 'liability' | 'revenue' | 'expense'

type Account = {
    id: number
    code: string
    name: string
    type: AccountType
    parent_id: number | null
    is_system: boolean
    is_active: boolean
}

type ApiResponse<T> = {
    success: boolean
    message: string
    data: T
}

type TreeNode = Account & { children: TreeNode[] }
const EMPTY_ACCOUNTS: Account[] = []

const typeMeta: Record<AccountType, { label: string; badge: 'blue' | 'red' | 'emerald' | 'amber' }> = {
    asset: { label: 'Ativo', badge: 'blue' },
    liability: { label: 'Passivo', badge: 'red' },
    revenue: { label: 'Receita', badge: 'emerald' },
    expense: { label: 'Despesa', badge: 'amber' },
}

const emptyForm = {
    code: '',
    name: '',
    type: 'asset' as AccountType,
    parent_id: '',
    is_active: true,
}

const extractApiMessage = (error: unknown, fallback: string): string => {
    const candidate = error as { response?: { data?: { message?: string } } }
    return candidate?.response?.data?.message ?? fallback
}

function buildTree(accounts: Account[]): TreeNode[] {
    if (accounts.length === 0) {
        return []
    }

    const byParent = new Map<number | null, Account[]>()
    const idSet = new Set(accounts.map((account) => account.id))

    for (const account of accounts) {
        const key = idSet.has(account.parent_id ?? -1) ? account.parent_id : null
        const siblings = byParent.get(key) ?? []
        siblings.push(account)
        byParent.set(key, siblings)
    }

    const sortByCode = (a: Account, b: Account) => a.code.localeCompare(b.code)

    const toNode = (account: Account): TreeNode => {
        const children = (byParent.get(account.id) ?? []).sort(sortByCode).map(toNode)
        return { ...account, children }
    }

    return (byParent.get(null) ?? []).sort(sortByCode).map(toNode)
}

function collectDescendants(accounts: Account[], accountId: number): Set<number> {
    const childMap = new Map<number, number[]>()

    for (const account of accounts) {
        if (account.parent_id !== null) {
            const list = childMap.get(account.parent_id) ?? []
            list.push(account.id)
            childMap.set(account.parent_id, list)
        }
    }

    const descendants = new Set<number>()
    const stack = [...(childMap.get(accountId) ?? [])]

    while (stack.length > 0) {
        const current = stack.pop() as number
        if (descendants.has(current)) {
            continue
        }
        descendants.add(current)
        const children = childMap.get(current) ?? []
        stack.push(...children)
    }

    return descendants
}

export function ChartOfAccountsPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()

    const isSuperAdmin = hasRole('super_admin')
    const canCreate = isSuperAdmin || hasPermission('finance.chart.create')
    const canUpdate = isSuperAdmin || hasPermission('finance.chart.update')
    const canDelete = isSuperAdmin || hasPermission('finance.chart.delete')

    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('')
    const [activeFilter, setActiveFilter] = useState<string>('')
    const [expanded, setExpanded] = useState<Set<number>>(new Set())

    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; account?: Account; parentId?: number } | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
    const [form, setForm] = useState(emptyForm)

    const listQuery = useQuery({
        queryKey: ['chart-of-accounts', search, typeFilter, activeFilter],
        queryFn: async () => {
            const params: Record<string, string | number | undefined> = {
                search: search || undefined,
                type: typeFilter || undefined,
            }

            if (activeFilter === '1') {
                params.is_active = 1
            } else if (activeFilter === '0') {
                params.is_active = 0
            }

            const response = await api.get<ApiResponse<Account[]>>('/chart-of-accounts', { params })
            return response.data
        },
    })

    const parentOptionsQuery = useQuery({
        queryKey: ['chart-of-accounts-parent-options'],
        queryFn: async () => {
            const response = await api.get<ApiResponse<Account[]>>('/chart-of-accounts', {
                params: { is_active: 1 },
            })
            return response.data.data
        },
        enabled: modal !== null,
    })

    const accounts = listQuery.data?.data ?? EMPTY_ACCOUNTS
    const tree = useMemo(() => buildTree(accounts), [accounts])

    const saveMut = useMutation({
        mutationFn: async (payload: typeof form & { id?: number }) => {
            const body = {
                code: payload.code,
                name: payload.name,
                type: payload.type,
                parent_id: payload.parent_id ? Number(payload.parent_id) : null,
                is_active: payload.is_active,
            }

            if (payload.id) {
                await api.put(`/chart-of-accounts/${payload.id}`, body)
                return
            }

            await api.post('/chart-of-accounts', body)
        },
        onSuccess: () => {
            toast.success('Plano de contas atualizado com sucesso')
                qc.invalidateQueries({ queryKey: ['chart-of-accounts'] })
            qc.invalidateQueries({ queryKey: ['chart-of-accounts-parent-options'] })
            setModal(null)
            setForm(emptyForm)
        },
        onError: (error) => {
            toast.error(extractApiMessage(error, 'Erro ao salvar conta'))
        },
    })

    const deleteMut = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/chart-of-accounts/${id}`)
        },
        onSuccess: () => {
            toast.success('Conta removida com sucesso')
                qc.invalidateQueries({ queryKey: ['chart-of-accounts'] })
            qc.invalidateQueries({ queryKey: ['chart-of-accounts-parent-options'] })
            setDeleteTarget(null)
        },
        onError: (error) => {
            toast.error(extractApiMessage(error, 'Erro ao remover conta'))
        },
    })

    const toggleExpand = (id: number) => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const collapseAll = () => setExpanded(new Set())
    const expandAll = () => {
        const all = new Set<number>()
        const walk = (nodes: TreeNode[]) => {
            for (const node of nodes) {
                if (node.children.length > 0) {
                    all.add(node.id)
                    walk(node.children)
                }
            }
        }
        walk(tree)
        setExpanded(all)
    }

    const openCreate = (parentId?: number) => {
        if (!canCreate) {
            toast.error('Sem permissão para criar conta')
            return
        }

        const parentAccount = parentId ? accounts.find((account) => account.id === parentId) : null

        setForm({
            ...emptyForm,
            parent_id: parentId ? String(parentId) : '',
            type: parentAccount?.type ?? emptyForm.type,
        })
        setModal({ mode: 'create', parentId })
    }

    const openEdit = (account: Account) => {
        if (!canUpdate) {
            toast.error('Sem permissão para editar conta')
            return
        }

        setForm({
            code: account.code,
            name: account.name,
            type: account.type,
            parent_id: account.parent_id ? String(account.parent_id) : '',
            is_active: account.is_active,
        })
        setModal({ mode: 'edit', account })
    }

    const closeModal = () => {
        if (saveMut.isPending) {
            return
        }
        setModal(null)
        setForm(emptyForm)
    }

    const selectableParents = useMemo(() => {
        const options = parentOptionsQuery.data ?? accounts
        const sameType = options.filter((account) => account.type === form.type && account.is_active)

        if (modal?.mode !== 'edit' || !modal.account) {
            return sameType
        }

        const descendants = collectDescendants(options, modal.account.id)

        return sameType.filter((account) => account.id !== modal.account!.id && !descendants.has(account.id))
    }, [accounts, form.type, modal, parentOptionsQuery.data])

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!form.code.trim() || !form.name.trim()) {
            toast.error('Informe código e nome da conta')
            return
        }

        saveMut.mutate({
            id: modal?.account?.id,
            code: form.code.trim(),
            name: form.name.trim(),
            type: form.type,
            parent_id: form.parent_id,
            is_active: form.is_active,
        })
    }

    const renderNode = (node: TreeNode, depth = 0): React.ReactNode => {
        const hasChildren = node.children.length > 0
        const isOpen = expanded.has(node.id)

        return (
            <div key={node.id}>
                <div className={cn('flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 hover:border-default hover:bg-surface-50')}>
                    <button
                        type="button"
                        onClick={() => hasChildren && toggleExpand(node.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-surface-500 hover:bg-surface-100"
                    >
                        {hasChildren ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="h-4 w-4" />}
                    </button>

                    <div style={{ width: depth * 18 }} />

                    <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-brand-700">{node.code}</span>
                    <span className="flex-1 text-sm text-surface-900">{node.name}</span>

                    <Badge variant={typeMeta[node.type].badge}>{typeMeta[node.type].label}</Badge>
                    <Badge variant={node.is_active ? 'success' : 'default'}>{node.is_active ? 'Ativa' : 'Inativa'}</Badge>
                    {node.is_system ? <Badge variant="info">Sistema</Badge> : null}

                    <div className="flex items-center gap-1">
                        {canCreate ? (
                            <Button variant="ghost" size="icon" onClick={() => openCreate(node.id)} title="Nova subconta">
                                <Plus className="h-4 w-4" />
                            </Button>
                        ) : null}
                        {canUpdate ? (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(node)} title="Editar conta">
                                <Edit2 className="h-4 w-4" />
                            </Button>
                        ) : null}
                        {canDelete ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(node)}
                                title="Excluir conta"
                                disabled={node.is_system}
                            >
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        ) : null}
                    </div>
                </div>

                {hasChildren && isOpen ? (
                    <div className="space-y-1 pl-1">
                        {node.children.map((child) => renderNode(child, depth + 1))}
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Plano de Contas"
                subtitle="Estrutura contábil para classificação financeira"
                count={accounts.length}
                actions={[
                    { label: 'Atualizar', onClick: () => listQuery.refetch(), icon: <RefreshCw className="h-4 w-4" />, variant: 'outline' as const },
                    ...(canCreate ? [{ label: 'Nova Conta', onClick: () => openCreate(), icon: <Plus className="h-4 w-4" /> }] : []),
                ]}
            />

            <div className="grid gap-3 rounded-xl border border-default bg-surface-0 p-4 shadow-card md:grid-cols-[1fr_180px_180px_auto]">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input
                        value={search}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                        placeholder="Buscar por código ou nome"
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-3 text-sm focus:border-brand-500 focus:bg-surface-0 focus:outline-none"
                    />
                </div>

                <select
                    value={typeFilter}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => setTypeFilter(event.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                >
                    <option value="">Todos os tipos</option>
                    {Object.entries(typeMeta).map(([value, meta]) => (
                        <option key={value} value={value}>{meta.label}</option>
                    ))}
                </select>

                <select
                    value={activeFilter}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => setActiveFilter(event.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                >
                    <option value="">Todas</option>
                    <option value="1">Somente ativas</option>
                    <option value="0">Somente inativas</option>
                </select>

                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={expandAll}>Expandir</Button>
                    <Button variant="outline" size="sm" onClick={collapseAll}>Recolher</Button>
                </div>
            </div>

            {listQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Erro ao carregar plano de contas: {extractApiMessage(listQuery.error, 'falha inesperada')}.
                </div>
            ) : null}

            <div className="rounded-xl border border-default bg-surface-0 p-3 shadow-card">
                {listQuery.isLoading ? (
                    <p className="py-12 text-center text-sm text-surface-500">Carregando plano de contas...</p>
                ) : tree.length === 0 ? (
                    <EmptyState
                        icon={<FolderTree className="h-5 w-5 text-surface-300" />}
                        message="Nenhuma conta encontrada para os filtros atuais"
                        action={canCreate ? { label: 'Criar primeira conta', onClick: () => openCreate(), icon: <Plus className="h-4 w-4" /> } : undefined}
                    />
                ) : (
                    <div className="space-y-1">{tree.map((node) => renderNode(node))}</div>
                )}
            </div>

            <Modal
                open={modal !== null}
                onOpenChange={(open) => !open && closeModal()}
                title={modal?.mode === 'edit' ? 'Editar Conta' : 'Nova Conta'}
                description="Defina código, tipo e hierarquia da conta"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="Código"
                            value={form.code}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                            placeholder="1.01.001"
                            required
                            disabled={modal?.mode === 'edit' && !!modal.account?.is_system}
                        />

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo</label>
                            <select
                                value={form.type}
                                onChange={(event: ChangeEvent<HTMLSelectElement>) => setForm((prev) => ({ ...prev, type: event.target.value as AccountType, parent_id: '' }))}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                                disabled={modal?.mode === 'edit' && !!modal.account?.is_system}
                            >
                                {Object.entries(typeMeta).map(([value, meta]) => (
                                    <option key={value} value={value}>{meta.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <Input
                        label="Nome"
                        value={form.name}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        required
                    />

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Conta Pai (opcional)</label>
                        <select
                            value={form.parent_id}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                            disabled={modal?.mode === 'edit' && !!modal.account?.is_system}
                        >
                            <option value="">Sem conta pai</option>
                            {selectableParents.map((account) => (
                                <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                            ))}
                        </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-surface-700">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                            className="h-4 w-4 rounded border-default"
                        />
                        Conta ativa
                    </label>

                    <div className="flex items-center justify-end gap-2 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={closeModal}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>Salvar</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !deleteMut.isPending) {
                        setDeleteTarget(null)
                    }
                }}
                title="Confirmar Exclusao"
                description={deleteTarget ? `Excluir conta ${deleteTarget.code} - ${deleteTarget.name}?` : ''}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Esta ação não pode ser desfeita.</p>
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMut.isPending}>Cancelar</Button>
                        <Button
                            variant="danger"
                            loading={deleteMut.isPending}
                            onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
