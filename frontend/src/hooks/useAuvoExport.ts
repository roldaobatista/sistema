import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { AxiosError } from 'axios'

function handleMutationError(error: unknown) {
    const err = error as AxiosError<{ message?: string }>
    if (err.response?.status === 403) {
        toast.error('Sem permissão para exportar para o Auvo')
    } else {
        toast.error(err.response?.data?.message || 'Erro ao exportar para o Auvo')
    }
}

export function useAuvoExport() {

    // Customer
    const exportCustomer = useMutation({
        mutationFn: (customerId: number) =>
            api.post(`/auvo/export/customer/${customerId}`).then(r => r.data),
        onSuccess: (data) => {
            toast.success(data.message || 'Cliente exportado com sucesso')
        },
        onError: handleMutationError
    })

    // Product
    const exportProduct = useMutation({
        mutationFn: (productId: number) =>
            api.post(`/auvo/export/product/${productId}`).then(r => r.data),
        onSuccess: (data) => {
            toast.success(data.message || 'Produto exportado com sucesso')
        },
        onError: handleMutationError
    })

    // Service
    const exportService = useMutation({
        mutationFn: (serviceId: number) =>
            api.post(`/auvo/export/service/${serviceId}`).then(r => r.data),
        onSuccess: (data) => {
            toast.success(data.message || 'Serviço exportado com sucesso')
        },
        onError: handleMutationError
    })

    // Quote
    const exportQuote = useMutation({
        mutationFn: (quoteId: number) =>
            api.post(`/auvo/export/quote/${quoteId}`).then(r => r.data),
        onSuccess: (data) => {
            toast.success(data.message || 'Orçamento exportado com sucesso')
        },
        onError: handleMutationError
    })

    return {
        exportCustomer,
        exportProduct,
        exportService,
        exportQuote
    }
}
