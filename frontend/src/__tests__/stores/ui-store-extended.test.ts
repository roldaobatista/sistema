import { describe, it, expect } from 'vitest'
import { useUIStore } from '@/stores/ui-store'

/**
 * Extended UI Store tests — toggle patterns, persistence, independence
 */
describe('ui-store — Extended Tests', () => {
    // Sidebar toggle
    it('toggleSidebar flips collapsed state from false to true', () => {
        useUIStore.setState({ sidebarCollapsed: false })
        useUIStore.getState().toggleSidebar()
        expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    it('toggleSidebar flips collapsed state from true to false', () => {
        useUIStore.setState({ sidebarCollapsed: true })
        useUIStore.getState().toggleSidebar()
        expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    it('double toggle returns to original state', () => {
        useUIStore.setState({ sidebarCollapsed: false })
        useUIStore.getState().toggleSidebar()
        useUIStore.getState().toggleSidebar()
        expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    it('setSidebarCollapsed sets to true', () => {
        useUIStore.getState().setSidebarCollapsed(true)
        expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    it('setSidebarCollapsed sets to false', () => {
        useUIStore.getState().setSidebarCollapsed(false)
        expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    // Mobile sidebar
    it('toggleMobileSidebar flips mobile open state', () => {
        useUIStore.setState({ sidebarMobileOpen: false })
        useUIStore.getState().toggleMobileSidebar()
        expect(useUIStore.getState().sidebarMobileOpen).toBe(true)
    })

    it('toggleMobileSidebar from open to closed', () => {
        useUIStore.setState({ sidebarMobileOpen: true })
        useUIStore.getState().toggleMobileSidebar()
        expect(useUIStore.getState().sidebarMobileOpen).toBe(false)
    })

    // Theme
    it('setTheme to dark', () => {
        useUIStore.getState().setTheme('dark')
        expect(useUIStore.getState().theme).toBe('dark')
    })

    it('setTheme to light', () => {
        useUIStore.getState().setTheme('light')
        expect(useUIStore.getState().theme).toBe('light')
    })

    it('setTheme to system', () => {
        useUIStore.getState().setTheme('system')
        expect(useUIStore.getState().theme).toBe('system')
    })

    it('theme persists across setState calls', () => {
        useUIStore.getState().setTheme('dark')
        useUIStore.setState({ sidebarCollapsed: true })
        expect(useUIStore.getState().theme).toBe('dark')
    })

    it('sidebar state persists across theme changes', () => {
        useUIStore.setState({ sidebarCollapsed: true })
        useUIStore.getState().setTheme('light')
        expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    // State independence
    it('sidebar toggle does not affect theme', () => {
        useUIStore.getState().setTheme('dark')
        useUIStore.getState().toggleSidebar()
        expect(useUIStore.getState().theme).toBe('dark')
    })

    it('mobile sidebar does not affect desktop sidebar', () => {
        useUIStore.setState({ sidebarCollapsed: true, sidebarMobileOpen: false })
        useUIStore.getState().toggleMobileSidebar()
        expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    // Store functions exist
    it('has toggleSidebar function', () => {
        expect(typeof useUIStore.getState().toggleSidebar).toBe('function')
    })

    it('has toggleMobileSidebar function', () => {
        expect(typeof useUIStore.getState().toggleMobileSidebar).toBe('function')
    })

    it('has setTheme function', () => {
        expect(typeof useUIStore.getState().setTheme).toBe('function')
    })

    it('has setSidebarCollapsed function', () => {
        expect(typeof useUIStore.getState().setSidebarCollapsed).toBe('function')
    })
})
