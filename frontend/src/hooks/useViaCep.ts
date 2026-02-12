import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import api from '@/lib/api'

interface ViaCepResult {
    street: string
    neighborhood: string
    city: string
    state: string
    complement: string
}

export function useViaCep() {
    const [loading, setLoading] = useState(false)

    const lookup = useCallback(async (cep: string): Promise<ViaCepResult | null> => {
        const clean = cep.replace(/\D/g, '')
        if (clean.length !== 8) return null

        setLoading(true)
        try {
            const { data } = await api.get(`/external/cep/${clean}`)
            return {
                street: data.street ?? '',
                neighborhood: data.neighborhood ?? '',
                city: data.city ?? '',
                state: data.state ?? '',
                complement: data.complement ?? '',
            }
        } catch {
            toast.error('CEP não encontrado')
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    return { lookup, loading }
}
