import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Tag, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { IconButton } from '@/components/ui/iconbutton'
import { ColorDot } from '@/components/ui/color-dot'

interface Category {
    id: number
    name: string
    color: string
    budget_limit?: number | string | null
    default_affects_net_value?: boolean
    default_affects_technician_cash?: boolean
    expenses_count?: number | null
}

interface ExpenseCategoryManagerProps {
    open: boolean
    onClose: () => void
    categories: Category[]
}

const emptyCatForm = {
    name: '',
    color: '#6b7280',
    budget_limit: '' as string,
    default_affects_net_value: false,
    default_affects_technician_cash: false,
}

export function ExpenseCategoryManager({ open, onClose, categories }: ExpenseCategoryManagerProps) {
    const qc = useQueryClient()
    const [showCatForm, setShowCatForm] = useState(false)
    const [editingCatId, setEditingCatId] = useState<number | null>(null)
    const [deleteCatTarget, setDeleteCatTarget] = useState<number | null>(null)
    const [catForm, setCatForm] = useState(emptyCatForm)

    const saveCatMut = useMutation({
        mutationFn: (data: typeof emptyCatForm) => {
            if (editingCatId) return api.put(`/expense-categories/${editingCatId}`, data)
            return api.post('/expense-categories', data)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expense-categories'] })
            broadcastQueryInvalidation(['expense-categories'], 'Despesa')
            setShowCatForm(false)
            setEditingCatId(null)
            toast.success(editingCatId ? 'Categoria atualizada com sucesso' : 'Categoria criada com sucesso')
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg ?? 'Erro ao salvar categoria')
        },
    })

    const delCatMut = useMutation({
        mutationFn: (id: number) => api.delete(`/expense-categories/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expense-categories'] })
            qc.invalidateQueries({ queryKey: ['expenses'] })
            broadcastQueryInvalidation(['expense-categories', 'expenses'], 'Despesa')
            setDeleteCatTarget(null)
            toast.success('Categoria excluída com sucesso')
        },
        onError: (err: unknown) => {
            setDeleteCatTarget(null)
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg ?? 'Erro ao excluir categoria')
        },
    })

    return (
        <>
            <Modal open={open} onOpenChange={onClose} title="Gerenciar Categorias" size="lg">
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => {
                            setEditingCatId(null)
                            setCatForm(emptyCatForm)
                            setShowCatForm(true)
                        }}>Nova Categoria</Button>
                    </div>
                    {categories.length === 0 ? (
                        <div className="py-8 text-center">
                            <Tag className="mx-auto h-8 w-8 text-surface-300" />
                            <p className="mt-2 text-sm text-surface-500">Nenhuma categoria criada</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-subtle rounded-lg border border-default">
                            {categories.map((c) => (
                                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <ColorDot color={c.color} size="md" />
                                        <span className="text-sm font-medium text-surface-800">{c.name}</span>
                                        {c.expenses_count != null && (
                                            <span className="text-xs text-surface-400">({c.expenses_count})</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <IconButton label="Editar categoria" icon={<Pencil className="h-3.5 w-3.5" />}
                                            onClick={() => {
                                                setEditingCatId(c.id)
                                                setCatForm({
                                                    name: c.name,
                                                    color: c.color,
                                                    budget_limit: String(c.budget_limit ?? ''),
                                                    default_affects_net_value: !!c.default_affects_net_value,
                                                    default_affects_technician_cash: !!c.default_affects_technician_cash,
                                                })
                                                setShowCatForm(true)
                                            }} className="hover:text-brand-600" />
                                        <IconButton label="Excluir categoria" icon={<Trash2 className="h-3.5 w-3.5" />}
                                            onClick={() => setDeleteCatTarget(c.id)} className="hover:text-red-600" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal open={showCatForm} onOpenChange={(v) => { setShowCatForm(v); if (!v) setEditingCatId(null) }}
                title={editingCatId ? 'Editar Categoria' : 'Nova Categoria de Despesa'}>
                <form onSubmit={e => { e.preventDefault(); saveCatMut.mutate(catForm) }} className="space-y-4">
                    <Input label="Nome *" value={catForm.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, name: e.target.value }))} required />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Cor</label>
                            <div className="flex items-center gap-3">
                                <input type="color" value={catForm.color}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, color: e.target.value }))}
                                    aria-label="Cor da categoria"
                                    className="h-10 w-14 cursor-pointer rounded-lg border border-default" />
                                <span className="text-sm text-surface-500">{catForm.color}</span>
                            </div>
                        </div>
                        <Input label="Limite orçamentário mensal (R$)" type="number" step="0.01" value={catForm.budget_limit}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, budget_limit: e.target.value }))}
                            placeholder="Sem limite" />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="cat_default_net" checked={catForm.default_affects_net_value}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, default_affects_net_value: e.target.checked }))}
                                className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500" />
                            <label htmlFor="cat_default_net" className="text-sm font-medium text-surface-700">Padrão: deduz do líquido</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="cat_default_cash" checked={catForm.default_affects_technician_cash}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, default_affects_technician_cash: e.target.checked }))}
                                className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500" />
                            <label htmlFor="cat_default_cash" className="text-sm font-medium text-surface-700">Padrão: impacta caixa técnico</label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => { setShowCatForm(false); setEditingCatId(null) }}>Cancelar</Button>
                        <Button type="submit" loading={saveCatMut.isPending} disabled={saveCatMut.isPending}>{editingCatId ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={deleteCatTarget !== null} onOpenChange={() => setDeleteCatTarget(null)} title="Excluir Categoria">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Tem certeza que deseja excluir esta categoria? Despesas vinculadas precisarão ser reclassificadas.</p>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setDeleteCatTarget(null)}>Cancelar</Button>
                        <Button className="bg-red-600 hover:bg-red-700" loading={delCatMut.isPending} disabled={delCatMut.isPending}
                            onClick={() => delCatMut.mutate(deleteCatTarget!)}>Excluir</Button>
                    </div>
                </div>
            </Modal>
        </>
    )
}
