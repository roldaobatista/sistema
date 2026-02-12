import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

interface PaymentMethod {
    id: number
    name: string
    code: string | null
    is_active: boolean
}

interface ApiErrorLike {
    response?: {
        data?: {
            message?: string
        }
    }
}

const emptyForm = { name: '', code: '', is_active: true }

export function PaymentMethodsPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<PaymentMethod | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null)
    const [form, setForm] = useState(emptyForm)

    const isSuperAdmin = hasRole('super_admin')
    const canCreate = isSuperAdmin || hasPermission('finance.payable.create')
    const canUpdate = isSuperAdmin || hasPermission('finance.payable.update')
    const canDelete = isSuperAdmin || hasPermission('finance.payable.delete')

    const { data: res, isLoading, isError } = useQuery({
        queryKey: ['payment-methods'],
        queryFn: () => api.get('/payment-methods'),
    })
    const methods: PaymentMethod[] = res?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing ? api.put(`/payment-methods/${editing.id}`, data) : api.post('/payment-methods', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['payment-methods'] })
            setShowForm(false)
            setEditing(null)
            toast.success(editing ? 'Forma atualizada com sucesso.' : 'Forma criada com sucesso.')
        },
        onError: (err: unknown) => {
            const message = (err as ApiErrorLike | undefined)?.response?.data?.message ?? 'Falha ao salvar forma de pagamento.'
            toast.error(message)
        },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/payment-methods/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['payment-methods'] })
            setDeleteTarget(null)
            toast.success('Forma excluida com sucesso.')
        },
        onError: (err: unknown) => {
            const message = (err as ApiErrorLike | undefined)?.response?.data?.message ?? 'Falha ao excluir forma de pagamento.'
            toast.error(message)
        },
    })

    const openCreate = () => {
        if (!canCreate) {
            toast.error('Sem permissao para criar forma de pagamento.')
            return
        }
        setEditing(null)
        setForm(emptyForm)
        setShowForm(true)
    }

    const openEdit = (method: PaymentMethod) => {
        if (!canUpdate) {
            toast.error('Sem permissao para editar forma de pagamento.')
            return
        }
        setEditing(method)
        setForm({ name: method.name, code: method.code ?? '', is_active: method.is_active })
        setShowForm(true)
    }

    const openDelete = (method: PaymentMethod) => {
        if (!canDelete) {
            toast.error('Sem permissao para excluir forma de pagamento.')
            return
        }
        setDeleteTarget(method)
    }

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Formas de Pagamento</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Metodos de pagamento configuraveis</p>
                </div>
                {canCreate && (
                    <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nova Forma</Button>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <p className="col-span-full py-12 text-center text-[13px] text-surface-500">Carregando...</p>
                ) : isError ? (
                    <p className="col-span-full py-12 text-center text-[13px] text-red-600">Nao foi possivel carregar as formas de pagamento.</p>
                ) : methods.length === 0 ? (
                    <p className="col-span-full py-12 text-center text-[13px] text-surface-500">Nenhuma forma cadastrada</p>
                ) : methods.map(method => (
                    <div key={method.id} className="flex items-center justify-between rounded-xl border border-default bg-surface-0 p-4 shadow-card transition-shadow hover:shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
                                <CreditCard className="h-5 w-5 text-sky-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-surface-900">{method.name}</p>
                                {method.code && <p className="text-xs text-surface-400">Codigo: {method.code}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={method.is_active ? 'success' : 'danger'}>
                                {method.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                            {canUpdate && (
                                <Button variant="ghost" size="sm" onClick={() => openEdit(method)}><Pencil className="h-4 w-4" /></Button>
                            )}
                            {canDelete && (
                                <Button variant="ghost" size="sm" onClick={() => openDelete(method)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}>
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <Input label="Nome" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} required placeholder="Ex: PIX, Boleto, Cartao..." />
                    <Input label="Codigo" value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('code', e.target.value)} placeholder="Codigo interno (opcional)" />
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="pm-active" checked={form.is_active}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                        <label htmlFor="pm-active" className="text-sm text-surface-700">Ativo</label>
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => { setShowForm(false); setEditing(null) }}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir Forma de Pagamento">
                <div className="space-y-4">
                    <p className="text-[13px] text-surface-600">Tem certeza que deseja excluir {deleteTarget?.name}?</p>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="danger" loading={delMut.isPending} onClick={() => { if (deleteTarget) delMut.mutate(deleteTarget.id) }}>Excluir</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
