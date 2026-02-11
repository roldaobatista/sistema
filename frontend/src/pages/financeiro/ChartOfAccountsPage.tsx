import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, FolderTree, ChevronRight, ChevronDown, X } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface Account {
    id: number
    code: string
    name: string
    type: string
    parent_id: number | null
    children?: Account[]
}

const typeLabels: Record<string, { label: string; color: string }> = {
    asset: { label: 'Ativo', color: 'text-blue-600 bg-blue-50' },
    liability: { label: 'Passivo', color: 'text-red-600 bg-red-50' },
    equity: { label: 'Patrimônio', color: 'text-purple-600 bg-purple-50' },
    revenue: { label: 'Receita', color: 'text-emerald-600 bg-emerald-50' },
    expense: { label: 'Despesa', color: 'text-amber-600 bg-amber-50' },
}

export function ChartOfAccountsPage() {
    const qc = useQueryClient()
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; account?: Account } | null>(null)
    const [expanded, setExpanded] = useState<Set<number>>(new Set())

    const { data: res, isLoading } = useQuery({
        queryKey: ['chart-of-accounts'],
        queryFn: () => api.get('/chart-of-accounts'),
    })
    const accounts: Account[] = res?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: any) =>
            data.id ? api.put(`/chart-of-accounts/${data.id}`, data) : api.post('/chart-of-accounts', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['chart-of-accounts'] }); setModal(null) },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/chart-of-accounts/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['chart-of-accounts'] }) },
    })

    const toggle = (id: number) => {
        const next = new Set(expanded)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setExpanded(next)
    }

    // Constrói árvore hierárquica
    const buildTree = (items: Account[], parentId: number | null = null): Account[] =>
        items
            .filter(i => i.parent_id === parentId)
            .map(i => ({ ...i, children: buildTree(items, i.id) }))

    const tree = buildTree(accounts)

    const renderNode = (node: Account, depth: number = 0) => {
        const hasChildren = (node.children?.length ?? 0) > 0
        const isOpen = expanded.has(node.id)
        const typeInfo = typeLabels[node.type] ?? { label: node.type, color: 'text-surface-600 bg-surface-100' }

        return (
            <div key={node.id}>
                <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-surface-50 transition-colors duration-100 group', depth > 0 && 'ml-6')}>
                    <button onClick={() => hasChildren && toggle(node.id)} className="w-5 h-5 flex items-center justify-center shrink-0">
                        {hasChildren ? (isOpen ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />) : <span className="w-4" />}
                    </button>
                    <span className="text-sm font-mono text-brand-600 font-bold w-20 shrink-0">{node.code}</span>
                    <span className="text-sm text-surface-900 flex-1">{node.name}</span>
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', typeInfo.color)}>{typeInfo.label}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModal({ mode: 'edit', account: node })} className="rounded-lg p-1 hover:bg-surface-100">
                            <Edit2 className="h-3.5 w-3.5 text-surface-500" />
                        </button>
                        <button onClick={() => { if (confirm('Excluir esta conta?')) deleteMut.mutate(node.id) }} className="rounded-lg p-1 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                    </div>
                </div>
                {hasChildren && isOpen && node.children!.map(c => renderNode(c, depth + 1))}
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Plano de Contas</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Estrutura hierárquica de contas contábeis</p>
                </div>
                <button onClick={() => setModal({ mode: 'create' })}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-600 transition-colors">
                    <Plus className="h-4 w-4" /> Nova Conta
                </button>
            </div>

            <div className="rounded-xl border border-default bg-surface-0 shadow-card p-4">
                {isLoading && <p className="text-sm text-surface-400 text-center py-8">Carregando...</p>}
                {!isLoading && tree.length === 0 && (
                    <div className="text-center py-12">
                        <FolderTree className="mx-auto h-12 w-12 text-surface-300" />
                        <p className="mt-3 text-[13px] text-surface-500">Nenhuma conta cadastrada</p>
                    </div>
                )}
                <div className="space-y-0.5">{tree.map(n => renderNode(n))}</div>
            </div>

            {/* Modal CRUD */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-[15px] font-semibold tabular-nums text-surface-900">{modal.mode === 'edit' ? 'Editar Conta' : 'Nova Conta'}</h3>
                            <button onClick={() => setModal(null)}><X className="h-5 w-5 text-surface-400" /></button>
                        </div>
                        <form onSubmit={e => {
                            e.preventDefault()
                            const fd = new FormData(e.currentTarget)
                            saveMut.mutate({
                                id: modal.account?.id,
                                code: fd.get('code'),
                                name: fd.get('name'),
                                type: fd.get('type'),
                                parent_id: fd.get('parent_id') || null,
                            })
                        }} className="mt-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-surface-700">Código</label>
                                    <input name="code" required defaultValue={modal.account?.code} placeholder="1.01.01" className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-surface-700">Tipo</label>
                                    <select name="type" required defaultValue={modal.account?.type ?? 'asset'} className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                        {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-surface-700">Nome</label>
                                <input name="name" required defaultValue={modal.account?.name} className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-surface-700">Conta Pai (opcional)</label>
                                <select name="parent_id" defaultValue={modal.account?.parent_id ?? ''} className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                    <option value="">— Nenhuma (raiz) —</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-xl border border-surface-300 px-4 py-2 text-sm font-medium">Cancelar</button>
                                <button type="submit" disabled={saveMut.isPending}
                                    className="flex-1 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                                    {saveMut.isPending ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
