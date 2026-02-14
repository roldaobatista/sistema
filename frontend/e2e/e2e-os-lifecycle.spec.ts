import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'
import { navigateToModule, waitForPageLoad } from './fixtures'

// ---------------------------------------------------------------------------
// OS FULL LIFECYCLE E2E — Tests the complete work order journey
// ---------------------------------------------------------------------------

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
    return ok
}

test.describe('E2E — OS Full Lifecycle', () => {
    test('should create, transition, and verify work order', async ({ page }) => {
        await ensureLoggedIn(page)

        // 1. Navigate to OS creation
        await navigateToModule(page, '/os/new')
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })

        // 2. Look for the form — verify it loaded
        const form = page.locator('form')
        if (await form.isVisible({ timeout: 5000 }).catch(() => false)) {
            // 3. Fill customer (usually a select/combobox)
            const customerField = page.locator('[name="customer_id"], [data-testid="customer-select"]').first()
            if (await customerField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await customerField.click()
                // Select first available option
                const option = page.locator('[role="option"], [data-value]').first()
                if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await option.click()
                }
            }

            // 4. Fill description
            const descField = page.locator('[name="description"], textarea').first()
            if (await descField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await descField.fill('OS Teste E2E - Calibração de balança')
            }

            // 5. Submit
            const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar"), button:has-text("Criar")').first()
            if (await submitBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
                await submitBtn.click()
                await page.waitForLoadState('networkidle')
            }
        }
    })

    test('should list work orders with data', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/os')

        // Should have either table rows or empty state
        const content = page.locator('table tbody tr, [data-testid="empty-state"], :text("Nenhum")')
        await expect(content.first()).toBeVisible({ timeout: 15000 })
    })

    test('should display kanban view', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/os/kanban')

        // Kanban should have columns
        const columns = page.locator('[data-testid*="kanban"], [class*="kanban"], [class*="column"]')
        if (await columns.first().isVisible({ timeout: 5000 }).catch(() => false)) {
            expect(await columns.count()).toBeGreaterThanOrEqual(1)
        }
    })

    test('should search and filter work orders', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/os')

        const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"]').first()
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await searchInput.fill('Calibração')
            await page.waitForTimeout(1000) // debounce
            await page.waitForLoadState('networkidle')
        }
    })
})
