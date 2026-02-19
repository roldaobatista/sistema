import { useMemo, useCallback } from 'react'

// EMA table from Portaria INMETRO 157/2022 / OIML R76
const EMA_TABLE: Record<string, [number, number][]> = {
    I: [[50000, 0.5], [200000, 1.0], [Infinity, 1.5]],
    II: [[5000, 0.5], [20000, 1.0], [100000, 1.5]],
    III: [[500, 0.5], [2000, 1.0], [10000, 1.5]],
    IIII: [[50, 0.5], [200, 1.0], [1000, 1.5]],
}

export interface EmaResult {
    load: number
    ema: number
    multiplesOfE: number
}

export interface RepeatabilityResult {
    mean: number
    stdDev: number
    uncertaintyTypeA: number
    measurements: number[]
}

export interface ReadingError {
    referenceValue: number
    indication: number
    error: number
    ema: number
    conforming: boolean
}

function findEmaMultiple(precisionClass: string, multiplesOfE: number): number {
    const table = EMA_TABLE[precisionClass]
    if (!table) return 1.5
    for (const [threshold, multiple] of table) {
        if (multiplesOfE <= threshold) return multiple
    }
    return 1.5
}

/** Calculate EMA for a single point */
export function calculateEma(
    precisionClass: string,
    eValue: number,
    loadValue: number,
    verificationType: 'initial' | 'subsequent' | 'in_use' = 'initial'
): number {
    if (eValue <= 0) return 0
    const multiplesOfE = loadValue / eValue
    const emaMultiple = findEmaMultiple(precisionClass, multiplesOfE)
    let ema = emaMultiple * eValue
    if (verificationType === 'in_use') ema *= 2
    return Math.round(ema * 1e6) / 1e6
}

/** Calculate EMA for multiple points */
export function calculateEmaForPoints(
    precisionClass: string,
    eValue: number,
    loadValues: number[],
    verificationType: 'initial' | 'subsequent' | 'in_use' = 'initial'
): EmaResult[] {
    return loadValues.map((load) => ({
        load,
        ema: calculateEma(precisionClass, eValue, load, verificationType),
        multiplesOfE: eValue > 0 ? Math.round((load / eValue) * 100) / 100 : 0,
    }))
}

/** Calculate repeatability statistics from measurements */
export function calculateRepeatability(measurements: number[]): RepeatabilityResult {
    const valid = measurements.filter((v) => v != null && !isNaN(v))
    if (valid.length < 2) return { mean: 0, stdDev: 0, uncertaintyTypeA: 0, measurements: valid }

    const n = valid.length
    const mean = valid.reduce((s, v) => s + v, 0) / n
    const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
    const stdDev = Math.sqrt(variance)
    const uncertaintyTypeA = stdDev / Math.sqrt(n)

    return {
        mean: Math.round(mean * 1e4) / 1e4,
        stdDev: Math.round(stdDev * 1e6) / 1e6,
        uncertaintyTypeA: Math.round(uncertaintyTypeA * 1e6) / 1e6,
        measurements: valid,
    }
}

/** Suggest measurement points at 0%, 25%, 50%, 75%, 100% of max capacity */
export function suggestPoints(maxCapacity: number): number[] {
    return [0, 0.25, 0.5, 0.75, 1].map((pct) => Math.round(maxCapacity * pct * 1e4) / 1e4)
}

/** Suggest eccentricity test load (~1/3 of max capacity) */
export function suggestEccentricityLoad(maxCapacity: number): number {
    return Math.round((maxCapacity / 3) * 1e4) / 1e4
}

/** Suggest repeatability test load (~50% of max capacity) */
export function suggestRepeatabilityLoad(maxCapacity: number): number {
    return Math.round((maxCapacity * 0.5) * 1e4) / 1e4
}

/** Check if reading error is within EMA */
export function isConforming(error: number, ema: number): boolean {
    return Math.abs(error) <= Math.abs(ema)
}

/** Calculate reading error (indication - reference) */
export function calculateReadingError(indication: number, referenceValue: number): number {
    return Math.round((indication - referenceValue) * 1e6) / 1e6
}

/** Calculate expanded uncertainty U = k × uc */
export function calculateExpandedUncertainty(
    uncertaintyTypeA: number,
    uncertaintyTypeB: number = 0,
    kFactor: number = 2
): number {
    const uc = Math.sqrt(uncertaintyTypeA ** 2 + uncertaintyTypeB ** 2)
    return Math.round(kFactor * uc * 1e6) / 1e6
}

// ────────────────────────────────────────────────────
// React hook for reactive calculations
// ────────────────────────────────────────────────────

interface UseCalibrationCalculationsProps {
    precisionClass: string
    eValue: number
    maxCapacity: number
    verificationType?: 'initial' | 'subsequent' | 'in_use'
}

export function useCalibrationCalculations({
    precisionClass,
    eValue,
    maxCapacity,
    verificationType = 'initial',
}: UseCalibrationCalculationsProps) {
    const suggestedPoints = useMemo(
        () => suggestPoints(maxCapacity),
        [maxCapacity]
    )

    const emaResults = useMemo(
        () => calculateEmaForPoints(precisionClass, eValue, suggestedPoints, verificationType),
        [precisionClass, eValue, suggestedPoints, verificationType]
    )

    const eccentricityLoad = useMemo(
        () => suggestEccentricityLoad(maxCapacity),
        [maxCapacity]
    )

    const repeatabilityLoad = useMemo(
        () => suggestRepeatabilityLoad(maxCapacity),
        [maxCapacity]
    )

    const calculateEmaForLoad = useCallback(
        (load: number) => calculateEma(precisionClass, eValue, load, verificationType),
        [precisionClass, eValue, verificationType]
    )

    const checkConformity = useCallback(
        (error: number, load: number) => {
            const ema = calculateEma(precisionClass, eValue, load, verificationType)
            return { ema, conforming: isConforming(error, ema) }
        },
        [precisionClass, eValue, verificationType]
    )

    return {
        suggestedPoints,
        emaResults,
        eccentricityLoad,
        repeatabilityLoad,
        calculateEmaForLoad,
        checkConformity,
        calculateRepeatability,
        calculateExpandedUncertainty,
    }
}
