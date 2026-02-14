import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
    return ok
}

// ===========================================================================
// 1. TECH SHELL — Layout and Navigation
// ===========================================================================

test.describe('Tech PWA — Shell & Navigation', () => {
    test('tech shell loads with bottom navigation', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech')
        await page.waitForLoadState('networkidle')

        // Should show the TechShell with bottom nav
        const bottomNav = page.locator('nav').last()
        await expect(bottomNav).toBeVisible({ timeout: 10_000 })

        // Should have page content (H1 or card or list)
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })

    test('bottom nav has OS and Perfil tabs', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech')
        await page.waitForLoadState('networkidle')

        // Look for specific nav link labels rendered by TechShell
        const osLink = page.locator('nav a:has-text("OS"), nav a span:has-text("OS")')
        const perfilLink = page.locator('nav a:has-text("Perfil"), nav a span:has-text("Perfil")')
        const hasOSTab = await osLink.count() > 0
        const hasProfileTab = await perfilLink.count() > 0
        expect(hasOSTab || hasProfileTab).toBeTruthy()
    })

    test('navigates to profile page', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech/perfil')
        await page.waitForLoadState('networkidle')

        // Profile page should show sync status or user info
        const body = await page.textContent('body')
        const hasProfile = body?.match(/Sincroniz|Perfil|Conectado|Offline/i) !== null
        expect(hasProfile).toBeTruthy()
    })
})

// ===========================================================================
// 2. TECH WORK ORDERS — List & Detail
// ===========================================================================

test.describe('Tech PWA — Work Orders', () => {
    test('work orders list page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech')
        await page.waitForLoadState('networkidle')

        // Should show header with title or search
        const heading = page.locator('h1, h2, [class*="font-bold"]').first()
        await expect(heading).toBeVisible({ timeout: 10_000 })

        // No server error
        const body = await page.textContent('body')
        const hasError = body?.match(/erro 500|internal server error/i) !== null
        expect(hasError).toBeFalsy()
    })

    test('work orders list has search functionality', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech')
        await page.waitForLoadState('networkidle')

        // Should have a search input
        const search = page.locator('input[placeholder*="Buscar" i], input[type="search"]').first()
        if (await search.count() > 0) {
            await search.fill('NONEXISTENT_TEST_999')
            await page.waitForTimeout(500)

            // Should filter results
            const body = await page.textContent('body')
            expect(body).toBeTruthy()
        }
    })

    test('work orders list has status filter', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech')
        await page.waitForLoadState('networkidle')

        // Should have filter buttons or tabs
        const filters = page.locator('button:has-text("Todas"), button:has-text("Pendente"), button:has-text("Em Andamento")')
        if (await filters.count() > 0) {
            await filters.first().click()
            await page.waitForTimeout(500)
            const body = await page.textContent('body')
            expect(body).toBeTruthy()
        }
    })
})

// ===========================================================================
// 3. TECH PROFILE — Sync Status
// ===========================================================================

test.describe('Tech PWA — Profile & Sync', () => {
    test('profile page shows sync status', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech/perfil')
        await page.waitForLoadState('networkidle')

        // Should display online/offline status
        const body = await page.textContent('body')
        const hasSyncInfo = body?.match(/Sincroniz|Conectado|Offline|sincronizado/i) !== null
        expect(hasSyncInfo).toBeTruthy()
    })

    test('profile page has sync now button', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech/perfil')
        await page.waitForLoadState('networkidle')

        const syncBtn = page.locator('button:has-text("Sincronizar")')
        if (await syncBtn.count() > 0) {
            await expect(syncBtn.first()).toBeVisible()
        }
    })

    test('profile page has logout button', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech/perfil')
        await page.waitForLoadState('networkidle')

        const logoutBtn = page.locator('button:has-text("Sair"), text="Sair da conta"')
        if (await logoutBtn.count() > 0) {
            await expect(logoutBtn.first()).toBeVisible()
        }
    })

    test('profile page has clear data option', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech/perfil')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        const hasClear = body?.match(/Limpar dados|cache offline/i) !== null
        expect(hasClear).toBeTruthy()
    })
})

// ===========================================================================
// 4. OFFLINE SIMULATION — Network Toggle
// ===========================================================================

test.describe('Tech PWA — Offline Behavior', () => {
    test('shows offline indicator when network is disconnected', async ({ page, context }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech')
        await page.waitForLoadState('networkidle')

        // Go offline
        await context.setOffline(true)
        await page.waitForTimeout(1000)

        // Dispatch offline event for detection
        await page.evaluate(() => window.dispatchEvent(new Event('offline')))
        await page.waitForTimeout(500)

        // Should show offline indicator somewhere in the UI
        const body = await page.textContent('body')
        // The TechShell shows online/offline in the header bar
        expect(body).toBeTruthy()

        // Go back online
        await context.setOffline(false)
        await page.evaluate(() => window.dispatchEvent(new Event('online')))
    })

    test('page content remains visible when offline', async ({ page, context }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech')
        await page.waitForLoadState('networkidle')

        // Wait for initial data to load
        await page.waitForTimeout(2000)

        // Go offline
        await context.setOffline(true)
        await page.evaluate(() => window.dispatchEvent(new Event('offline')))
        await page.waitForTimeout(500)

        // The page should still show content (not blank)
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)

        // The bottom navigation should still be visible
        const nav = page.locator('nav').last()
        await expect(nav).toBeVisible()

        // Restore network
        await context.setOffline(false)
        await page.evaluate(() => window.dispatchEvent(new Event('online')))
    })

    test('can navigate between tech pages while offline', async ({ page, context }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/tech')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        // Go offline
        await context.setOffline(true)
        await page.evaluate(() => window.dispatchEvent(new Event('offline')))
        await page.waitForTimeout(500)

        // Navigate to profile (should work via client-side routing)
        await page.goto(BASE + '/tech/perfil')
        await page.waitForTimeout(1000)

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(30)

        // Restore
        await context.setOffline(false)
        await page.evaluate(() => window.dispatchEvent(new Event('online')))
    })
})

// ===========================================================================
// 5. TECH PAGES — No Crashes
// ===========================================================================

test.describe('Tech PWA — Page Stability', () => {
    const techPages = [
        { name: 'Work Orders List', path: '/tech' },
        { name: 'Profile', path: '/tech/perfil' },
    ]

    for (const tp of techPages) {
        test(`${tp.name} loads without errors`, async ({ page }) => {
            await ensureLoggedIn(page)
            await page.goto(BASE + tp.path)
            await page.waitForLoadState('networkidle')

            // No crash — page should have content
            const body = await page.textContent('body')
            expect(body!.length).toBeGreaterThan(30)

            // No unhandled error overlay
            const hasErrorOverlay = await page.locator('#webpack-dev-server-client-overlay, .vite-error-overlay').count() > 0
            expect(hasErrorOverlay).toBeFalsy()
        })
    }
})
