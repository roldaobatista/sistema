import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ExpenseCategory } from '@/types/expense'

export function useExpenseCategories() {
    const { data, isLoading, error } = useQuery<ExpenseCategory[]>({
        queryKey: ['expense-categories'],
        queryFn: async () => {
            const res = await api.get('/expense-categories')
            return res.data ?? []
        },
        staleTime: 5 * 60 * 1000,
    })

    return {
        categories: data ?? [],
        isLoading,
        error,
    }
}
