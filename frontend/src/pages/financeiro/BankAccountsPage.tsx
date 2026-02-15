import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Building2, Plus, Pencil, Trash2, Search, CheckCircle, XCircle,
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
    agency: string | null
    account_number: string | null
    account_type: string
    pix_key: string | null
    balance: string
    is_active: boolean
    creator?: { id: number; name: string }
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    corrente: 'Conta Corrente',
    poupanca: 'Poupança',
    pagamento: 'Conta Pagamento',
}

const emptyForm = {
    name: '', bank_name: '', agency: '', account_number: '',
    account_type: 'corrente', pix_key: '', balance: '', is_active: true,
}

export function BankAccountsPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')
    const canCreate = isSuperAdmin || hasPermission('financial.bank_account.create')
    const canUpdate = isSuperAdmin || hasPermission('financial.bank_account.update')
    const canDelete = isSuperAdmin || hasPermission('financial.bank_account.delete')

    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<BankAccount | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null)

    const { data: accountsRes, isLoading } = useQuery({
        queryKey: ['bank-accounts', search],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/bank-accounts', { params: { search: search || undefined } }),
    })

    const accounts: BankAccount[] = accountsRes?.data ?? []

    const storeMut = useMutation({
        mutationFn: (data: typeof emptyForm) => api.post('/bank-accounts', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bank-accounts'] })
            setShowModal(false)
            toast.success('Conta bancária criada com sucesso')
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao criar conta')
        },
    })

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: typeof emptyForm }) => api.put(`/bank-accounts/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bank-accounts'] })
            setShowModal(false)
            setEditing(null)
            toast.success('Conta bancária atualizada com sucesso')
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao atualizar conta')
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/bank-accounts/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bank-accounts'] })
            setDeleteTarget(null)
            toast.success('Conta bancária excluída')
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao excluir conta')
        },
    })

    const openCreate = () => {
        setEditing(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (acc: BankAccount) => {
        setEditing(acc)
        setForm({
            name: acc.name,
            bank_name: acc.bank_name,
            agency: acc.agency ?? '',
            account_number: acc.account_number ?? '',
            account_type: acc.account_type,
            pix_key: acc.pix_key ?? '',
            balance: acc.balance,
            is_active: acc.is_active,
        })
        setShowModal(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (editing) {
            updateMut.mutate({ id: editing.id, data: form })
        } else {
            storeMut.mutate(form)
        }
    }

    const formatBRL = (v: string | number) =>
        parseFloat(String(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const isSaving = storeMut.isPending || updateMut.isPending

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Contas Bancárias</h1>
                    <p className="text-[13px] text-surface-500">
                        {accounts.length} {accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}
                    </p>
                </div>
                {canCreate && (
                    <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>Nova Conta</Button>
                )}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                    type="text"
                    placeholder="Buscar por nome, banco ou conta..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-9 pr-3 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                {isLoading ? (
                    <div className="py-12 text-center text-sm text-surface-400">Carregando...</div>
                ) : accounts.length === 0 ? (
                    <div className="py-12 text-center">
                        <Building2 className="mx-auto h-10 w-10 text-surface-300" />
                        <p className="mt-2 text-sm text-surface-400">Nenhuma conta bancária encontrada</p>
                        {canCreate && (
                            <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                                Cadastrar primeira conta
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50/50">
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Nome</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Banco</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Agência / Conta</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">Tipo</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-600">PIX</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-600">Saldo</th>
                                    <th className="px-4 py-3 text-center font-medium text-surface-600">Status</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-600">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {accounts.map(acc => (
                                    <tr key={acc.id} className="hover:bg-surface-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-surface-800">{acc.name}</td>
                                        <td className="px-4 py-3 text-surface-600">{acc.bank_name}</td>
                                        <td className="px-4 py-3 text-surface-600 tabular-nums">
                                            {acc.agency && <span>AG {acc.agency}</span>}
                                            {acc.agency && acc.account_number && <span> / </span>}
                                            {acc.account_number && <span>CC {acc.account_number}</span>}
                                            {!acc.agency && !acc.account_number && <span className="text-surface-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-surface-600">{ACCOUNT_TYPE_LABELS[acc.account_type] ?? acc.account_type}</td>
                                        <td className="px-4 py-3 text-surface-600 text-xs font-mono">{acc.pix_key || <span className="text-surface-300">—</span>}</td>
                                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-800">{formatBRL(acc.balance)}</td>
                                        <td className="px-4 py-3 text-center">
                                            {acc.is_active ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                    <CheckCircle className="h-3 w-3" /> Ativa
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                                    <XCircle className="h-3 w-3" /> Inativa
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                {canUpdate && (
                                                    <button onClick={() => openEdit(acc)} className="rounded-md p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600 transition-colors"
                                                        title="Editar">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => setDeleteTarget(acc)} className="rounded-md p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        title="Excluir">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal open={showModal} onOpenChange={setShowModal} title={editing ? 'Editar Conta Bancária' : 'Nova Conta Bancária'} size="md">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Nome *" value={form.name} required
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Ex: Bradesco AG 1234" />
                        <Input label="Banco *" value={form.bank_name} required
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, bank_name: e.target.value }))}
                            placeholder="Ex: Bradesco" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="Agência" value={form.agency}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, agency: e.target.value }))} />
                        <Input label="Número da Conta" value={form.account_number}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, account_number: e.target.value }))} />
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Tipo *</label>
                            <select value={form.account_type} required
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, account_type: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="corrente">Conta Corrente</option>
                                <option value="poupanca">Poupança</option>
                                <option value="pagamento">Conta Pagamento</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Chave PIX" value={form.pix_key}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, pix_key: e.target.value }))}
                            placeholder="CPF, e-mail, telefone..." />
                        <Input label="Saldo Inicial (R$)" type="number" step="0.01" min="0" value={form.balance}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, balance: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="is_active" checked={form.is_active}
                            onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                            className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500" />
                        <label htmlFor="is_active" className="text-sm text-surface-700">Conta ativa</label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={isSaving}>{editing ? 'Salvar Alterações' : 'Criar Conta'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirm */}
            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir Conta Bancária" size="sm">
                <p className="text-sm text-surface-600">
                    Tem certeza que deseja excluir a conta <strong>{deleteTarget?.name}</strong>?
                    Esta ação não pode ser desfeita.
                </p>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                    <Button className="bg-red-600 hover:bg-red-700" loading={deleteMut.isPending}
                        onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
                        Excluir
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
