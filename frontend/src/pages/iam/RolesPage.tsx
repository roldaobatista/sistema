import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Shield, Trash2, Copy, ShieldOff, Pencil } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface Permission {
    id: number
    name: string
}

interface PermissionGroup {
    id: number
    name: string
    permissions: Permission[]
}

interface Role {
    id: number
    name: string
    display_name: string | null
    label: string
    description: string | null
    permissions_count: number
    users_count: number
    permissions?: Permission[]
}

export function RolesPage() {
    const queryClient = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('iam.role.create')
    const canUpdate = hasPermission('iam.role.update')
    const canDelete = hasPermission('iam.role.delete')
    const [showForm, setShowForm] = useState(false)
    const [editingRole, setEditingRole] = useState<Role | null>(null)
    const [roleName, setRoleName] = useState('')
    const [roleDisplayName, setRoleDisplayName] = useState('')
    const [roleDescription, setRoleDescription] = useState('')
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])
    const [loadingEditId, setLoadingEditId] = useState<number | null>(null)
    const [deleteConfirmRole, setDeleteConfirmRole] = useState<Role | null>(null)
    const [cloneRole, setCloneRole] = useState<Role | null>(null)
    const [cloneName, setCloneName] = useState('')

    const { data: rolesData, isLoading, isError, refetch } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles').then(r => r.data),
    })
    const roles: Role[] = rolesData?.data ?? rolesData ?? []

    const { data: permGroupsData } = useQuery({
        queryKey: ['permissions'],
        queryFn: () => api.get('/permissions').then(r => r.data),
    })
    const permissionGroups: PermissionGroup[] = Array.isArray(permGroupsData) ? permGroupsData : permGroupsData?.data ?? []

    const saveMutation = useMutation({
        mutationFn: (data: { name: string; display_name: string; description: string; permissions: number[] }) =>
            editingRole
                ? api.put(`/roles/${editingRole.id}`, data)
                : api.post('/roles', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] })
            setShowForm(false)
            toast.success(editingRole ? 'Role atualizada com sucesso!' : 'Role criada com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao salvar role.')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/roles/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] })
            setDeleteConfirmRole(null)
            toast.success('Role excluída com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao excluir role.')
        },
    })

    const cloneMutation = useMutation({
        mutationFn: ({ roleId, name }: { roleId: number; name: string }) =>
            api.post(`/roles/${roleId}/clone`, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] })
            setCloneRole(null)
            setCloneName('')
            toast.success('Role clonada com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao clonar role.')
        },
    })

    const handleCloneSubmit = () => {
        if (cloneRole && cloneName.trim()) {
            cloneMutation.mutate({ roleId: cloneRole.id, name: cloneName.trim() })
        }
    }

    const openCreate = () => {
        setEditingRole(null)
        setRoleName('')
        setRoleDisplayName('')
        setRoleDescription('')
        setSelectedPermissions([])
        setShowForm(true)
    }

    const openEdit = async (role: Role) => {
        setLoadingEditId(role.id)
        try {
            const { data } = await api.get(`/roles/${role.id}`)
            setEditingRole(data)
            setRoleName(data.name)
            setRoleDisplayName(data.display_name ?? '')
            setRoleDescription(data.description ?? '')
            setSelectedPermissions(data.permissions?.map((p: any) => p.id) ?? [])
            setShowForm(true)
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Erro ao carregar dados da role.')
        } finally {
            setLoadingEditId(null)
        }
    }

    const togglePermission = (id: number) => {
        setSelectedPermissions(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        )
    }

    const toggleGroup = (groupPerms: { id: number }[]) => {
        const ids = groupPerms.map(p => p.id)
        const allSelected = ids.every(id => selectedPermissions.includes(id))
        setSelectedPermissions(prev =>
            allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]
        )
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Roles"
                subtitle="Gerencie os perfis de acesso"
                count={roles.length}
                actions={canCreate ? [{ label: 'Nova Role', onClick: openCreate, icon: <Plus className="h-4 w-4" /> }] : []}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <>{[...Array(6)].map((_, i) => (
                        <div key={`sk-${i}`} className="rounded-xl border border-default bg-surface-0 p-5 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-surface-200" />
                                <div className="space-y-1.5">
                                    <div className="h-4 w-24 rounded bg-surface-200" />
                                    <div className="h-3 w-32 rounded bg-surface-200" />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="h-8 flex-1 rounded bg-surface-200" />
                                <div className="h-8 w-8 rounded bg-surface-200" />
                            </div>
                        </div>
                    ))}</>
                ) : isError ? (
                    <div className="col-span-full text-center py-12">
                        <p className="text-sm text-red-500">Erro ao carregar roles.</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button>
                    </div>
                ) : roles.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={<ShieldOff className="h-5 w-5 text-surface-300" />}
                            message="Nenhuma role encontrada. Crie a primeira role para definir níveis de acesso."
                            action={canCreate ? { label: 'Nova Role', onClick: openCreate, icon: <Plus className="h-4 w-4" /> } : undefined}
                        />
                    </div>
                ) : roles.map((role) => (
                    <div
                        key={role.id}
                        className="group rounded-xl border border-default bg-surface-0 p-5 shadow-card hover:shadow-elevated transition-all duration-200"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-brand-50 p-2.5">
                                    <Shield className="h-5 w-5 text-brand-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-surface-900">{role.display_name || role.label || role.name}</h3>
                                    <div className="mt-1 flex gap-3 text-xs text-surface-500">
                                        <span>{role.permissions_count} permissões</span>
                                        <span>·</span>
                                        <span>{role.users_count ?? 0} usuário(s)</span>
                                    </div>
                                    {role.description && (
                                        <p className="mt-1.5 text-xs text-surface-500 line-clamp-2">{role.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                            {canCreate && !['super_admin', 'admin'].includes(role.name) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setCloneRole(role); setCloneName(`${role.name} (cópia)`) }}
                                    loading={cloneMutation.isPending}
                                    title="Clonar role"
                                >
                                    <Copy className="h-4 w-4 text-surface-500" />
                                </Button>
                            )}
                            {canUpdate && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEdit(role)}
                                    className="flex-1"
                                    disabled={role.name === 'super_admin' || loadingEditId === role.id}
                                    loading={loadingEditId === role.id}
                                >
                                    {role.name === 'super_admin' ? 'Protegida' : loadingEditId === role.id ? 'Carregando...' : 'Editar'}
                                </Button>
                            )}
                            {canDelete && !['super_admin', 'admin'].includes(role.name) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirmRole(role)}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                open={showForm}
                onOpenChange={setShowForm}
                title={editingRole ? `Editar: ${editingRole.name}` : 'Nova Role'}
                size="xl"
            >
                <form
                    onSubmit={(e) => { e.preventDefault(); saveMutation.mutate({ name: roleName, display_name: roleDisplayName, description: roleDescription, permissions: selectedPermissions }) }}
                    className="space-y-4"
                >
                    <Input
                        label="Identificador (interno)"
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                        placeholder="ex: supervisor"
                        required
                        disabled={!!editingRole?.name && ['super_admin', 'admin'].includes(editingRole.name)}
                    />
                    <Input
                        label="Nome de Exibição"
                        value={roleDisplayName}
                        onChange={(e) => setRoleDisplayName(e.target.value)}
                        placeholder="ex: Supervisor de Campo"
                    />
                    <div>
                        <label className="mb-1 block text-sm font-medium text-surface-700">Descrição</label>
                        <textarea
                            value={roleDescription}
                            onChange={(e) => setRoleDescription(e.target.value)}
                            placeholder="Descrição do propósito desta role"
                            maxLength={500}
                            rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 resize-none"
                        />
                    </div>

                    <div>
                        <label className="mb-3 block text-sm font-semibold text-surface-900">Permissões</label>
                        <div className="max-h-96 overflow-y-auto space-y-4 rounded-lg border border-default p-4">
                            {permissionGroups.map((group: any) => (
                                <div key={group.id}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-medium uppercase tracking-wider text-surface-500">
                                            {group.name}
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.permissions)}
                                            className="text-xs text-brand-600 hover:text-brand-700"
                                        >
                                            {group.permissions.every((p: any) => selectedPermissions.includes(p.id)) ? 'Desmarcar' : 'Marcar'} todos
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.permissions.map((perm: any) => (
                                            <button
                                                key={perm.id}
                                                type="button"
                                                onClick={() => togglePermission(perm.id)}
                                                className={cn(
                                                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                                                    selectedPermissions.includes(perm.id)
                                                        ? 'border-brand-400 bg-brand-50 text-brand-700'
                                                        : 'border-default text-surface-500 hover:border-surface-400'
                                                )}
                                            >
                                                {perm.name.split('.').slice(1).join('.')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-surface-500">
                            {selectedPermissions.length} permissões selecionadas
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMutation.isPending}>
                            {editingRole ? 'Salvar' : 'Criar Role'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={!!deleteConfirmRole}
                onOpenChange={(open) => { if (!open) setDeleteConfirmRole(null) }}
                title="Confirmar Exclusão"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Tem certeza que deseja excluir a role <strong>{deleteConfirmRole?.name}</strong>?
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => setDeleteConfirmRole(null)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteConfirmRole && deleteMutation.mutate(deleteConfirmRole.id)}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!cloneRole}
                onOpenChange={(open) => { if (!open) { setCloneRole(null); setCloneName('') } }}
                title={`Clonar Role: ${cloneRole?.name ?? ''}`}
                size="sm"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">
                            Nome da nova role <span className="text-red-500">*</span>
                        </label>
                        <Input
                            value={cloneName}
                            onChange={(e) => setCloneName(e.target.value)}
                            placeholder="Ex: Gerente (cópia)"
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => { setCloneRole(null); setCloneName('') }}>
                            Cancelar
                        </Button>
                        <Button
                            loading={cloneMutation.isPending}
                            disabled={!cloneName.trim()}
                            onClick={handleCloneSubmit}
                        >
                            Clonar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
