import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from '@/stores/ui-store'

describe('UI Store', () => {
    beforeEach(() => {
        localStorage.clear()
        useUIStore.setState({
            sidebarCollapsed: false,
            sidebarMobileOpen: false,
            theme: 'light',
        })
    })

    describe('initial state', () => {
        it('should start with sidebar expanded', () => {
            expect(useUIStore.getState().sidebarCollapsed).toBe(false)
        })

        it('should start with mobile sidebar closed', () => {
            expect(useUIStore.getState().sidebarMobileOpen).toBe(false)
        })

        it('should start with light theme', () => {
            expect(useUIStore.getState().theme).toBe('light')
        })
    })

    describe('toggleSidebar', () => {
        it('should toggle sidebar collapsed state', () => {
            useUIStore.getState().toggleSidebar()
            expect(useUIStore.getState().sidebarCollapsed).toBe(true)

            useUIStore.getState().toggleSidebar()
            expect(useUIStore.getState().sidebarCollapsed).toBe(false)
        })
    })

    describe('setSidebarCollapsed', () => {
        it('should set sidebar collapsed to true', () => {
            useUIStore.getState().setSidebarCollapsed(true)
            expect(useUIStore.getState().sidebarCollapsed).toBe(true)
        })

        it('should set sidebar collapsed to false', () => {
            useUIStore.getState().setSidebarCollapsed(true)
            useUIStore.getState().setSidebarCollapsed(false)
            expect(useUIStore.getState().sidebarCollapsed).toBe(false)
        })
    })

    describe('toggleMobileSidebar', () => {
        it('should toggle mobile sidebar open state', () => {
            useUIStore.getState().toggleMobileSidebar()
            expect(useUIStore.getState().sidebarMobileOpen).toBe(true)

            useUIStore.getState().toggleMobileSidebar()
            expect(useUIStore.getState().sidebarMobileOpen).toBe(false)
        })
    })

    describe('setTheme', () => {
        it('should set theme to dark', () => {
            useUIStore.getState().setTheme('dark')
            expect(useUIStore.getState().theme).toBe('dark')
            expect(document.documentElement.classList.contains('dark')).toBe(true)
        })

        it('should set theme to light', () => {
            useUIStore.getState().setTheme('dark')
            useUIStore.getState().setTheme('light')
            expect(useUIStore.getState().theme).toBe('light')
            expect(document.documentElement.classList.contains('light')).toBe(true)
            expect(document.documentElement.classList.contains('dark')).toBe(false)
        })

        it('should handle system theme', () => {
            // matchMedia is mocked to return false (light preference)
            useUIStore.getState().setTheme('system')
            expect(useUIStore.getState().theme).toBe('system')
            expect(document.documentElement.classList.contains('light')).toBe(true)
        })
    })

    describe('persist partialize', () => {
        it('should persist sidebarCollapsed and theme', () => {
            useUIStore.getState().setSidebarCollapsed(true)
            useUIStore.getState().setTheme('dark')

            const stored = JSON.parse(localStorage.getItem('ui-store') || '{}')
            expect(stored.state?.sidebarCollapsed).toBe(true)
            expect(stored.state?.theme).toBe('dark')
        })

        it('should NOT persist sidebarMobileOpen', () => {
            useUIStore.getState().toggleMobileSidebar()

            const stored = JSON.parse(localStorage.getItem('ui-store') || '{}')
            expect(stored.state?.sidebarMobileOpen).toBeUndefined()
        })
    })
})
