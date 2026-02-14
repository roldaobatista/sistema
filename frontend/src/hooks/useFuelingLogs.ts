import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'

export interface FuelingLog {
    id: number
    tenant_id: number
    user_id: number
    work_order_id: number | null
    fueling_date: string
    vehicle_plate: string
    odometer_km: number
    gas_station_name: string | null
    gas_station_lat: number | null
    gas_station_lng: number | null
    fuel_type: string
    liters: number
    price_per_liter: number
    total_amount: number
    receipt_path: string | null
    notes: string | null
    status: 'pending' | 'approved' | 'rejected'
    approved_by: number | null
    approved_at: string | null
    created_at: string
    user?: { id: number; name: string }
    work_order?: { id: number; os_number: string }
    approved_by_user?: { id: number; name: string }
}

export interface FuelingLogFilters {
    user_id?: number
    status?: string
    date_from?: string
    date_to?: string
    search?: string
    page?: number
    per_page?: number
}

export interface FuelingLogFormData {
    work_order_id?: number | null
    vehicle_plate: string
    odometer_km: number
    gas_station?: string
    fuel_type: string
    liters: number
    price_per_liter: number
    total_amount: number
    date: string
    notes?: string
}

const FUEL_TYPES = [
    { value: 'diesel', label: 'Diesel' },
    { value: 'diesel_s10', label: 'Diesel S10' },
    { value: 'gasolina', label: 'Gasolina' },
    { value: 'etanol', label: 'Etanol' },
]

function handleError(err: any, fallback: string) {
    if (err.response?.status === 403) {
        toast.error('Sem permissão para esta ação')
    } else if (err.response?.status === 422) {
        const errors = err.response.data.errors
        if (errors) {
            const first = Object.values(errors).flat()[0] as string
            toast.error(first)
        } else {
            toast.error(err.response.data.message || fallback)
        }
    } else {
        toast.error(err.response?.data?.message || fallback)
    }
}

export function useFuelingLogs(filters: FuelingLogFilters = {}) {
    return useQuery({
        queryKey: ['fueling-logs', filters],
        queryFn: async () => {
            const params = new URLSearchParams()
            Object.entries(filters).forEach(([k, v]) => {
                if (v !== undefined && v !== '') params.append(k, String(v))
            })
            const { data } = await api.get(`/fueling-logs?${params}`)
            return data
        },
    })
}

export function useFuelingLog(id: number | null) {
    return useQuery({
        queryKey: ['fueling-log', id],
        queryFn: async () => {
            const { data } = await api.get(`/fueling-logs/${id}`)
            return data as FuelingLog
        },
        enabled: !!id,
    })
}

export function useCreateFuelingLog() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (formData: FuelingLogFormData) => {
            const { data } = await api.post('/fueling-logs', formData)
            return data
        },
        onSuccess: () => {
            toast.success('Abastecimento registrado')
            qc.invalidateQueries({ queryKey: ['fueling-logs'] })
        },
        onError: (err: any) => handleError(err, 'Erro ao registrar abastecimento'),
    })
}

export function useUpdateFuelingLog() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...formData }: FuelingLogFormData & { id: number }) => {
            const { data } = await api.put(`/fueling-logs/${id}`, formData)
            return data
        },
        onSuccess: () => {
            toast.success('Abastecimento atualizado')
            qc.invalidateQueries({ queryKey: ['fueling-logs'] })
        },
        onError: (err: any) => handleError(err, 'Erro ao atualizar abastecimento'),
    })
}

export function useApproveFuelingLog() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, action }: { id: number; action: 'approve' | 'reject' }) => {
            const { data } = await api.post(`/fueling-logs/${id}/approve`, { action })
            return data
        },
        onSuccess: (_: any, vars: { id: number; action: 'approve' | 'reject' }) => {
            toast.success(vars.action === 'approve' ? 'Abastecimento aprovado' : 'Abastecimento rejeitado')
            qc.invalidateQueries({ queryKey: ['fueling-logs'] })
        },
        onError: (err: any) => handleError(err, 'Erro ao aprovar/rejeitar'),
    })
}

export function useDeleteFuelingLog() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/fueling-logs/${id}`)
        },
        onSuccess: () => {
            toast.success('Registro excluído')
            qc.invalidateQueries({ queryKey: ['fueling-logs'] })
        },
        onError: (err: any) => handleError(err, 'Erro ao excluir registro'),
    })
}

export { FUEL_TYPES }
