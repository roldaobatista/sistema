import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function useDarkMode() {
    const [theme, setThemeState] = useState<Theme>(() => {
        const stored = localStorage.getItem('theme')
        if (stored === 'dark' || stored === 'light') return stored
        return 'system'
    })

    const [isDark, setIsDark] = useState(() => {
        const stored = localStorage.getItem('theme')
        if (stored === 'dark') return true
        if (stored === 'light') return false
        return window.matchMedia('(prefers-color-scheme: dark)').matches
    })

    const applyTheme = useCallback((dark: boolean) => {
        setIsDark(dark)
        document.documentElement.classList.toggle('dark', dark)
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', dark ? '#0f172a' : '#2563eb')
        }
    }, [])

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme)
        if (newTheme === 'system') {
            localStorage.removeItem('theme')
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            applyTheme(prefersDark)
        } else {
            localStorage.setItem('theme', newTheme)
            applyTheme(newTheme === 'dark')
        }
    }, [applyTheme])

    const toggle = useCallback(() => {
        setTheme(isDark ? 'light' : 'dark')
    }, [isDark, setTheme])

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
