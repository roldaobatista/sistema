import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface PaymentMethod {
    id: number; name: string; code: string | null; is_active: boolean
}

const emptyForm = { name: '', code: '', is_active: true }

export function PaymentMethodsPage() {
    const qc = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<PaymentMethod | null>(null)
    const [form, setForm] = useState(emptyForm)

    const { data: res, isLoading } = useQuery({
        queryKey: ['payment-methods'],
        queryFn: () => api.get('/payment-methods'),
    })
    const methods: PaymentMethod[] = res?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing ? api.put(`/payment-methods/${editing.id}`, data) : api.post('/payment-methods', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); setShowForm(false) },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/payment-methods/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
    })

    const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
    const openEdit = (m: PaymentMethod) => {
        setEditing(m)
        setForm({ name: m.name, code: m.code ?? '', is_active: m.is_active })
        setShowForm(true)
    }

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Formas de Pagamento</h1>
                    <p className="mt-1 text-sm text-surface-500">Métodos de pagamento configuráveis</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nova Forma</Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <p className="col-span-full py-12 text-center text-sm text-surface-500">Carregando...</p>
                ) : methods.length === 0 ? (
                    <p className="col-span-full py-12 text-center text-sm text-surface-500">Nenhuma forma cadastrada</p>
                ) : methods.map(m => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl border border-surface-200 bg-white p-4 shadow-card transition-shadow hover:shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
                                <CreditCard className="h-5 w-5 text-sky-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-surface-900">{m.name}</p>
                                {m.code && <p className="text-xs text-surface-400">Código: {m.code}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={m.is_active ? 'success' : 'danger'}>
                                {m.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir?')) delMut.mutate(m.id) }}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}>
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <Input label="Nome" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} required placeholder="Ex: PIX, Boleto, Cartão..." />
                    <Input label="Código" value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('code', e.target.value)} placeholder="Código interno (opcional)" />
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="pm-active" checked={form.is_active}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                        <label htmlFor="pm-active" className="text-sm text-surface-700">Ativo</label>
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-surface-200 pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
