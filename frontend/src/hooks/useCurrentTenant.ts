import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

/**
 * Hook para gerenciar o tenant (empresa) ativo e listar tenants disponíveis.
 */
export function useCurrentTenant() {
    const { user, tenant, fetchMe } = useAuthStore()
    const qc = useQueryClient()

    const { data: tenantsRes } = useQuery({
        queryKey: ['my-tenants'],
        queryFn: () => api.get('/my-tenants'),
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    })

    const switchMut = useMutation({
        mutationFn: (tenantId: number) => api.post('/switch-tenant', { tenant_id: tenantId }),
        onSuccess: async () => {
            await fetchMe()
            qc.invalidateQueries({ queryKey: ['my-tenants'] })
            qc.invalidateQueries({ queryKey: ['tenants'] })
            qc.invalidateQueries({ queryKey: ['tenants-stats'] })
            qc.invalidateQueries({ queryKey: ['branches'] })
        },
    })

    return {
        currentTenant: tenant,
        tenants: (tenantsRes?.data ?? []) as Array<{ id: number; name: string; document: string | null }>,
        switchTenant: switchMut.mutate,
        isSwitching: switchMut.isPending,
    }
}
