import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface PrefillData {
    calibration_date: string | null
    calibration_method: string | null
    calibration_location: string | null
    calibration_location_type: string | null
    temperature: number | null
    humidity: number | null
    pressure: number | null
    standard_used: string | null
    verification_type: string | null
    verification_division_e: number | null
    technician_notes: string | null
    weight_ids: number[]
    reading_structure: Array<{
        reference_value: number
        unit: string
    }>
    previous_id: number
    previous_certificate: string | null
}

export interface PrefillResponse {
    prefilled: boolean
    message?: string
    data?: PrefillData
}

export interface SuggestedPointsResponse {
    points: Array<{
        load: number
        percentage: number
        ema: number
        multiples_of_e: number
    }>
    eccentricity_load: number
    repeatability_load: number
}

export function useCalibrationPrefill(equipmentId: number | null) {
    return useQuery<PrefillResponse>({
        queryKey: ['calibration-prefill', equipmentId],
        queryFn: async () => {
            const { data } = await api.get<PrefillResponse>(
                `/calibration/equipment/${equipmentId}/prefill`
            )
            return data
        },
        enabled: !!equipmentId,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    })
}

export function useCalibrationSuggestedPoints(equipmentId: number | null) {
    return useQuery<SuggestedPointsResponse>({
        queryKey: ['calibration-suggest-points', equipmentId],
        queryFn: async () => {
            const { data } = await api.get<SuggestedPointsResponse>(
                `/calibration/equipment/${equipmentId}/suggest-points`
            )
            return data
        },
        enabled: !!equipmentId,
        staleTime: 10 * 60 * 1000,
        retry: 1,
    })
}

// Mutation helpers for server-side calculations
export async function fetchServerEma(
    precisionClass: string,
    eValue: number,
    loads: number[],
    verificationType = 'initial'
) {
    const { data } = await api.post('/calibration/calculate-ema', {
        precision_class: precisionClass,
        e_value: eValue,
        loads,
        verification_type: verificationType,
    })
    return data.ema_results as Array<{ load: number; ema: number; multiples_of_e: number }>
}

export async function validateIso17025(calibrationId: number) {
    const { data } = await api.get(`/calibration/${calibrationId}/validate-iso17025`)
    return data as {
        complete: boolean
        score: number
        total_fields: number
        missing_fields: string[]
        completed_fields: string[]
    }
}

export async function saveRepeatabilityTest(
    calibrationId: number,
    loadValue: number,
    measurements: number[],
    unit = 'kg'
) {
    const { data } = await api.post(`/calibration/${calibrationId}/repeatability`, {
        load_value: loadValue,
        unit,
        measurements,
    })
    return data
}
