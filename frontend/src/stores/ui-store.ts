import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function applyThemeToDOM(theme: 'light' | 'dark' | 'system') {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (theme === 'system') {
        const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.add(prefersDark ? 'dark' : 'light')
    } else {
        root.classList.add(theme)
    }
}

interface UIState {
    sidebarCollapsed: boolean
    sidebarMobileOpen: boolean
    theme: 'light' | 'dark' | 'system'

    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    toggleMobileSidebar: () => void
    setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarCollapsed: false,
            sidebarMobileOpen: false,
            theme: 'light',

            toggleSidebar: () =>
                set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

            setSidebarCollapsed: (collapsed) =>
                set({ sidebarCollapsed: collapsed }),

            toggleMobileSidebar: () =>
                set((state) => ({ sidebarMobileOpen: !state.sidebarMobileOpen })),

            setTheme: (theme) => {
                applyThemeToDOM(theme)
                set({ theme })
            },
        }),
        {
            name: 'ui-store',
            partialize: (state) => ({
                sidebarCollapsed: state.sidebarCollapsed,
                theme: state.theme,
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.theme) applyThemeToDOM(state.theme)
            },
        }
    )
)
