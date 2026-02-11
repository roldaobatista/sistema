import React, { useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, Truck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface Supplier {
    id: number; type: 'PF' | 'PJ'; name: string; document: string | null
    trade_name: string | null; email: string | null; phone: string | null
    phone2: string | null; is_active: boolean; notes: string | null
    address_zip: string | null; address_street: string | null
    address_number: string | null; address_complement: string | null
    address_neighborhood: string | null; address_city: string | null
    address_state: string | null
}

const emptyForm = {
    type: 'PJ' as 'PF' | 'PJ', name: '', document: '', trade_name: '',
    email: '', phone: '', phone2: '',
    address_zip: '', address_street: '', address_number: '',
    address_complement: '', address_neighborhood: '',
    address_city: '', address_state: '',
    notes: '', is_active: true,
}

export function SuppliersPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 400)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Supplier | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [showDetail, setShowDetail] = useState<Supplier | null>(null)

    // Delete handling state
    const [showConfirmDelete, setShowConfirmDelete] = useState<Supplier | null>(null)
    const [deleteDependencies, setDeleteDependencies] = useState<any>(null)
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null)

    const { data: res, isLoading } = useQuery({
        queryKey: ['suppliers', debouncedSearch],
        queryFn: () => api.get('/suppliers', { params: { search: debouncedSearch, per_page: 50 } }),
    })
    const suppliers: Supplier[] = res?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing ? api.put(`/suppliers/${editing.id}`, data) : api.post('/suppliers', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['suppliers'] })
            setShowForm(false)
            toast.success(editing ? 'Fornecedor atualizado com sucesso!' : 'Fornecedor criado com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao salvar fornecedor.')
        }
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/suppliers/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['suppliers'] })
            setShowConfirmDelete(null)
            toast.success('Fornecedor excluído com sucesso!')
        },
        onError: (err: any) => {
            if (err.response?.status === 409 || err.response?.status === 422) {
                setDeleteDependencies(err.response.data.dependencies)
                setDeleteMessage(err.response.data.message)
            } else {
                toast.error(err.response?.data?.message ?? 'Erro ao excluir fornecedor.')
                setShowConfirmDelete(null)
            }
        },
    })

    const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
    const openEdit = (s: Supplier) => {
        setEditing(s)
        setForm({
            type: s.type ?? 'PJ', name: s.name, document: s.document ?? '',
            trade_name: s.trade_name ?? '', email: s.email ?? '',
            phone: s.phone ?? '', phone2: s.phone2 ?? '',
            address_zip: s.address_zip ?? '', address_street: s.address_street ?? '',
            address_number: s.address_number ?? '', address_complement: s.address_complement ?? '',
            address_neighborhood: s.address_neighborhood ?? '',
            address_city: s.address_city ?? '', address_state: s.address_state ?? '',
            notes: s.notes ?? '', is_active: s.is_active,
        })
        setShowForm(true)
    }

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    if (isLoading) return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <div className="skeleton h-7 w-32" />
                    <div className="skeleton mt-2 h-4 w-48" />
                </div>
                <div className="skeleton h-9 w-28" />
            </div>
            <div className="skeleton h-10 w-full max-w-md" />
            <div className="rounded-xl border border-surface-200 bg-surface-0 h-96"></div>
        </div>
    )

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900 tracking-tight">Fornecedores</h1>
                    <p className="mt-0.5 text-sm text-surface-500">Cadastro de fornecedores e parceiros</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Novo Fornecedor</Button>
            </div>

            <div className="max-w-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        placeholder="Buscar por nome, CNPJ ou telefone..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Fornecedor</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500 md:table-cell">Documento</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500 lg:table-cell">Contato</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500 lg:table-cell">Cidade/UF</th>
                            <th className="px-3.5 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-surface-500">Status</th>
                            <th className="px-3.5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-surface-500">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {suppliers.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhum fornecedor encontrado</td></tr>
                        ) : suppliers.map(s => (
                            <tr key={s.id} className="hover:bg-surface-50 transition-colors duration-100 cursor-pointer" onClick={() => setShowDetail(s)}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                                            <Truck className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-medium text-surface-900">{s.name}</p>
                                            {s.trade_name && <p className="text-xs text-surface-400">{s.trade_name}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="hidden px-4 py-3 text-[13px] text-surface-600 md:table-cell">
                                    {s.document || <span className="text-surface-400">—</span>}
                                </td>
                                <td className="hidden px-4 py-3 lg:table-cell">
                                    <div className="text-[13px] text-surface-600">{s.email || '—'}</div>
                                    <div className="text-xs text-surface-400">{s.phone || ''}</div>
                                </td>
                                <td className="hidden px-4 py-3 text-[13px] text-surface-600 lg:table-cell">
                                    {s.address_city ? `${s.address_city}/${s.address_state}` : '—'}
                                </td>
                                <td className="px-3.5 py-2.5 text-center">
                                    <Badge variant={s.is_active ? 'success' : 'danger'}>
                                        {s.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => {
                                            setShowConfirmDelete(s)
                                            setDeleteDependencies(null)
                                            setDeleteMessage(null)
                                        }}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Form Modal */}
            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Tipo</label>
                            <select value={form.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('type', e.target.value as 'PF' | 'PJ')}
                                aria-label="Tipo de pessoa"
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="PJ">Pessoa Jurídica</option>
                                <option value="PF">Pessoa Física</option>
                            </select>
                        </div>
                        <Input label={form.type === 'PJ' ? 'CNPJ' : 'CPF'} value={form.document} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('document', e.target.value)} />
                        <Input label={form.type === 'PJ' ? 'Razão Social' : 'Nome'} value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} required />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="Nome Fantasia" value={form.trade_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('trade_name', e.target.value)} />
                        <Input label="Email" type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('email', e.target.value)} />
                        <Input label="Telefone" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('phone', e.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <Input label="CEP" value={form.address_zip} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_zip', e.target.value)} />
                        <div className="sm:col-span-2">
                            <Input label="Rua" value={form.address_street} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_street', e.target.value)} />
                        </div>
                        <Input label="Número" value={form.address_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_number', e.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <Input label="Complemento" value={form.address_complement} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_complement', e.target.value)} />
                        <Input label="Bairro" value={form.address_neighborhood} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_neighborhood', e.target.value)} />
                        <Input label="Cidade" value={form.address_city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_city', e.target.value)} />
                        <Input label="UF" value={form.address_state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_state', e.target.value)} maxLength={2} />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Observações</label>
                        <textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('notes', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="sup-active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                        <label htmlFor="sup-active" className="text-sm text-surface-700">Ativo</label>
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Detail Modal */}
            <Modal open={!!showDetail} onOpenChange={() => setShowDetail(null)} title="Detalhes do Fornecedor" size="md">
                {showDetail && (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div><span className="text-xs text-surface-500">Tipo</span><p className="text-sm font-medium">{showDetail.type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p></div>
                            <div><span className="text-xs text-surface-500">Documento</span><p className="text-sm font-medium font-mono">{showDetail.document || '—'}</p></div>
                            <div><span className="text-xs text-surface-500">{showDetail.type === 'PJ' ? 'Razão Social' : 'Nome'}</span><p className="text-sm font-medium">{showDetail.name}</p></div>
                            <div><span className="text-xs text-surface-500">Nome Fantasia</span><p className="text-sm font-medium">{showDetail.trade_name ?? '—'}</p></div>
                            <div><span className="text-xs text-surface-500">E-mail</span><p className="text-sm font-medium">{showDetail.email ?? '—'}</p></div>
                            <div><span className="text-xs text-surface-500">Telefone</span><p className="text-sm font-medium">{showDetail.phone ?? '—'}</p></div>
                        </div>
                        {(showDetail.address_street || showDetail.address_city) && (
                            <div className="border-t border-subtle pt-3">
                                <span className="text-xs text-surface-500">Endereço</span>
                                <p className="text-sm font-medium">
                                    {[showDetail.address_street, showDetail.address_number, showDetail.address_complement].filter(Boolean).join(', ')}
                                </p>
                                <p className="text-[13px] text-surface-600">
                                    {[showDetail.address_neighborhood, showDetail.address_city, showDetail.address_state].filter(Boolean).join(' — ')} {showDetail.address_zip && `• CEP ${showDetail.address_zip}`}
                                </p>
                            </div>
                        )}
                        {showDetail.notes && (
                            <div className="border-t border-subtle pt-3">
                                <span className="text-xs text-surface-500">Observações</span>
                                <p className="text-sm whitespace-pre-wrap">{showDetail.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Confirm Delete Modal */}
            <Modal open={!!showConfirmDelete} onOpenChange={() => setShowConfirmDelete(null)} size="sm" title="Excluir Fornecedor">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-medium text-surface-900">Tem certeza?</h3>
                            <p className="text-sm text-surface-500">
                                Deseja realmente excluir <strong>{showConfirmDelete?.name}</strong>?
                            </p>
                        </div>
                    </div>

                    {deleteMessage && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
                            <p className="font-medium mb-1">Não é possível excluir:</p>
                            <p>{deleteMessage}</p>
                        </div>
                    )}

                    {deleteDependencies && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-surface-600 uppercase tracking-wide">Vínculos encontrados:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(deleteDependencies).map(([key, count]) => (
                                    <div key={key} className="flex items-center justify-between rounded bg-surface-50 px-3 py-2 text-sm border border-surface-100">
                                        <span className="text-surface-600 capitalize">{key.replace(/_/g, ' ')}</span>
                                        <Badge variant="neutral">{String(count)}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowConfirmDelete(null)}>Cancelar</Button>
                        {deleteDependencies ? (
                            <Button variant="ghost" disabled className="text-surface-400 cursor-not-allowed">
                                Resolva as pendências acima
                            </Button>
                        ) : (
                            <Button className="bg-red-600 hover:bg-red-700 text-white" loading={deleteMut.isPending}
                                onClick={() => showConfirmDelete && deleteMut.mutate(showConfirmDelete.id)}>
                                Excluir Fornecedor
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
