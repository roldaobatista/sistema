import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface PriceRecord {
    unit_price: number
    discount: number
    os_number: string
    date: string
}

export interface CustomerPriceItem {
    type: 'product' | 'service'
    reference_id: number
    description: string
    last_price: number
    last_discount: number
    last_os: string
    last_date: string
    history: PriceRecord[]
}

export function useCustomerPriceHistory(
    customerId: number | string | undefined,
    type?: 'product' | 'service',
    referenceId?: number | string,
) {
    const enabled = !!customerId && !!referenceId
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (referenceId) params.set('reference_id', String(referenceId))

    const { data, isLoading } = useQuery<CustomerPriceItem[]>({
        queryKey: ['customer-item-prices', customerId, type, referenceId],
        queryFn: () =>
            api.get(`/customers/${customerId}/item-prices?${params.toString()}`).then(r => r.data),
        enabled,
        staleTime: 60_000,
    })

    const match = data?.[0] ?? null

    return { priceHistory: match, allItems: data ?? [], isLoading }
}
