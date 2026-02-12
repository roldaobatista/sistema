import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import api from '@/lib/api'

interface CnpjResult {
    name: string
    trade_name: string
    email: string
    phone: string
    address_zip: string
    address_street: string
    address_number: string
    address_complement: string
    address_neighborhood: string
    address_city: string
    address_state: string
    status: string
    main_activity: string
    company_size: string
}

export function useCnpjLookup() {
    const [loading, setLoading] = useState(false)

    const lookup = useCallback(async (cnpj: string): Promise<CnpjResult | null> => {
        const clean = cnpj.replace(/\D/g, '')
        if (clean.length !== 14) return null

        setLoading(true)
        try {
            const { data } = await api.get(`/external/cnpj/${clean}`)
            return {
                name: data.name ?? '',
                trade_name: data.trade_name ?? '',
                email: data.email ?? '',
                phone: data.phone ?? '',
                address_zip: data.address_zip ?? '',
                address_street: data.address_street ?? '',
                address_number: data.address_number ?? '',
                address_complement: data.address_complement ?? '',
                address_neighborhood: data.address_neighborhood ?? '',
                address_city: data.address_city ?? '',
                address_state: data.address_state ?? '',
                status: data.status ?? '',
                main_activity: data.main_activity ?? '',
                company_size: data.company_size ?? '',
            }
        } catch {
            toast.error('CNPJ não encontrado')
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    return { lookup, loading }
}
