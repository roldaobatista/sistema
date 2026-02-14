import { useState } from 'react'
import { Plus, Search, Filter, Trash2, Edit, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useBenefits, EmployeeBenefit } from '@/hooks/useBenefits'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { format } from 'date-fns'

export default function BenefitsPage() {
  const { hasPermission } = useAuthStore()

    const { user } = useAuthStore()
    const [searchTerm, setSearchTerm] = useState('')
    const { benefits: rawBenefits, isLoading, createBenefit, updateBenefit, deleteBenefit } = useBenefits()
    const benefits = rawBenefits as EmployeeBenefit[]
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingBenefit, setEditingBenefit] = useState<EmployeeBenefit | null>(null)
    const [formData, setFormData] = useState<Partial<EmployeeBenefit>>({
        type: 'vt',
        value: 0,
        employee_contribution: 0,
        is_active: true
    })

    const filteredBenefits = benefits?.filter((b: EmployeeBenefit) =>
        b.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.provider?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalCost = filteredBenefits?.reduce((acc: number, b: EmployeeBenefit) => acc + Number(b.value), 0) || 0
    const totalContribution = filteredBenefits?.reduce((acc: number, b: EmployeeBenefit) => acc + Number(b.employee_contribution), 0) || 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingBenefit) {
                await updateBenefit.mutateAsync({ id: editingBenefit.id, data: formData })
                toast.success('Benefício atualizado com sucesso!')
            } else {
                const resolvedUserId = formData.user_id ?? (user?.id != null ? String(user.id) : undefined)
                if (!resolvedUserId) {
                    toast.error('Usuário do benefício é obrigatório')
                    return
                }
                await createBenefit.mutateAsync({ ...formData, user_id: resolvedUserId })
                toast.success('Benefício criado com sucesso!')
            }
            setIsModalOpen(false)
            setFormData({ type: 'vt', value: 0, employee_contribution: 0, is_active: true })
            setEditingBenefit(null)
        } catch (error) {
            toast.error('Erro ao salvar benefício')
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este benefício?')) {
            try {
                await deleteBenefit.mutateAsync(id)
                toast.success('Benefício excluído com sucesso!')
            } catch (error) {
                toast.error('Erro ao excluir benefício')
            }
        }
    }

    const openEdit = (benefit: EmployeeBenefit) => {
        setEditingBenefit(benefit)
        setFormData(benefit)
        setIsModalOpen(true)
    }

    const getBenefitLabel = (type: string) => {
        const labels: Record<string, string> = {
            vt: 'Vale Transporte',
            vr: 'Vale Refeição',
            va: 'Vale Alimentação',
            health: 'Plano de Saúde',
            dental: 'Plano Odontológico',
            life_insurance: 'Seguro de Vida',
            other: 'Outros'
        }
        return labels[type] || type
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão de Benefícios</h1>
                    <p className="text-muted-foreground">Gerencie os benefícios dos colaboradores.</p>
                </div>
                <Button onClick={() => { setEditingBenefit(null); setFormData({ type: 'vt', value: 0, employee_contribution: 0, is_active: true }); setIsModalOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Benefício
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Custo Total Mensal</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCost)}
                        </div>
                        <p className="text-xs text-muted-foreground">Valor pago pela empresa</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Coparticipação</CardTitle>
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalContribution)}
                        </div>
                        <p className="text-xs text-muted-foreground">Descontado dos colaboradores</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Beneficiários</CardTitle>
                        <Filter className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{new Set(filteredBenefits?.map((b: EmployeeBenefit) => b.user_id)).size}</div>
                        <p className="text-xs text-muted-foreground">Colaboradores ativos com benefícios</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Benefícios Ativos</CardTitle>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nome ou tipo..."
                                    className="pl-8 w-[250px]"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-3 font-medium">Colaborador</th>
                                    <th className="p-3 font-medium">Tipo</th>
                                    <th className="p-3 font-medium">Fornecedor</th>
                                    <th className="p-3 font-medium">Valor</th>
                                    <th className="p-3 font-medium">Coparticipação</th>
                                    <th className="p-3 font-medium">Início</th>
                                    <th className="p-3 font-medium">Status</th>
                                    <th className="p-3 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {isLoading ? (
                                    <tr><td colSpan={8} className="p-4 text-center">Carregando...</td></tr>
                                ) : filteredBenefits?.length === 0 ? (
                                    <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhum benefício encontrado.</td></tr>
                                ) : (
                                    filteredBenefits?.map((benefit: EmployeeBenefit) => (
                                        <tr key={benefit.id} className="hover:bg-muted/50">
                                            <td className="p-3">{benefit.user?.name || '---'}</td>
                                            <td className="p-3 font-medium">{getBenefitLabel(benefit.type)}</td>
                                            <td className="p-3">{benefit.provider || '-'}</td>
                                            <td className="p-3 text-emerald-600 font-medium">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(benefit.value))}
                                            </td>
                                            <td className="p-3 text-red-600">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(benefit.employee_contribution))}
                                            </td>
                                            <td className="p-3">{format(new Date(benefit.start_date), 'dd/MM/yyyy')}</td>
                                            <td className="p-3">
                                                <Badge variant={benefit.is_active ? 'default' : 'secondary'}>
                                                    {benefit.is_active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(benefit)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(benefit.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingBenefit ? 'Editar Benefício' : 'Novo Benefício'}</DialogTitle>
                        <DialogDescription>Preencha os detalhes do benefício.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!editingBenefit && (
                            <div className="space-y-2">
                                <Label>ID do Usuário (Temp - use ID real)</Label>
                                <Input
                                    value={formData.user_id || ''}
                                    onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                                    placeholder="UUID do colaborador"
                                    required
                                />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <select
                                    aria-label="Tipo de benefício"
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                >
                                    <option value="vt">Vale Transporte</option>
                                    <option value="vr">Vale Refeição</option>
                                    <option value="va">Vale Alimentação</option>
                                    <option value="health">Plano de Saúde</option>
                                    <option value="dental">Plano Odontológico</option>
                                    <option value="life_insurance">Seguro de Vida</option>
                                    <option value="other">Outros</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Fornecedor</Label>
                                <Input value={formData.provider || ''} onChange={e => setFormData({ ...formData, provider: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Valor Empresa</Label>
                                <Input type="number" step="0.01" value={formData.value} onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Valor Coparticipação</Label>
                                <Input type="number" step="0.01" value={formData.employee_contribution} onChange={e => setFormData({ ...formData, employee_contribution: parseFloat(e.target.value) })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Data Início</Label>
                                <Input type="date" value={formData.start_date ? String(formData.start_date).split('T')[0] : ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Data Fim (Opcional)</Label>
                                <Input type="date" value={formData.end_date ? String(formData.end_date).split('T')[0] : ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} id="is_active" aria-label="Benefício ativo" />
                            <Label htmlFor="is_active">Ativo?</Label>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
