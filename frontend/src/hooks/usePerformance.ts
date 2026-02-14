import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PerformanceReview, ContinuousFeedback } from '@/types/hr'
import { toast } from 'sonner'

export function usePerformance() {
    const qc = useQueryClient()

    // Reviews
    const { data: reviews, isLoading: loadingReviews } = useQuery<PerformanceReview[]>({
        queryKey: ['hr-reviews'],
        queryFn: () => api.get('/hr/performance-reviews').then(r => r.data),
    })

    const createReview = useMutation({
        mutationFn: (data: Partial<PerformanceReview>) => api.post('/hr/performance-reviews', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-reviews'] })
            toast.success('Avaliação criada')
        },
        onError: () => toast.error('Erro ao criar avaliação'),
    })

    const updateReview = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<PerformanceReview> }) =>
            api.put(`/hr/performance-reviews/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-reviews'] })
            toast.success('Avaliação atualizada')
        },
        onError: () => toast.error('Erro ao atualizar avaliação'),
    })

    // Feedback
    const { data: feedbackList, isLoading: loadingFeedback } = useQuery<ContinuousFeedback[]>({
        queryKey: ['hr-feedback'],
        queryFn: () => api.get('/hr/continuous-feedback').then(r => r.data),
    })

    const sendFeedback = useMutation({
        mutationFn: (data: Partial<ContinuousFeedback>) => api.post('/hr/continuous-feedback', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-feedback'] })
            toast.success('Feedback enviado!')
        },
        onError: () => toast.error('Erro ao enviar feedback'),
    })

    return {
        reviews,
        loadingReviews,
        createReview,
        updateReview,
        feedbackList,
        loadingFeedback,
        sendFeedback,
    }
}

export function useReview(id: number) {
    return useQuery<PerformanceReview>({
        queryKey: ['hr-review', id],
        queryFn: () => api.get(`/hr/performance-reviews/${id}`).then(r => r.data),
        enabled: !!id,
    })
}
