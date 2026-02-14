import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface EmployeeBenefit {
    id: string
    tenant_id: string
    user_id: string
    user?: {
        id: string
        name: string
    }
    type: 'vt' | 'vr' | 'va' | 'health' | 'dental' | 'life_insurance' | 'other'
    provider?: string
    value: number
    employee_contribution: number
    start_date: string
    end_date?: string
    is_active: boolean
    notes?: string
    created_at: string
    updated_at: string
}

export interface BenefitFilters {
    user_id?: string
    type?: string
}

export function useBenefits(filters?: BenefitFilters) {
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery({
        queryKey: ['hr-benefits', filters],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (filters?.user_id) params.append('user_id', filters.user_id)
            if (filters?.type) params.append('type', filters.type)

            const response = await api.get(`/hr/benefits?${params.toString()}`)
            return response.data
        }
    })

    const createBenefit = useMutation({
        mutationFn: async (data: Partial<EmployeeBenefit>) => {
            const response = await api.post('/hr/benefits', data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-benefits'] })
        }
    })

    const updateBenefit = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<EmployeeBenefit> }) => {
            const response = await api.put(`/hr/benefits/${id}`, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-benefits'] })
        }
    })

    const deleteBenefit = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/hr/benefits/${id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-benefits'] })
        }
    })

    return {
        benefits: data?.data || [],
        meta: data?.meta,
        isLoading,
        error,
        createBenefit,
        updateBenefit,
        deleteBenefit
    }
}
