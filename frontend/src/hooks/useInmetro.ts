import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { AxiosError } from 'axios'

function handleMutationError(error: unknown) {
    const err = error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>
    if (err.response?.status === 403) {
        toast.error('Sem permissão para esta ação')
    } else if (err.response?.status === 422) {
        const msgs = err.response.data?.errors
        if (msgs) {
            Object.values(msgs).flat().forEach(m => toast.error(m))
        } else {
            toast.error(err.response.data?.message || 'Dados inválidos')
        }
    } else {
        toast.error(err.response?.data?.message || 'Ocorreu um erro')
    }
}

export interface InmetroOwner {
    id: number
    document: string
    name: string
    trade_name: string | null
    type: 'PF' | 'PJ'
    phone: string | null
    phone2: string | null
    email: string | null
    contact_source: string | null
    contact_enriched_at: string | null
    lead_status: 'new' | 'contacted' | 'negotiating' | 'converted' | 'lost'
    priority: 'urgent' | 'high' | 'normal' | 'low'
    converted_to_customer_id: number | null
    notes: string | null
    locations_count?: number
    instruments_count?: number
    locations?: InmetroLocation[]
    created_at: string
}

export interface InmetroLocation {
    id: number
    owner_id: number
    state_registration: string | null
    farm_name: string | null
    address_city: string
    address_state: string
    instruments?: InmetroInstrument[]
}

export interface InmetroInstrument {
    id: number
    inmetro_number: string
    serial_number: string | null
    brand: string | null
    model: string | null
    capacity: string | null
    instrument_type: string
    current_status: 'approved' | 'rejected' | 'repaired' | 'unknown'
    last_verification_at: string | null
    next_verification_at: string | null
    last_executor: string | null
    owner_name?: string
    owner_id?: number
    address_city?: string
    history?: InmetroHistoryEntry[]
}

export interface InmetroHistoryEntry {
    id: number
    event_type: 'verification' | 'repair' | 'rejection' | 'initial'
    event_date: string
    result: 'approved' | 'rejected' | 'repaired'
    executor: string | null
    validity_date: string | null
    notes: string | null
}

export interface InmetroCompetitor {
    id: number
    name: string
    cnpj: string | null
    authorization_number: string | null
    phone: string | null
    email: string | null
    address: string | null
    city: string
    state: string
    authorized_species: string[] | null
    mechanics: string[] | null
}

export interface InmetroDashboard {
    totals: {
        owners: number
        instruments: number
        overdue: number
        expiring_30d: number
        expiring_60d: number
        expiring_90d: number
    }
    leads: {
        new: number
        contacted: number
        negotiating: number
        converted: number
        lost: number
    }
    by_city: { city: string; total: number }[]
    by_status: { current_status: string; total: number }[]
    by_brand: { brand: string; total: number }[]
}

export function useInmetroDashboard() {
    return useQuery<InmetroDashboard>({
        queryKey: ['inmetro', 'dashboard'],
        queryFn: () => api.get('/inmetro/dashboard').then(r => r.data),
    })
}

export function useInmetroOwners(params: Record<string, string | number | boolean>) {
    return useQuery({
        queryKey: ['inmetro', 'owners', params],
        queryFn: () => api.get('/inmetro/owners', { params }).then(r => r.data),
    })
}

export function useInmetroOwner(id: number | null) {
    return useQuery<InmetroOwner>({
        queryKey: ['inmetro', 'owners', id],
        queryFn: () => api.get(`/inmetro/owners/${id}`).then(r => r.data),
        enabled: !!id,
    })
}

export function useInmetroInstruments(params: Record<string, string | number | boolean>) {
    return useQuery({
        queryKey: ['inmetro', 'instruments', params],
        queryFn: () => api.get('/inmetro/instruments', { params }).then(r => r.data),
    })
}

export function useInmetroInstrument(id: number | null) {
    return useQuery<InmetroInstrument>({
        queryKey: ['inmetro', 'instruments', id],
        queryFn: () => api.get(`/inmetro/instruments/${id}`).then(r => r.data),
        enabled: !!id,
    })
}

export interface ConversionStats {
    total_leads: number
    converted: number
    conversion_rate: number
    avg_days_to_convert: number | null
    by_status: Record<string, number>
    recent_conversions: { id: number; name: string; document: string; updated_at: string; converted_to_customer_id: number }[]
}

export function useConversionStats() {
    return useQuery<ConversionStats>({
        queryKey: ['inmetro', 'conversion-stats'],
        queryFn: () => api.get('/inmetro/conversion-stats').then(r => r.data),
    })
}

export function useInmetroLeads(params: Record<string, string | number | boolean>) {
    return useQuery({
        queryKey: ['inmetro', 'leads', params],
        queryFn: () => api.get('/inmetro/leads', { params }).then(r => r.data),
    })
}

export function useInmetroCompetitors(params: Record<string, string | number | boolean>) {
    return useQuery({
        queryKey: ['inmetro', 'competitors', params],
        queryFn: () => api.get('/inmetro/competitors', { params }).then(r => r.data),
    })
}

export function useInmetroCities() {
    return useQuery<{ city: string; instrument_count: number; owner_count: number }[]>({
        queryKey: ['inmetro', 'cities'],
        queryFn: () => api.get('/inmetro/cities').then(r => r.data),
    })
}

export function useImportXml() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { uf?: string; type?: string }) => api.post('/inmetro/import/xml', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleMutationError,
    })
}

export function useSubmitPsieResults() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { results: Record<string, string>[] }) => api.post('/inmetro/import/psie-results', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleMutationError,
    })
}

export function useEnrichOwner() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (ownerId: number) => api.post(`/inmetro/enrich/${ownerId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleMutationError,
    })
}

export function useEnrichBatch() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (ownerIds: number[]) => api.post('/inmetro/enrich-batch', { owner_ids: ownerIds }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleMutationError,
    })
}

export function useConvertToCustomer() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (ownerId: number) => api.post(`/inmetro/convert/${ownerId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro'] })
            qc.invalidateQueries({ queryKey: ['customers'] })
        },
        onError: handleMutationError,
    })
}

export function useUpdateLeadStatus() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ ownerId, lead_status, notes }: { ownerId: number; lead_status: string; notes?: string }) =>
            api.patch(`/inmetro/owners/${ownerId}/status`, { lead_status, notes }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleMutationError,
    })
}

export function useUpdateOwner() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
            api.put(`/inmetro/owners/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleMutationError,
    })
}

export function useDeleteOwner() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: number) => api.delete(`/inmetro/owners/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleMutationError,
    })
}
