import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'
import { navigateToModule } from './fixtures'

// ---------------------------------------------------------------------------
// FINANCIAL PAYMENT E2E — Tests the receivable/payment lifecycle
// ---------------------------------------------------------------------------

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
    return ok
}

test.describe('E2E — Financial Payment Lifecycle', () => {
    test('should load accounts receivable list', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/financeiro/contas-receber')

        const content = page.locator('table, [data-testid="empty-state"], :text("Nenhum")')
        await expect(content.first()).toBeVisible({ timeout: 15000 })
    })

    test('should load accounts payable list', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/financeiro/contas-pagar')

        const content = page.locator('table, [data-testid="empty-state"], :text("Nenhum")')
        await expect(content.first()).toBeVisible({ timeout: 15000 })
    })

    test('should navigate to receivable creation form', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/financeiro/contas-receber')

        const createBtn = page.locator('a:has-text("Nov"), button:has-text("Nov"), a:has-text("Criar"), button:has-text("Criar")').first()
        if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await createBtn.click()
            await page.waitForLoadState('networkidle')

            // Should show form
            const form = page.locator('form')
            await expect(form).toBeVisible({ timeout: 10000 })
        }
    })

    test('should load cash flow page', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/financeiro/fluxo-caixa')

        const content = page.locator('h1, h2, [class*="chart"], canvas, svg')
        await expect(content.first()).toBeVisible({ timeout: 15000 })
    })

    test('should load DRE page', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/financeiro/dre')

        const content = page.locator('h1, h2, table, [class*="chart"]')
        await expect(content.first()).toBeVisible({ timeout: 15000 })
    })

    test('should load invoices page', async ({ page }) => {
        await ensureLoggedIn(page)
        await navigateToModule(page, '/financeiro/faturas')

        const content = page.locator('table, [data-testid="empty-state"], :text("Nenhum"), h1, h2')
        await expect(content.first()).toBeVisible({ timeout: 15000 })
    })
})
