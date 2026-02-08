import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Building2, Plus, Pencil, Trash2, Phone, Mail, MapPin, X, Check,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState(emptyForm)

    const { data: res, isLoading } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.get('/branches'),
    })
    const branches: Branch[] = res?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof emptyForm) =>
            editingId ? api.put(`/branches/${editingId}`, data) : api.post('/branches', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); closeModal() },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/branches/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
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
        <div className="space-y-6 animate-fade-in">
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

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Filiais</h1>
                    <p className="text-sm text-surface-500">{branches.length} filiais cadastradas</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>Nova Filial</Button>
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
                        <div key={b.id} className={`animate-slide-up stagger-${Math.min(i + 1, 6)} rounded-xl border border-surface-200 bg-white p-5 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200`}>
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
                                    <button onClick={() => openEdit(b)} title="Editar" className="rounded-md p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => { if (confirm(`Remover filial "${b.name}"?`)) deleteMut.mutate(b.id) }}
                                        title="Excluir" className="rounded-md p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-500">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
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
        </div>
    )
}
