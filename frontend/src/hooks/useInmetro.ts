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
    address_street: string | null
    address_number: string | null
    address_complement: string | null
    address_neighborhood: string | null
    address_city: string
    address_state: string
    address_zip: string | null
    phone_local: string | null
    email_local: string | null
    latitude: number | null
    longitude: number | null
    distance_from_base_km: number | null
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
    competitor_id: number | null
    competitor_name?: string | null
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
    max_capacity: string | null
    accuracy_classes: string[] | null
    authorization_valid_until: string | null
    total_repairs: number
    repairs?: CompetitorRepair[]
}

export interface CompetitorRepair {
    id: number
    instrument_id: number
    instrument_number?: string
    instrument_type?: string
    repair_date: string
    result: string | null
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
    by_type?: { instrument_type: string; total: number }[]
}

export interface ConversionStats {
    total_leads: number
    converted: number
    conversion_rate: number
    avg_days_to_convert: number | null
    by_status: Record<string, number>
    recent_conversions: { id: number; name: string; document: string; updated_at: string; converted_to_customer_id: number }[]
}

export function useInmetroDashboard() {
    return useQuery<InmetroDashboard>({
        queryKey: ['inmetro', 'dashboard'],
        queryFn: () => api.get('/inmetro/dashboard').then(r => r.data),
    })
}

export function useConversionStats() {
    return useQuery<ConversionStats>({
        queryKey: ['inmetro', 'conversion-stats'],
        queryFn: () => api.get('/inmetro/conversion-stats').then(r => r.data),
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

export interface InstrumentTypeOption {
    slug: string
    label: string
}

export function useInstrumentTypes() {
    return useQuery<InstrumentTypeOption[]>({
        queryKey: ['inmetro', 'instrument-types'],
        queryFn: () => api.get('/inmetro/instrument-types').then(r => r.data),
        staleTime: 1000 * 60 * 60, // 1h — types rarely change
    })
}

export interface InmetroConfig {
    monitored_ufs: string[]
    instrument_types: string[]
    auto_sync_enabled: boolean
    sync_interval_days: number
}

export function useInmetroConfig() {
    return useQuery<InmetroConfig>({
        queryKey: ['inmetro', 'config'],
        queryFn: () => api.get('/inmetro/config').then(r => r.data),
    })
}

export function useUpdateInmetroConfig() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: Partial<InmetroConfig>) => api.put('/inmetro/config', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inmetro', 'config'] })
            toast.success('Configuração INMETRO salva')
        },
        onError: handleMutationError,
    })
}

export function useAvailableUfs() {
    return useQuery<string[]>({
        queryKey: ['inmetro', 'available-ufs'],
        queryFn: () => api.get('/inmetro/available-ufs').then(r => r.data),
        staleTime: 1000 * 60 * 60 * 24, // 24h — UFs never change
    })
}

export function useImportXml() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { uf?: string; type?: string; instrument_types?: string[] }) => api.post('/inmetro/import/xml', data),
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

// ── Cross-Reference CRM ──────────────────────────────────

export interface CrossReferenceStats {
    total_owners: number
    linked: number
    unlinked: number
    with_document: number
    link_percentage: number
}

export interface CustomerInmetroProfile {
    linked: boolean
    owner_ids?: number[]
    owner_names?: string[]
    total_instruments?: number
    total_locations?: number
    overdue?: number
    expiring_30d?: number
    expiring_90d?: number
    by_type?: Record<string, number>
    instruments?: Array<{
        id: number
        inmetro_number: string
        instrument_type: string
        brand: string
        model: string
        current_status: string
        last_verification_at: string | null
        next_verification_at: string | null
    }>
    locations?: Array<{
        id: number
        address_city: string
        address_state: string
        farm_name: string | null
    }>
}

export function useCrossReferenceStats() {
    return useQuery<CrossReferenceStats>({
        queryKey: ['inmetro', 'cross-reference-stats'],
        queryFn: () => api.get('/inmetro/cross-reference-stats').then(r => r.data),
    })
}

export function useCustomerInmetroProfile(customerId: number | undefined) {
    return useQuery<CustomerInmetroProfile>({
        queryKey: ['inmetro', 'customer-profile', customerId],
        queryFn: () => api.get(`/inmetro/customer-profile/${customerId}`).then(r => r.data),
        enabled: !!customerId,
    })
}

export function useCrossReference() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: () => api.post('/inmetro/cross-reference'),
        onSuccess: (res) => {
            const stats = res.data?.stats
            toast.success(`Cross-reference: ${stats?.matched ?? 0} novos vínculos encontrados`)
            qc.invalidateQueries({ queryKey: ['inmetro'] })
            qc.invalidateQueries({ queryKey: ['customers'] })
        },
        onError: handleMutationError,
    })
}

// ── Map / Geolocation ──────────────────────────────────

export interface MapMarker {
    id: number
    lat: number
    lng: number
    city: string
    state: string
    farm_name: string | null
    distance_km: number | null
    owner_name: string
    owner_document: string | null
    owner_priority: string
    lead_status: string
    is_customer: boolean
    instrument_count: number
    overdue: number
    expiring_30d: number
}

export interface MapData {
    markers: MapMarker[]
    total_geolocated: number
    total_without_geo: number
    by_city: Record<string, { count: number; instruments: number; overdue: number }>
}

export function useMapData() {
    return useQuery<MapData>({
        queryKey: ['inmetro', 'map-data'],
        queryFn: () => api.get('/inmetro/map-data').then(r => r.data),
    })
}

export function useGeocodeLocations() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (limit?: number) => api.post('/inmetro/geocode', { limit: limit ?? 50 }),
        onSuccess: (res) => {
            const stats = res.data?.stats
            toast.success(`Geocoding: ${stats?.geocoded ?? 0} locais geocodificados`)
            qc.invalidateQueries({ queryKey: ['inmetro', 'map-data'] })
        },
        onError: handleMutationError,
    })
}

export function useCalculateDistances() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { base_lat: number; base_lng: number }) =>
            api.post('/inmetro/calculate-distances', data),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Distâncias calculadas')
            qc.invalidateQueries({ queryKey: ['inmetro', 'map-data'] })
        },
        onError: handleMutationError,
    })
}

// ── Market Intelligence ────────────────────────────────

export interface MarketOverview {
    total_owners: number
    total_instruments: number
    total_competitors: number
    leads: number
    customers: number
    conversion_rate: number
    overdue: number
    expiring_30d: number
    expiring_90d: number
    market_opportunity: number
}

export interface CompetitorAnalysis {
    by_city: { city: string; total: number }[]
    by_state: { state: string; total: number }[]
    total_competitor_cities: number
    our_presence_in_competitor_cities: number
    species_distribution: Record<string, number>
}

export interface RegionalAnalysis {
    by_city: { city: string; state: string; instrument_count: number; owner_count: number; overdue_count: number }[]
    by_state: { state: string; instrument_count: number; owner_count: number; overdue_count: number }[]
}

export interface BrandAnalysis {
    by_brand: { brand: string; total: number }[]
    by_type: { type: string; total: number }[]
    by_status: { status: string; total: number }[]
    brand_status: Record<string, Record<string, number>>
}

export interface ExpirationForecast {
    months: { month: string; label: string; count: number }[]
    overdue: number
    total_upcoming_12m: number
}

export function useMarketOverview() {
    return useQuery<MarketOverview>({
        queryKey: ['inmetro', 'market-overview'],
        queryFn: () => api.get('/inmetro/market-overview').then(r => r.data),
    })
}

export function useCompetitorAnalysis() {
    return useQuery<CompetitorAnalysis>({
        queryKey: ['inmetro', 'competitor-analysis'],
        queryFn: () => api.get('/inmetro/competitor-analysis').then(r => r.data),
    })
}

export function useRegionalAnalysis() {
    return useQuery<RegionalAnalysis>({
        queryKey: ['inmetro', 'regional-analysis'],
        queryFn: () => api.get('/inmetro/regional-analysis').then(r => r.data),
    })
}

export function useBrandAnalysis() {
    return useQuery<BrandAnalysis>({
        queryKey: ['inmetro', 'brand-analysis'],
        queryFn: () => api.get('/inmetro/brand-analysis').then(r => r.data),
    })
}

export function useExpirationForecast() {
    return useQuery<ExpirationForecast>({
        queryKey: ['inmetro', 'expiration-forecast'],
        queryFn: () => api.get('/inmetro/expiration-forecast').then(r => r.data),
    })
}

// v2 Market Intel

export interface MonthlyTrendItem {
    month: string
    label: string
    new_instruments: number
    verifications: number
    rejections: number
    conversions: number
}

export interface MonthlyTrends {
    months: MonthlyTrendItem[]
}

export interface RevenueRankingItem {
    id: number
    name: string
    document: string
    priority: string
    estimated_revenue: number
    total_instruments: number
    expiring_count: number
    rejected_count: number
    has_phone: boolean
    lead_status: string
}

export interface RevenueRanking {
    ranking: RevenueRankingItem[]
    total_potential_revenue: number
}

export function useMonthlyTrends() {
    return useQuery<MonthlyTrends>({
        queryKey: ['inmetro', 'monthly-trends'],
        queryFn: () => api.get('/inmetro/monthly-trends').then(r => r.data),
    })
}

export function useRevenueRanking() {
    return useQuery<RevenueRanking>({
        queryKey: ['inmetro', 'revenue-ranking'],
        queryFn: () => api.get('/inmetro/revenue-ranking').then(r => r.data),
    })
}

// ── Base Config (Geolocation) ──────────────────────

export interface InmetroBaseConfig {
    id: number
    tenant_id: number
    base_lat: number | null
    base_lng: number | null
    base_address: string | null
    base_city: string | null
    base_state: string | null
    max_distance_km: number
    enrichment_sources: string[] | null
    last_enrichment_at: string | null
}

export function useBaseConfig() {
    return useQuery<InmetroBaseConfig>({
        queryKey: ['inmetro', 'base-config'],
        queryFn: () => api.get('/inmetro/base-config').then(r => r.data),
    })
}

export function useUpdateBaseConfig() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: Partial<InmetroBaseConfig>) => api.put('/inmetro/base-config', data),
        onSuccess: () => {
            toast.success('Base de operações atualizada')
            qc.invalidateQueries({ queryKey: ['inmetro', 'base-config'] })
            qc.invalidateQueries({ queryKey: ['inmetro', 'map-data'] })
        },
        onError: handleMutationError,
    })
}

// ── PDF Export ──────────────────────

export function useExportLeadsPdf() {
    return useMutation({
        mutationFn: () => api.get('/inmetro/export/leads-pdf').then(r => r.data),
        onSuccess: (data: { html: string; filename: string }) => {
            const printWindow = window.open('', '_blank')
            if (printWindow) {
                printWindow.document.write(data.html)
                printWindow.document.close()
                printWindow.focus()
                setTimeout(() => printWindow.print(), 500)
            }
            toast.success('Relatório gerado com sucesso')
        },
        onError: handleMutationError,
    })
}

// ── DadosGov Enrichment ──────────────────────

export function useEnrichFromDadosGov() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (ownerId: number) => api.post(`/inmetro/enrich-dadosgov/${ownerId}`).then(r => r.data),
        onSuccess: () => {
            toast.success('Dados governamentais enriquecidos')
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleMutationError,
    })
}
