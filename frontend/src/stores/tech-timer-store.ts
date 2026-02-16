import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TechTimerState {
    isRunning: boolean
    workOrderId: number | null
    workOrderNumber: string | null
    startedAt: string | null
    pausedAt: string | null
    accumulatedMs: number

    start: (workOrderId: number, workOrderNumber: string) => void
    pause: () => void
    resume: () => void
    stop: () => { workOrderId: number; durationMs: number } | null
    reset: () => void
}

export const useTechTimerStore = create<TechTimerState>()(
    persist(
        (set, get) => ({
            isRunning: false,
            workOrderId: null,
            workOrderNumber: null,
            startedAt: null,
            pausedAt: null,
            accumulatedMs: 0,

            start: (workOrderId, workOrderNumber) => set({
                isRunning: true,
                workOrderId,
                workOrderNumber,
                startedAt: new Date().toISOString(),
                pausedAt: null,
                accumulatedMs: 0,
            }),

            pause: () => {
                const { startedAt, accumulatedMs } = get()
                if (!startedAt) return
                const elapsed = new Date().getTime() - new Date(startedAt).getTime()
                set({
                    isRunning: false,
                    pausedAt: new Date().toISOString(),
                    accumulatedMs: accumulatedMs + elapsed,
                    startedAt: null,
                })
            },

            resume: () => set({
                isRunning: true,
                startedAt: new Date().toISOString(),
                pausedAt: null,
            }),

            stop: () => {
                const { workOrderId, startedAt, accumulatedMs, isRunning } = get()
                if (!workOrderId) return null

                let totalMs = accumulatedMs
                if (isRunning && startedAt) {
                    totalMs += new Date().getTime() - new Date(startedAt).getTime()
                }

                set({
                    isRunning: false,
                    workOrderId: null,
                    workOrderNumber: null,
                    startedAt: null,
                    pausedAt: null,
                    accumulatedMs: 0,
                })

                return { workOrderId, durationMs: totalMs }
            },

            reset: () => set({
                isRunning: false,
                workOrderId: null,
                workOrderNumber: null,
                startedAt: null,
                pausedAt: null,
                accumulatedMs: 0,
            }),
        }),
        { name: 'tech-timer' }
    )
)
