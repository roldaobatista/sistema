import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi, type CrmTerritory } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogBody, DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { TableSkeleton } from '@/components/ui/tableskeleton'
import { toast } from 'sonner'
import {
    MapPin, Plus, Pencil, Trash2, Users, Building2,
    Globe, Search, UserPlus, X,
} from 'lucide-react'

const EMPTY_TERRITORY: Partial<CrmTerritory> & { member_ids: number[] } = {
    name: '', description: '', regions: [], is_active: true, member_ids: [],
}

export function CrmTerritoriesPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Partial<CrmTerritory> & { member_ids: number[] }>(EMPTY_TERRITORY)
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [regionInput, setRegionInput] = useState('')
    const [memberIdInput, setMemberIdInput] = useState('')

    const { data: territories = [], isLoading, isError, refetch } = useQuery({
        queryKey: ['crm-territories'],
        queryFn: async () => (await crmFeaturesApi.getTerritories()).data,
    })

    const saveMutation = useMutation({
        mutationFn: (data: Partial<CrmTerritory> & { member_ids?: number[] }) =>
            data.id
                ? crmFeaturesApi.updateTerritory(data.id, data)
                : crmFeaturesApi.createTerritory(data),
        onSuccess: () => {
            toast.success(editing.id ? 'Território atualizado com sucesso' : 'Território criado com sucesso')
            qc.invalidateQueries({ queryKey: ['crm-territories'] })
            closeDialog()
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao salvar território')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => crmFeaturesApi.deleteTerritory(id),
        onSuccess: () => {
            toast.success('Território excluído com sucesso')
            qc.invalidateQueries({ queryKey: ['crm-territories'] })
            setDeleteTarget(null)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao excluir território')
            setDeleteTarget(null)
        },
    })

    function closeDialog() {
        setDialogOpen(false)
        setEditing(EMPTY_TERRITORY)
        setRegionInput('')
        setMemberIdInput('')
    }

    function openEdit(territory: CrmTerritory) {
        setEditing({
            ...territory,
            member_ids: territory.members?.map(m => m.user_id) ?? [],
        })
        setDialogOpen(true)
    }

    function addRegion() {
        const trimmed = regionInput.trim()
        if (!trimmed) return
        const current = editing.regions ?? []
        if (current.includes(trimmed)) {
            toast.error('Região já adicionada')
            return
        }
        setEditing(prev => ({ ...prev, regions: [...(prev.regions ?? []), trimmed] }))
        setRegionInput('')
    }

    function removeRegion(region: string) {
        setEditing(prev => ({ ...prev, regions: (prev.regions ?? []).filter(r => r !== region) }))
    }

    function addMemberId() {
        const id = Number(memberIdInput)
        if (!id || isNaN(id)) {
            toast.error('Informe um ID de usuário válido')
            return
        }
        if (editing.member_ids.includes(id)) {
            toast.error('Membro já adicionado')
            return
        }
        setEditing(prev => ({ ...prev, member_ids: [...prev.member_ids, id] }))
        setMemberIdInput('')
    }

    function removeMemberId(id: number) {
        setEditing(prev => ({ ...prev, member_ids: prev.member_ids.filter(m => m !== id) }))
    }

    function handleSave() {
        if (!editing.name?.trim()) {
            toast.error('Informe o nome do território')
            return
        }
        saveMutation.mutate({
            ...editing,
            regions: editing.regions?.length ? editing.regions : null,
        })
    }

    const filtered = territories.filter(t =>
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.regions?.some(r => r.toLowerCase().includes(search.toLowerCase()))
    )

    const totalCustomers = territories.reduce((acc, t) => acc + (t.customers_count ?? 0), 0)
    const totalMembers = territories.reduce((acc, t) => acc + (t.members?.length ?? 0), 0)

    return (
        <div className="space-y-6">
            <PageHeader
                title="Territórios"
                subtitle="Gestão de territórios e áreas de atuação"
                icon={MapPin}
                count={territories.length}
                actions={[{
                    label: 'Novo Território',
                    onClick: () => { setEditing(EMPTY_TERRITORY); setDialogOpen(true) },
                    icon: <Plus className="h-4 w-4" />,
                }]}
            />

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                                <Globe className="h-5 w-5 text-brand-600" />
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">Territórios Ativos</p>
                                <p className="text-xl font-bold text-surface-900">
                                    {territories.filter(t => t.is_active).length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
                                <Users className="h-5 w-5 text-sky-600" />
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">Total de Membros</p>
                                <p className="text-xl font-bold text-surface-900">{totalMembers}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                                <Building2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">Clientes Atribuídos</p>
                                <p className="text-xl font-bold text-surface-900">{totalCustomers}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                <Input
                    placeholder="Buscar território ou região..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8"
                />
            </div>

            {/* Territory List */}
            {isLoading && (
                <Card>
                    <CardContent className="pt-5">
                        <TableSkeleton rows={5} cols={4} />
                    </CardContent>
                </Card>
            )}

            {isError && (
                <Card>
                    <CardContent className="pt-5">
                        <EmptyState
                            title="Erro ao carregar territórios"
                            message="Não foi possível carregar os territórios."
                            action={{ label: 'Tentar novamente', onClick: () => refetch() }}
                        />
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && filtered.length === 0 && (
                <Card>
                    <CardContent className="pt-5">
                        <EmptyState
                            title={search ? 'Nenhum resultado' : 'Nenhum território cadastrado'}
                            message={search ? 'Nenhum território corresponde à sua busca.' : 'Crie seu primeiro território para organizar áreas de atuação.'}
                            action={!search ? { label: 'Novo Território', onClick: () => { setEditing(EMPTY_TERRITORY); setDialogOpen(true) } } : undefined}
                        />
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && filtered.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map(territory => (
                        <Card key={territory.id} className="hover:border-brand-200 transition-colors">
                            <CardContent className="pt-5">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-surface-900 truncate">{territory.name}</h3>
                                            <Badge variant={territory.is_active ? 'success' : 'default'} size="xs">
                                                {territory.is_active ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </div>
                                        {territory.description && (
                                            <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{territory.description}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Regions */}
                                {territory.regions && territory.regions.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        {territory.regions.map(region => (
                                            <Badge key={region} variant="info" size="xs">{region}</Badge>
                                        ))}
                                    </div>
                                )}

                                {/* Stats */}
                                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-subtle">
                                    <div className="flex items-center gap-1 text-xs text-surface-500">
                                        <Users className="h-3.5 w-3.5" />
                                        <span>{territory.members?.length ?? 0} membros</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-surface-500">
                                        <Building2 className="h-3.5 w-3.5" />
                                        <span>{territory.customers_count ?? 0} clientes</span>
                                    </div>
                                    {territory.manager && (
                                        <div className="flex items-center gap-1 text-xs text-surface-500">
                                            <UserPlus className="h-3.5 w-3.5" />
                                            <span>{territory.manager.name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Members */}
                                {territory.members && territory.members.length > 0 && (
                                    <div className="mt-2.5">
                                        <p className="text-[11px] font-medium text-surface-400 uppercase tracking-wider mb-1">Membros</p>
                                        <div className="flex flex-wrap gap-1">
                                            {territory.members.slice(0, 5).map(member => (
                                                <Badge key={member.id} variant="default" size="xs">
                                                    {member.user?.name ?? `Usuário #${member.user_id}`}
                                                </Badge>
                                            ))}
                                            {territory.members.length > 5 && (
                                                <Badge variant="default" size="xs">+{territory.members.length - 5}</Badge>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-1 mt-3">
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(territory)}>
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(territory.id)}>
                                        <Trash2 className="h-3.5 w-3.5 text-red-500 mr-1" /> Excluir
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog() }}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>{editing.id ? 'Editar Território' : 'Novo Território'}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                        <Input
                            label="Nome *"
                            placeholder="Ex: Região Sul"
                            value={editing.name ?? ''}
                            onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <Textarea
                            label="Descrição"
                            placeholder="Descreva a abrangência deste território..."
                            value={editing.description ?? ''}
                            onChange={e => setEditing(prev => ({ ...prev, description: e.target.value }))}
                        />

                        {/* Regions */}
                        <div>
                            <label className="block text-[13px] font-medium text-surface-700 mb-1.5">Regiões</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ex: São Paulo, Paraná..."
                                    value={regionInput}
                                    onChange={e => setRegionInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRegion() } }}
                                />
                                <Button variant="outline" onClick={addRegion} className="shrink-0">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            {(editing.regions?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {editing.regions!.map(region => (
                                        <Badge key={region} variant="info" size="sm" className="gap-1">
                                            {region}
                                            <button type="button" onClick={() => removeRegion(region)} className="hover:text-red-600">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Members */}
                        <div>
                            <label className="block text-[13px] font-medium text-surface-700 mb-1.5">Membros (IDs de Usuários)</label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="ID do usuário"
                                    value={memberIdInput}
                                    onChange={e => setMemberIdInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMemberId() } }}
                                />
                                <Button variant="outline" onClick={addMemberId} className="shrink-0">
                                    <UserPlus className="h-4 w-4" />
                                </Button>
                            </div>
                            {editing.member_ids.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {editing.member_ids.map(id => {
                                        const existingMember = editing.id
                                            ? (editing as CrmTerritory).members?.find(m => m.user_id === id)
                                            : null
                                        return (
                                            <Badge key={id} variant="default" size="sm" className="gap-1">
                                                {existingMember?.user?.name ?? `Usuário #${id}`}
                                                <button type="button" onClick={() => removeMemberId(id)} className="hover:text-red-600">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Excluir Território</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <p className="text-sm text-surface-600">
                            Tem certeza que deseja excluir este território? Todos os membros e atribuições de clientes serão removidos. Esta ação não pode ser desfeita.
                        </p>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
