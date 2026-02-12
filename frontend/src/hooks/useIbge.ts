import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface State {
    id: number
    abbr: string
    name: string
}

interface City {
    id: number
    name: string
}

export function useIbgeStates() {
    return useQuery<State[]>({
        queryKey: ['ibge', 'states'],
        queryFn: async () => {
            const { data } = await api.get('/external/states')
            return data
        },
        staleTime: 1000 * 60 * 60 * 24, // 24h cache
    })
}

export function useIbgeCities(uf: string) {
    return useQuery<City[]>({
        queryKey: ['ibge', 'cities', uf],
        queryFn: async () => {
            const { data } = await api.get(`/external/states/${uf}/cities`)
            return data
        },
        enabled: uf.length === 2,
        staleTime: 1000 * 60 * 60 * 24,
    })
}
