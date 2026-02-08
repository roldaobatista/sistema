import { useQuery } from '@tanstack/react-query'
import { Check, X, Shield } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

export function PermissionsMatrixPage() {
    const { data: matrixData, isLoading } = useQuery({
        queryKey: ['permissions-matrix'],
        queryFn: () => api.get('/permissions/matrix'),
    })

    const matrix = matrixData?.data?.matrix ?? []
    const roleNames: string[] = matrixData?.data?.roles ?? []

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20 text-sm text-surface-500">
                Carregando matriz de permissões...
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-surface-900">Matriz de Permissões</h1>
                <p className="mt-1 text-sm text-surface-500">
                    Visualização de todas as permissões atribuídas a cada role
                </p>
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
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-card">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="sticky left-0 z-10 bg-surface-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 min-w-[240px]">
                                Permissão
                            </th>
                            {roleNames.map(role => (
                                <th key={role} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-surface-600 min-w-[100px]">
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
                            <>
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
                                            </div>
                                        </td>
                                        {roleNames.map((role) => (
                                            <td key={role} className="px-3 py-2 text-center">
                                                {perm.roles[role] ? (
                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100">
                                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-surface-100">
                                                        <X className="h-3.5 w-3.5 text-surface-400" />
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
