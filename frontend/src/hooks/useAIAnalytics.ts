import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const AI = '/ai'

export function usePredictiveMaintenance() {
    return useQuery({
        queryKey: ['ai', 'predictive-maintenance'],
        queryFn: () => api.get(`${AI}/predictive-maintenance`).then(r => r.data),
    })
}

export function useExpenseOcrAnalysis() {
    return useQuery({
        queryKey: ['ai', 'expense-ocr-analysis'],
        queryFn: () => api.get(`${AI}/expense-ocr-analysis`).then(r => r.data),
    })
}

export function useTriageSuggestions() {
    return useQuery({
        queryKey: ['ai', 'triage-suggestions'],
        queryFn: () => api.get(`${AI}/triage-suggestions`).then(r => r.data),
    })
}

export function useSentimentAnalysis() {
    return useQuery({
        queryKey: ['ai', 'sentiment-analysis'],
        queryFn: () => api.get(`${AI}/sentiment-analysis`).then(r => r.data),
    })
}

export function useDynamicPricing() {
    return useQuery({
        queryKey: ['ai', 'dynamic-pricing'],
        queryFn: () => api.get(`${AI}/dynamic-pricing`).then(r => r.data),
    })
}

export function useFinancialAnomalies() {
    return useQuery({
        queryKey: ['ai', 'financial-anomalies'],
        queryFn: () => api.get(`${AI}/financial-anomalies`).then(r => r.data),
    })
}

export function useVoiceCommands() {
    return useQuery({
        queryKey: ['ai', 'voice-commands'],
        queryFn: () => api.get(`${AI}/voice-commands`).then(r => r.data),
    })
}

export function useNaturalLanguageReport(period?: string) {
    return useQuery({
        queryKey: ['ai', 'natural-language-report', period],
        queryFn: () => api.get(`${AI}/natural-language-report`, { params: { period } }).then(r => r.data),
    })
}

export function useCustomerClustering() {
    return useQuery({
        queryKey: ['ai', 'customer-clustering'],
        queryFn: () => api.get(`${AI}/customer-clustering`).then(r => r.data),
    })
}

export function useEquipmentImageAnalysis() {
    return useQuery({
        queryKey: ['ai', 'equipment-image-analysis'],
        queryFn: () => api.get(`${AI}/equipment-image-analysis`).then(r => r.data),
    })
}

export function useDemandForecast() {
    return useQuery({
        queryKey: ['ai', 'demand-forecast'],
        queryFn: () => api.get(`${AI}/demand-forecast`).then(r => r.data),
    })
}

export function useAIRouteOptimization() {
    return useQuery({
        queryKey: ['ai', 'route-optimization'],
        queryFn: () => api.get(`${AI}/route-optimization`).then(r => r.data),
    })
}

export function useSmartTicketLabeling() {
    return useQuery({
        queryKey: ['ai', 'smart-ticket-labeling'],
        queryFn: () => api.get(`${AI}/smart-ticket-labeling`).then(r => r.data),
    })
}

export function useChurnPrediction() {
    return useQuery({
        queryKey: ['ai', 'churn-prediction'],
        queryFn: () => api.get(`${AI}/churn-prediction`).then(r => r.data),
    })
}

export function useServiceSummary(workOrderId: number | null) {
    return useQuery({
        queryKey: ['ai', 'service-summary', workOrderId],
        queryFn: () => api.get(`${AI}/service-summary/${workOrderId}`).then(r => r.data),
        enabled: !!workOrderId,
    })
}
