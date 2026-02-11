import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Building2, Plus, Pencil, Trash2, Phone, Mail, MapPin, X, Check,
    AlertTriangle, XCircle, Search, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface Branch {
    id: number
    name: string
    code: string | null
    address_street: string | null
    address_number: string | null
    address_complement: string | null
    address_neighborhood: string | null
    address_city: string | null
    address_state: string | null
    address_zip: string | null
    phone: string | null
    email: string | null
}

const emptyForm = {
    name: '', code: '',
    address_street: '', address_number: '', address_complement: '',
    address_neighborhood: '', address_city: '', address_state: '', address_zip: '',
    phone: '', email: '',
}

export function BranchesPage() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [showConfirmDelete, setShowConfirmDelete] = useState<Branch | null>(null)
    const [deleteDependencies, setDeleteDependencies] = useState<any>(null)
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    const canCreate = hasPermission('platform.branch.create')
    const canUpdate = hasPermission('platform.branch.update')
    const canDelete = hasPermission('platform.branch.delete')

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.get('/branches'),
    })
    const allBranches: Branch[] = res?.data ?? []
    const branches = allBranches.filter(b => {
        const term = search.toLowerCase()
        return b.name.toLowerCase().includes(term) ||
            (b.code ?? '').toLowerCase().includes(term) ||
            (b.address_city ?? '').toLowerCase().includes(term)
    })

    const saveMut = useMutation({
        mutationFn: (data: typeof emptyForm) => {
            const sanitized = Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
            )
            return editingId ? api.put(`/branches/${editingId}`, sanitized) : api.post('/branches', sanitized)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['branches'] })
            closeModal()
            toast.success(editingId ? 'Filial atualizada com sucesso!' : 'Filial criada com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao salvar filial.')
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/branches/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['branches'] })
            setShowConfirmDelete(null)
            toast.success('Filial excluída com sucesso!')
        },
        onError: (err: any) => {
            if (err.response?.status === 409 || err.response?.status === 422) {
                setDeleteDependencies(err.response.data.dependencies)
                setDeleteMessage(err.response.data.message)
            } else {
                toast.error(err.response?.data?.message ?? 'Erro ao excluir filial.')
                setShowConfirmDelete(null)
            }
        },
    })

    function openNew() {
        setEditingId(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    function openEdit(b: Branch) {
        setEditingId(b.id)
        setForm({
            name: b.name, code: b.code ?? '',
            address_street: b.address_street ?? '', address_number: b.address_number ?? '',
            address_complement: b.address_complement ?? '', address_neighborhood: b.address_neighborhood ?? '',
            address_city: b.address_city ?? '', address_state: b.address_state ?? '',
            address_zip: b.address_zip ?? '', phone: b.phone ?? '', email: b.email ?? '',
        })
        setShowModal(true)
    }

    function closeModal() { setShowModal(false); setEditingId(null) }

    const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value }))

    if (isLoading) return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <div className="skeleton h-7 w-32" />
                    <div className="skeleton mt-2 h-4 w-48" />
                </div>
                <div className="skeleton h-9 w-28" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
            </div>
        </div>
    )

    if (isError) return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <XCircle className="h-12 w-12 text-red-400 mb-3" />
            <p className="text-sm font-medium text-surface-700">Erro ao carregar filiais</p>
            <p className="text-xs text-surface-400 mt-1">Não foi possível buscar os dados. Tente novamente.</p>
            <Button variant="outline" className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={() => refetch()}>Tentar Novamente</Button>
        </div>
    )

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Filiais</h1>
                    <p className="text-[13px] text-surface-500">{allBranches.length} filiais cadastradas</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                        <input
                            type="text"
                            placeholder="Buscar filial..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-9 w-56 rounded-lg border border-surface-200 bg-surface-0 pl-9 pr-3 text-sm text-surface-700 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>
                    {canCreate && <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>Nova Filial</Button>}
                </div>
            </div>

            {branches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 py-16 text-center">
                    <Building2 className="mx-auto mb-3 h-10 w-10 text-surface-300" />
                    <p className="text-sm font-medium text-surface-500">Nenhuma filial cadastrada</p>
                    <p className="mt-1 text-xs text-surface-400">Crie sua primeira filial para começar</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {branches.map((b, i) => (
                        <div key={b.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)} rounded-xl border border-default bg-surface-0 p-5 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                                        <Building2 className="h-5 w-5 text-brand-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-surface-900">{b.name}</h3>
                                        {b.code && <span className="text-xs text-surface-400 font-mono">{b.code}</span>}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {canUpdate && (
                                        <button onClick={() => openEdit(b)} title="Editar" className="rounded-md p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button onClick={() => {
                                            setShowConfirmDelete(b)
                                            setDeleteDependencies(null)
                                            setDeleteMessage(null)
                                        }}
                                            disabled={deleteMut.isPending}
                                            title="Excluir" className="rounded-md p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5 text-xs text-surface-500">
                                {b.address_city && (
                                    <p className="flex items-center gap-1.5">
                                        <MapPin className="h-3 w-3" />
                                        {b.address_street && `${b.address_street}, ${b.address_number || 'S/N'} — `}
                                        {b.address_city}/{b.address_state}
                                    </p>
                                )}
                                {b.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{b.phone}</p>}
                                {b.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{b.email}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showModal} onOpenChange={setShowModal} title={editingId ? 'Editar Filial' : 'Nova Filial'} size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Nome *" value={form.name} onChange={set('name')} required />
                        <Input label="Código" value={form.code} onChange={set('code')} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2"><Input label="Rua" value={form.address_street} onChange={set('address_street')} /></div>
                        <Input label="Número" value={form.address_number} onChange={set('address_number')} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Input label="Complemento" value={form.address_complement} onChange={set('address_complement')} />
                        <Input label="Bairro" value={form.address_neighborhood} onChange={set('address_neighborhood')} />
                        <Input label="CEP" value={form.address_zip} onChange={set('address_zip')} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Input label="Cidade" value={form.address_city} onChange={set('address_city')} />
                        <Input label="UF" value={form.address_state} onChange={set('address_state')} maxLength={2} />
                        <Input label="Telefone" value={form.phone} onChange={set('phone')} />
                    </div>
                    <Input label="E-mail" type="email" value={form.email} onChange={set('email')} />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={closeModal}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editingId ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Confirm Delete Modal */}
            {showConfirmDelete && (
                <Modal open={!!showConfirmDelete} onOpenChange={() => setShowConfirmDelete(null)} size="sm" title="Excluir Filial">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-medium text-surface-900">Tem certeza?</h3>
                                <p className="text-sm text-surface-500">
                                    Deseja realmente excluir <strong>{showConfirmDelete.name}</strong>?
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
                                            <span className="text-surface-600 capitalize">{key.replace('_', ' ')}</span>
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
                                    onClick={() => deleteMut.mutate(showConfirmDelete.id)}>
                                    Excluir Filial
                                </Button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
