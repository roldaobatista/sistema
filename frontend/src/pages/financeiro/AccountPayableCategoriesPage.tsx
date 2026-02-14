import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'

interface Category {
    id: number
    name: string
    color: string | null
    description: string | null
    is_active: boolean
}

interface ApiErrorLike {
    response?: {
        status?: number
        data?: {
            message?: string
            errors?: Record<string, string[]>
        }
    }
}

const presetColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
]

const emptyForm = {
    name: '',
    color: '#3b82f6',
    description: '',
}

export function AccountPayableCategoriesPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()

    const isSuperAdmin = hasRole('super_admin')
    const canCreate = isSuperAdmin || hasPermission('finance.payable.create')
    const canUpdate = isSuperAdmin || hasPermission('finance.payable.update')
    const canDelete = isSuperAdmin || hasPermission('finance.payable.delete')

    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
    const [form, setForm] = useState(emptyForm)

    const categoriesQuery = useQuery({
        queryKey: ['ap-categories'],
        queryFn: async () => {
            const { data } = await api.get<Category[]>('/account-payable-categories')
            return data
        },
    })
    const categories = categoriesQuery.data ?? []

    const saveMut = useMutation({
        mutationFn: async () => {
            const payload = {
                name: form.name.trim(),
                color: form.color,
                description: form.description.trim() || null,
            }

            if (editing) {
                await api.put(`/account-payable-categories/${editing.id}`, payload)
                return
            }

            await api.post('/account-payable-categories', payload)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['ap-categories'] })
            resetForm()
            toast.success(editing ? 'Categoria atualizada com sucesso' : 'Categoria criada com sucesso')
        },
        onError: (error: unknown) => {
            const status = (error as ApiErrorLike | undefined)?.response?.status
            const payload = (error as ApiErrorLike | undefined)?.response?.data

            if (status === 422 && payload?.errors) {
                setFormErrors(payload.errors)
                toast.error(payload.message ?? 'Verifique os campos obrigatorios')
                return
            }

            if (status === 403) {
                toast.error('Sem permissao para esta acao')
                return
            }

            toast.error(payload?.message ?? 'Erro ao salvar categoria')
        },
    })

    const deleteMut = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/account-payable-categories/${id}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['ap-categories'] })
            setDeleteTarget(null)
            toast.success('Categoria excluida com sucesso')
        },
        onError: (error: unknown) => {
            const status = (error as ApiErrorLike | undefined)?.response?.status
            const message = (error as ApiErrorLike | undefined)?.response?.data?.message
            if (status === 403) {
                toast.error('Sem permissao para excluir categoria')
                return
            }
            toast.error(message ?? 'Erro ao excluir categoria')
        },
    })

    const resetForm = () => {
        setShowForm(false)
        setEditing(null)
        setForm(emptyForm)
        setFormErrors({})
    }

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
        if (formErrors[key]) {
            setFormErrors((prev) => {
                const next = { ...prev }
                delete next[key]
                return next
            })
        }
    }

    const openCreate = () => {
        if (!canCreate) {
            toast.error('Sem permissao para criar categoria')
            return
        }
        setEditing(null)
        setForm(emptyForm)
        setFormErrors({})
        setShowForm(true)
    }

    const openEdit = (category: Category) => {
        if (!canUpdate) {
            toast.error('Sem permissao para editar categoria')
            return
        }
        setEditing(category)
        setForm({
            name: category.name,
            color: category.color ?? '#3b82f6',
            description: category.description ?? '',
        })
        setFormErrors({})
        setShowForm(true)
    }

    const openDelete = (category: Category) => {
        if (!canDelete) {
            toast.error('Sem permissao para excluir categoria')
            return
        }
        setDeleteTarget(category)
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Categorias de Contas a Pagar"
                subtitle="Gerencie as categorias de classificação"
                count={categories.length}
                actions={canCreate ? [{ label: 'Nova Categoria', onClick: openCreate, icon: <Plus className="h-4 w-4" /> }] : []}
            />

            {categoriesQuery.isLoading ? (
                <div className="py-12 text-center text-[13px] text-surface-500">Carregando...</div>
            ) : categoriesQuery.isError ? (
                <div className="py-12 text-center text-[13px] text-red-600">
                    Erro ao carregar categorias. <button className="underline" onClick={() => categoriesQuery.refetch()}>Tentar novamente</button>
                </div>
            ) : categories.length === 0 ? (
                <EmptyState icon={<Plus className="h-5 w-5 text-surface-300" />} message="Nenhuma categoria cadastrada" action={canCreate ? { label: 'Nova Categoria', onClick: openCreate, icon: <Plus className="h-4 w-4" /> } : undefined} />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {categories.map((category) => (
                        <div key={category.id} className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: category.color ?? '#e2e8f0' }} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-surface-900">{category.name}</p>
                                {category.description && <p className="truncate text-xs text-surface-500">{category.description}</p>}
                            </div>
                            <div className="flex gap-1">
                                {canUpdate && (
                                    <IconButton label="Editar" icon={<Edit className="h-3.5 w-3.5" />} onClick={() => openEdit(category)} className="hover:text-brand-600" />
                                )}
                                {canDelete && (
                                    <IconButton label="Excluir" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => openDelete(category)} className="hover:text-red-600" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Categoria' : 'Nova Categoria'}>
                <form onSubmit={(event) => { event.preventDefault(); saveMut.mutate() }} className="space-y-4">
                    <Input label="Nome *" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} error={formErrors.name?.[0]} required />
                    <Input label="Descricao" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('description', e.target.value)} error={formErrors.description?.[0]} />

                    <div>
                        <label className="mb-2 block text-[13px] font-medium text-surface-700">Cor</label>
                        <div className="flex flex-wrap gap-2">
                            {presetColors.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => set('color', color)}
                                    className={`h-8 w-8 rounded-full border-2 transition-transform ${form.color === color ? 'scale-110 border-surface-900' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={resetForm}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending} disabled={!form.name.trim()}>Salvar</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir Categoria">
                <div className="space-y-4">
                    <p className="text-[13px] text-surface-600">Tem certeza que deseja excluir a categoria {deleteTarget?.name}?</p>
                    <div className="flex justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="danger" loading={deleteMut.isPending} onClick={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id) }}>
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
