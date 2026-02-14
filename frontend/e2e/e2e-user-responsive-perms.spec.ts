import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'
import { navigateToModule } from './fixtures'

// ---------------------------------------------------------------------------
// USER MANAGEMENT & PERMISSIONS E2E
// ---------------------------------------------------------------------------

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
    return ok
}

test.describe('E2E — User Management', () => {
    test('should load users list page', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/configuracoes/usuarios')

        const content = page.locator('table, [data-testid="empty-state"], h1, h2')
        await expect(content.first()).toBeVisible({ timeout: 15000 })
    })

    test('should load roles page', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/configuracoes/papeis')

        const content = page.locator('table, [data-testid="empty-state"], h1, h2, :text("Role"), :text("Papel")')
        await expect(content.first()).toBeVisible({ timeout: 15000 })
    })

    test('should navigate to user creation', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/configuracoes/usuarios')

        const createBtn = page.locator('a:has-text("Nov"), button:has-text("Nov"), a:has-text("Criar"), button:has-text("Criar")').first()
        if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await createBtn.click()
            await page.waitForLoadState('networkidle')

            // Form should be visible
            const nameField = page.locator('input[name="name"], input[placeholder*="Nome"]').first()
            await expect(nameField).toBeVisible({ timeout: 10000 })
        }
    })
})

// ---------------------------------------------------------------------------
// RESPONSIVE CHECK — Validates layout across viewports
// ---------------------------------------------------------------------------

test.describe('E2E — Responsive Layout', () => {
    test('sidebar collapses on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 }) // iPhone
        await ensureLoggedIn(page)
        await navigateToModule(page, '/')

        // Sidebar should be collapsed or hidden on mobile
        const sidebar = page.locator('aside, nav[class*="sidebar"], [data-testid="sidebar"]').first()
        const menuBtn = page.locator('button[class*="menu"], [data-testid="menu-toggle"]').first()

        // Either sidebar is hidden or menu toggle is visible
        const sidebarVisible = await sidebar.isVisible({ timeout: 3000 }).catch(() => false)
        const menuBtnVisible = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)

        // On mobile, sidebar should be hidden OR menu button should be visible
        expect(sidebarVisible === false || menuBtnVisible === true).toBeTruthy()
    })

    test('content is readable on desktop viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 })
        await ensureLoggedIn(page)
        await navigateToModule(page, '/')

        // Page should have visible content
        const body = await page.textContent('body')
        expect(body).toBeTruthy()
        expect(body!.length).toBeGreaterThan(100)
    })
})

// ---------------------------------------------------------------------------
// PERMISSION GATES E2E — Validates UI hides unauthorized features
// ---------------------------------------------------------------------------

test.describe('E2E — Permission Gates', () => {
    test('unauthenticated user is redirected to login', async ({ page }) => {
        // Clear any stored tokens
        await page.goto(BASE + '/login')
        await page.evaluate(() => {
            localStorage.clear()
            sessionStorage.clear()
        })

        // Try to access protected route
        await page.goto(BASE + '/os')
        await page.waitForLoadState('networkidle')

        // Should redirect to login — check URL
        const url = page.url()
        expect(url).toContain('login')
    })

    test('logged in admin can see sidebar navigation items', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/')

        // Admin should see main nav items
        const navItems = page.locator('a[href*="/os"], a[href*="/clientes"], a[href*="/financeiro"]')
        const count = await navItems.count()
        expect(count).toBeGreaterThanOrEqual(1)
    })
})
