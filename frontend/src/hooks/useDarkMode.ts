import { useState, useEffect, useCallback, useRef } from 'react'
import { useUIStore } from '@/stores/ui-store'

type Theme = 'light' | 'dark' | 'system'

export function useDarkMode() {
    const [theme, setThemeState] = useState<Theme>(() => {
        const stored = useUIStore.getState().theme
        if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
        return 'system'
    })

    const [isDark, setIsDark] = useState(() => {
        const t = useUIStore.getState().theme
        if (t === 'dark') return true
        if (t === 'light') return false
        return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    })

    const applyTheme = useCallback((dark: boolean) => {
        setIsDark(dark)
        document.documentElement.classList.toggle('dark', dark)
        document.documentElement.classList.toggle('light', !dark)
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', dark ? '#09090B' : '#2563EB')
        }
    }, [])

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme)
        useUIStore.getState().setTheme(newTheme)
        const dark = newTheme === 'system'
            ? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
            : newTheme === 'dark'
        setIsDark(dark)
        applyTheme(dark)
    }, [applyTheme])

    const toggle = useCallback(() => {
        setTheme(isDark ? 'light' : 'dark')
    }, [isDark, setTheme])

    const prevThemeRef = useRef(useUIStore.getState().theme)
    useEffect(() => {
        const unsub = useUIStore.subscribe(() => {
            const next = useUIStore.getState().theme
            if (next !== prevThemeRef.current) {
                prevThemeRef.current = next
                setThemeState(next)
                const dark = next === 'system'
                    ? window.matchMedia('(prefers-color-scheme: dark)').matches
                    : next === 'dark'
                setIsDark(dark)
            }
        })
        return unsub
    }, [])

    useEffect(() => {
        const isDarkNow = theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
            : theme === 'dark'
        applyTheme(isDarkNow)
    }, [theme, applyTheme])

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = (e: MediaQueryListEvent) => {
            if (theme === 'system') {
                applyTheme(e.matches)
            }
        }
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [theme, applyTheme])

    return { theme, isDark, setTheme, toggle }
}
