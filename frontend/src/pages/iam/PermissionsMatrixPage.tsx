import { Fragment, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Shield, RefreshCw, ShieldOff, Search, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

interface RoleInfo {
    id: number
    name: string
}

export function PermissionsMatrixPage() {
    const queryClient = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canEditRoles = hasPermission('iam.role.update')
    const [searchFilter, setSearchFilter] = useState('')
    const [togglingCell, setTogglingCell] = useState<string | null>(null)

    const { data: matrixData, isLoading, isError, refetch } = useQuery({
        queryKey: ['permissions-matrix'],
        const { data, isLoading, isError, refetch } = useQuery({
        queryFn: () => api.get('/permissions/matrix'),
    })

    const rawMatrix = matrixData?.data?.matrix ?? []
    const roleNames: string[] = matrixData?.data?.roles ?? []

    // Build a map of role name -> role id for toggle
    const { data: rolesData } = useQuery({
        queryKey: ['roles'],
        const { data, isLoading, isError, refetch } = useQuery({
        queryFn: () => api.get('/roles').then(r => r.data),
    })
    const rolesArray: RoleInfo[] = rolesData?.data ?? rolesData ?? []
    const roleIdMap: Record<string, number> = {}
    rolesArray.forEach(r => { roleIdMap[r.name] = r.id })

    const toggleMutation = useMutation({
        mutationFn: (data: { role_id: number; permission_id: number }) =>
            api.post('/permissions/toggle', data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['permissions-matrix'] })
            queryClient.invalidateQueries({ queryKey: ['roles'] })
            toast.success(res.data?.message ?? 'Permissão atualizada!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao alterar permissão.')
        },
        onSettled: () => {
            setTogglingCell(null)
        },
    })

    const handleToggle = (roleName: string, permissionId: number) => {
        const roleId = roleIdMap[roleName]
        if (!roleId) return
        const cellKey = `${roleName}-${permissionId}`
        setTogglingCell(cellKey)
        toggleMutation.mutate({ role_id: roleId, permission_id: permissionId })
    }

    const matrix = searchFilter
        ? rawMatrix
            .map((group: any) => ({
                ...group,
                permissions: group.permissions.filter((p: any) =>
                    p.name.toLowerCase().includes(searchFilter.toLowerCase())
                ),
            }))
            .filter((g: any) => g.permissions.length > 0)
        : rawMatrix

    if (isLoading) {
        return (
            <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="h-5 w-52 rounded bg-surface-200 animate-pulse" />
                        <div className="h-3.5 w-80 rounded bg-surface-200 animate-pulse" />
                    </div>
                    <div className="h-10 w-64 rounded-lg bg-surface-200 animate-pulse" />
                </div>
                <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card animate-pulse">
                    <div className="border-b border-subtle bg-surface-50 px-4 py-3 flex gap-6">
                        <div className="h-4 w-40 rounded bg-surface-200" />
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-4 w-20 rounded bg-surface-200" />
                        ))}
                    </div>
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center gap-6 border-t border-surface-100 px-4 py-2.5">
                            <div className="h-3.5 w-36 rounded bg-surface-200" />
                            {[...Array(4)].map((_, j) => (
                                <div key={j} className="h-6 w-6 rounded-md bg-surface-200 mx-auto" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <p className="text-sm text-red-500">Erro ao carregar a matriz de permissões.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                    Tentar novamente
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Matriz de Permissões"
                subtitle={canEditRoles ? 'Clique nas células para ativar/desativar permissões' : 'Visualização de todas as permissões atribuídas a cada role'}
                count={rawMatrix.reduce((acc: number, g: any) => acc + g.permissions.length, 0)}
            />

            <div className="flex items-center justify-end">
                <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Filtrar permissões..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-surface-500">
                <span className="flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded bg-emerald-100 flex items-center justify-center">
                        <Check className="h-3 w-3 text-emerald-600" />
                    </span>
                    Concedida
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded bg-surface-100 flex items-center justify-center">
                        <X className="h-3 w-3 text-surface-400" />
                    </span>
                    Negada
                </span>
                <span className="flex items-center gap-1.5">
                    <Badge variant="danger">HIGH</Badge> Criticidade alta
                </span>
                <span className="flex items-center gap-1.5">
                    <Badge variant="warning">MED</Badge> Média
                </span>
                <span className="flex items-center gap-1.5">
                    <Badge variant="default">LOW</Badge> Baixa
                </span>
                {canEditRoles && (
                    <span className="ml-auto text-xs text-brand-600 font-medium">
                        ✏️ Edição inline ativa
                    </span>
                )}
            </div>

            {/* Matrix Table */}
            {matrix.length === 0 ? (
                <EmptyState
                    icon={<ShieldOff className="h-5 w-5 text-surface-300" />}
                    message={searchFilter ? 'Nenhuma permissão encontrada. Tente buscar por outro termo.' : 'Não há permissões cadastradas no sistema.'}
                />
            ) : (
                <div className="overflow-x-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="border-b border-subtle bg-surface-50">
                                <th className="sticky left-0 z-10 bg-surface-50 px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500 min-w-[240px]">
                                    Permissão
                                </th>
                                {roleNames.map(role => (
                                    <th key={role} className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-surface-500 min-w-[100px]">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Shield className="h-3 w-3" />
                                            {role}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {matrix.map((group: any, gi: number) => (
                                <Fragment key={`group-${gi}`}>
                                    {/* Group header */}
                                    <tr key={`g-${gi}`} className="bg-surface-50/50">
                                        <td
                                            colSpan={roleNames.length + 1}
                                            className="sticky left-0 z-10 bg-surface-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-700"
                                        >
                                            {group.group}
                                        </td>
                                    </tr>
                                    {/* Permissions */}
                                    {group.permissions.map((perm: any) => (
                                        <tr key={perm.id} className="border-t border-surface-100 hover:bg-surface-50/50 transition-colors">
                                            <td className="sticky left-0 z-10 bg-white px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-surface-700">
                                                        {perm.name.split('.').slice(1).join('.')}
                                                    </span>
                                                    {perm.criticality === 'HIGH' && (
                                                        <Badge variant="danger" className="text-[10px]">HIGH</Badge>
                                                    )}
                                                    {perm.criticality === 'MED' && (
                                                        <Badge variant="warning" className="text-[10px]">MED</Badge>
                                                    )}
                                                    {perm.criticality === 'LOW' && (
                                                        <Badge variant="default" className="text-[10px]">LOW</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            {roleNames.map((role) => {
                                                const cellKey = `${role}-${perm.id}`
                                                const isToggling = togglingCell === cellKey
                                                const isGranted = perm.roles[role]
                                                const isSuperAdmin = role === 'super_admin'
                                                const isClickable = canEditRoles && !isSuperAdmin

                                                return (
                                                    <td key={role} className="px-3 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => isClickable && handleToggle(role, perm.id)}
                                                            disabled={!isClickable || isToggling}
                                                            className={cn(
                                                                'inline-flex h-6 w-6 items-center justify-center rounded-md transition-all',
                                                                isClickable && 'cursor-pointer hover:ring-2 hover:ring-brand-300',
                                                                !isClickable && 'cursor-default',
                                                                isGranted ? 'bg-emerald-100' : 'bg-surface-100',
                                                            )}
                                                            title={
                                                                isSuperAdmin ? 'Super admin não pode ser editado'
                                                                    : isClickable ? (isGranted ? 'Clique para revogar' : 'Clique para conceder')
                                                                        : undefined
                                                            }
                                                        >
                                                            {isToggling ? (
                                                                <Loader2 className="h-3.5 w-3.5 text-brand-500 animate-spin" />
                                                            ) : isGranted ? (
                                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                            ) : (
                                                                <X className="h-3.5 w-3.5 text-surface-400" />
                                                            )}
                                                        </button>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
