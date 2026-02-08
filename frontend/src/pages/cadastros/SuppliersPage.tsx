import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, Truck } from 'lucide-react'
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
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Supplier | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [showDetail, setShowDetail] = useState<Supplier | null>(null)

    const { data: res, isLoading } = useQuery({
        queryKey: ['suppliers', search],
        queryFn: () => api.get('/suppliers', { params: { search, per_page: 50 } }),
    })
    const suppliers: Supplier[] = res?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing ? api.put(`/suppliers/${editing.id}`, data) : api.post('/suppliers', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowForm(false) },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/suppliers/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Fornecedores</h1>
                    <p className="mt-1 text-sm text-surface-500">Cadastro de fornecedores e parceiros</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Novo Fornecedor</Button>
            </div>

            <div className="max-w-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        placeholder="Buscar por nome, CNPJ ou telefone..."
                        className="w-full rounded-lg border border-surface-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Fornecedor</th>
                            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 md:table-cell">Documento</th>
                            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 lg:table-cell">Contato</th>
                            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 lg:table-cell">Cidade/UF</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-surface-600">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {isLoading ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : suppliers.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum fornecedor encontrado</td></tr>
                        ) : suppliers.map(s => (
                            <tr key={s.id} className="hover:bg-surface-50 transition-colors cursor-pointer" onClick={() => setShowDetail(s)}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                                            <Truck className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-surface-900">{s.name}</p>
                                            {s.trade_name && <p className="text-xs text-surface-400">{s.trade_name}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="hidden px-4 py-3 text-sm text-surface-600 md:table-cell">
                                    {s.document || <span className="text-surface-400">—</span>}
                                </td>
                                <td className="hidden px-4 py-3 lg:table-cell">
                                    <div className="text-sm text-surface-600">{s.email || '—'}</div>
                                    <div className="text-xs text-surface-400">{s.phone || ''}</div>
                                </td>
                                <td className="hidden px-4 py-3 text-sm text-surface-600 lg:table-cell">
                                    {s.address_city ? `${s.address_city}/${s.address_state}` : '—'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <Badge variant={s.is_active ? 'success' : 'danger'}>
                                        {s.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir fornecedor?')) delMut.mutate(s.id) }}>
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
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo</label>
                            <select value={form.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('type', e.target.value as 'PF' | 'PJ')}
                                aria-label="Tipo de pessoa"
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
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
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Observações</label>
                        <textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('notes', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="sup-active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                        <label htmlFor="sup-active" className="text-sm text-surface-700">Ativo</label>
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-surface-200 pt-4">
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
                            <div className="border-t border-surface-200 pt-3">
                                <span className="text-xs text-surface-500">Endereço</span>
                                <p className="text-sm font-medium">
                                    {[showDetail.address_street, showDetail.address_number, showDetail.address_complement].filter(Boolean).join(', ')}
                                </p>
                                <p className="text-sm text-surface-600">
                                    {[showDetail.address_neighborhood, showDetail.address_city, showDetail.address_state].filter(Boolean).join(' — ')} {showDetail.address_zip && `• CEP ${showDetail.address_zip}`}
                                </p>
                            </div>
                        )}
                        {showDetail.notes && (
                            <div className="border-t border-surface-200 pt-3">
                                <span className="text-xs text-surface-500">Observações</span>
                                <p className="text-sm whitespace-pre-wrap">{showDetail.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
