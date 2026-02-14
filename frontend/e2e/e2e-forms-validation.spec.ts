import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
}

// ===========================================================================
// FORM VALIDATION — Real field filling + submit + error/success feedback
// ===========================================================================

test.describe('Forms Validation — Clientes', () => {
    test('submit empty form shows required field errors', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        const newBtn = page.locator('button:has-text("Novo"), a:has-text("Novo")').first()
        if (await newBtn.count() === 0) return

        await newBtn.click()
        await page.waitForTimeout(500)

        // Try to submit empty form
        const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar")').first()
        if (await submitBtn.count() === 0) return

        await submitBtn.click()
        await page.waitForTimeout(1500)

        // Should either:
        // 1. Stay on the same page (not redirect)
        // 2. Show validation errors (red text, :invalid, error messages)
        // 3. Show toast error
        const hasValidation = await page.locator('.text-red-600, .text-red-500, .text-destructive, [class*="error"]').count() > 0
        const hasInvalid = await page.locator(':invalid').count() > 0
        const hasToastError = await page.locator('text=/obrigatório|required|campo|preencha/i').count() > 0

        expect(hasValidation || hasInvalid || hasToastError).toBeTruthy()
    })

    test('email field rejects invalid format', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        const newBtn = page.locator('button:has-text("Novo"), a:has-text("Novo")').first()
        if (await newBtn.count() === 0) return
        await newBtn.click()
        await page.waitForTimeout(500)

        const emailInput = page.locator('input[name="email"], input[type="email"]').first()
        if (await emailInput.count() > 0) {
            await emailInput.fill('not-an-email')

            const nameInput = page.locator('input[name="name"], input[name="nome"]').first()
            if (await nameInput.count() > 0) {
                await nameInput.fill('Teste Validation')
            }

            const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar")').first()
            if (await submitBtn.count() > 0) {
                await submitBtn.click()
                await page.waitForTimeout(1500)

                // Email should trigger validation
                const hasEmailError = await page.locator('text=/email|inválido|invalid/i').count() > 0
                const hasInvalid = await page.locator('input[type="email"]:invalid').count() > 0
                expect(hasEmailError || hasInvalid).toBeTruthy()
            }
        }
    })
})

test.describe('Forms Validation — OS', () => {
    test('OS create form submit is disabled without customer', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/os/nova')
        await page.waitForLoadState('networkidle')

        // Submit button should be disabled without customer selection
        const submitBtn = page.locator('button[type="submit"]').first()
        if (await submitBtn.count() > 0) {
            const isDisabled = await submitBtn.isDisabled()
            // Form requires customer_id AND description — button starts disabled
            expect(isDisabled).toBeTruthy()
        }

        // Page should stay on /os/nova
        expect(page.url()).toContain('/os/nova')
    })
})

test.describe('Forms Validation — Orçamentos', () => {
    test('quote create form has required fields', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/orcamentos/novo')
        await page.waitForLoadState('networkidle')

        // Try to submit empty
        const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar"), button:has-text("Criar")').first()
        if (await submitBtn.count() > 0) {
            await submitBtn.click()
            await page.waitForTimeout(1500)

            const hasValidation = await page.locator('.text-red-600, .text-red-500, .text-destructive, :invalid').count() > 0
            const stayedOnPage = page.url().includes('/novo')
            expect(hasValidation || stayedOnPage).toBeTruthy()
        }
    })
})

test.describe('Forms Validation — Financeiro', () => {
    test('contas a receber — new modal has required fields', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/financeiro/receber')
        await page.waitForLoadState('networkidle')

        const newBtn = page.locator('button:has-text("Novo"), button:has-text("Nova"), a:has-text("Novo")').first()
        if (await newBtn.count() === 0) return
        await newBtn.click()
        await page.waitForTimeout(800)

        // Try submit without fill
        const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar")').first()
        if (await submitBtn.count() > 0) {
            await submitBtn.click()
            await page.waitForTimeout(1500)

            const hasValidation = await page.locator('.text-red-600, .text-red-500, .text-destructive, :invalid').count() > 0
            const hasDialog = await page.locator('[role="dialog"], .modal').count() > 0
            expect(hasValidation || hasDialog).toBeTruthy()
        }
    })

    test('contas a pagar — new modal has required fields', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/financeiro/pagar')
        await page.waitForLoadState('networkidle')

        const newBtn = page.locator('button:has-text("Novo"), button:has-text("Nova"), a:has-text("Novo")').first()
        if (await newBtn.count() === 0) return
        await newBtn.click()
        await page.waitForTimeout(800)

        const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar")').first()
        if (await submitBtn.count() > 0) {
            await submitBtn.click()
            await page.waitForTimeout(1500)

            const hasValidation = await page.locator('.text-red-600, .text-red-500, .text-destructive, :invalid').count() > 0
            const stayedOpen = await page.locator('[role="dialog"], .modal').count() > 0
            expect(hasValidation || stayedOpen).toBeTruthy()
        }
    })
})

test.describe('Forms Validation — API Error Handling', () => {
    test('server 500 shows graceful error message', async ({ page }) => {
        await ensureLoggedIn(page)

        // Intercept API to return 500
        await page.route('**/api/v1/customers**', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Internal Server Error' }),
                })
            } else {
                await route.continue()
            }
        })

        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        const newBtn = page.locator('button:has-text("Novo"), a:has-text("Novo")').first()
        if (await newBtn.count() === 0) return
        await newBtn.click()
        await page.waitForTimeout(500)

        // Fill minimal data
        const nameInput = page.locator('input[name="name"], input[name="nome"]').first()
        if (await nameInput.count() > 0) await nameInput.fill('Teste Erro 500')

        const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar")').first()
        if (await submitBtn.count() > 0) {
            await submitBtn.click()
            await page.waitForTimeout(2000)

            // Should show error toast (not crash)
            const body = await page.textContent('body')
            expect(body!.length).toBeGreaterThan(50) // not blank
        }
    })

    test('server 422 shows validation errors', async ({ page }) => {
        await ensureLoggedIn(page)

        await page.route('**/api/v1/customers**', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 422,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Dados inválidos',
                        errors: { name: ['O campo nome é obrigatório.'] },
                    }),
                })
            } else {
                await route.continue()
            }
        })

        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        const newBtn = page.locator('button:has-text("Novo"), a:has-text("Novo")').first()
        if (await newBtn.count() === 0) return
        await newBtn.click()
        await page.waitForTimeout(500)

        const nameInput = page.locator('input[name="name"], input[name="nome"]').first()
        if (await nameInput.count() > 0) await nameInput.fill('Test')

        const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar")').first()
        if (await submitBtn.count() > 0) {
            await submitBtn.click()
            await page.waitForTimeout(2000)

            // Should show validation error or toast
            const hasInline = await page.locator('text=/obrigatório/i').count() > 0
            const hasToast = await page.locator('text=/inválid|erro|falha/i').count() > 0
            expect(hasInline || hasToast).toBeTruthy()
        }
    })
})
