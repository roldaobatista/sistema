import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Shield, Users, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface Role {
    id: number
    name: string
    permissions_count: number
    users_count: number
    permissions?: { id: number; name: string }[]
}

export function RolesPage() {
    const queryClient = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [editingRole, setEditingRole] = useState<Role | null>(null)
    const [roleName, setRoleName] = useState('')
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])

    const { data: rolesData, isLoading } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles'),
    })

    const { data: permissionsData } = useQuery({
        queryKey: ['permissions'],
        queryFn: () => api.get('/permissions'),
    })

    const roles: Role[] = rolesData?.data ?? []
    const permissionGroups = permissionsData?.data ?? []

    const saveMutation = useMutation({
        mutationFn: (data: { name: string; permissions: number[] }) =>
            editingRole
                ? api.put(`/roles/${editingRole.id}`, data)
                : api.post('/roles', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] })
            setShowForm(false)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/roles/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    })

    const openCreate = () => {
        setEditingRole(null)
        setRoleName('')
        setSelectedPermissions([])
        setShowForm(true)
    }

    const openEdit = async (role: Role) => {
        const { data } = await api.get(`/roles/${role.id}`)
        setEditingRole(data)
        setRoleName(data.name)
        setSelectedPermissions(data.permissions?.map((p: any) => p.id) ?? [])
        setShowForm(true)
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Roles</h1>
                    <p className="mt-1 text-sm text-surface-500">Gerencie os perfis de acesso</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nova Role</Button>
            </div>

            {/* Roles Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <p className="col-span-full text-center text-sm text-surface-500 py-12">Carregando...</p>
                ) : roles.map((role) => (
                    <div
                        key={role.id}
                        className="group rounded-xl border border-surface-200 bg-white p-5 shadow-card hover:shadow-elevated transition-all duration-200"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-brand-50 p-2.5">
                                    <Shield className="h-5 w-5 text-brand-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-surface-900">{role.name}</h3>
                                    <div className="mt-1 flex gap-3 text-xs text-surface-500">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3" /> {role.users_count} usuários
                                        </span>
                                        <span>{role.permissions_count} permissões</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(role)} className="flex-1">
                                Editar
                            </Button>
                            {!['super_admin', 'admin'].includes(role.name) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { if (confirm('Excluir esta role?')) deleteMutation.mutate(role.id) }}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Form */}
            <Modal
                open={showForm}
                onOpenChange={setShowForm}
                title={editingRole ? `Editar: ${editingRole.name}` : 'Nova Role'}
                size="xl"
            >
                <form
                    onSubmit={(e) => { e.preventDefault(); saveMutation.mutate({ name: roleName, permissions: selectedPermissions }) }}
                    className="space-y-4"
                >
                    <Input
                        label="Nome da Role"
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                        placeholder="ex: supervisor"
                        required
                        disabled={editingRole?.name === 'super_admin'}
                    />

                    {/* Permission groups */}
                    <div>
                        <label className="mb-3 block text-sm font-semibold text-surface-900">Permissões</label>
                        <div className="max-h-96 overflow-y-auto space-y-4 rounded-lg border border-surface-200 p-4">
                            {permissionGroups.map((group: any) => (
                                <div key={group.id}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-600">
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
                                                        : 'border-surface-200 bg-white text-surface-500 hover:border-surface-300'
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

                    <div className="flex items-center justify-end gap-3 border-t border-surface-200 pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMutation.isPending}>
                            {editingRole ? 'Salvar' : 'Criar Role'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
