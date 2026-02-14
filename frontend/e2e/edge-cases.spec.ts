import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Edge Cases', () => {
    test('formulário de login vazio não deve submeter', async ({ page }) => {
        await page.goto(BASE + '/login')

        // Click submit with empty fields
        await page.click('button[type="submit"]')

        // Should still be on login page (HTML5 required validation prevents submission)
        expect(page.url()).toContain('/login')

        // Email input should have required validation
        const emailInput = page.locator('input#email')
        await expect(emailInput).toHaveAttribute('required', '')
    })

    test('duplo submit deve ser prevenido (botão desabilitado durante loading)', async ({ page }) => {
        await page.goto(BASE + '/login')
        await page.fill('input#email', 'test@test.com')
        await page.fill('input#password', 'password')

        // Intercept login to slow it down
        await page.route('**/api/v1/login', async (route) => {
            await new Promise(r => setTimeout(r, 2000))
            await route.fulfill({ status: 200, body: JSON.stringify({ token: 'test' }) })
        })

        await page.click('button[type="submit"]')

        // Button should be disabled after first click
        await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })

    test('token inválido deve limpar estado e redirecionar', async ({ page }) => {
        await page.goto(BASE + '/login')

        // Set invalid token
        await page.evaluate(() => {
            localStorage.setItem('auth_token', 'invalid-garbage-token')
            localStorage.setItem('auth-store', JSON.stringify({
                state: { token: 'invalid-garbage-token', isAuthenticated: true },
                version: 0,
            }))
        })

        // Navigate to a protected page
        await page.goto(BASE + '/')
        await page.waitForTimeout(5000)

        // Should eventually redirect to login or show error
        const url = page.url()
        const isOnLogin = url.includes('/login')
        const hasError = await page.locator('text=/erro|expirad|sessão|unauthorized/i').count() > 0
        expect(isOnLogin || hasError).toBeTruthy()
    })

    test('rota inexistente deve redirecionar para /', async ({ page }) => {
        await page.goto(BASE + '/login')
        await page.evaluate(() => localStorage.clear())

        await page.goto(BASE + '/rota-que-nao-existe-abc123')
        await page.waitForTimeout(2000)

        // Should redirect to / (which redirects to /login since unauthenticated)
        expect(page.url()).toContain('/login')
    })

    test('API offline deve mostrar feedback gracioso (sem crash)', async ({ page }) => {
        await page.goto(BASE + '/login')

        // Block all API requests
        await page.route('**/api/**', (route) => route.abort('connectionrefused'))

        await page.fill('input#email', 'test@test.com')
        await page.fill('input#password', 'password')
        await page.click('button[type="submit"]')

        await page.waitForTimeout(2000)

        // Page should still be functional — no white screen
        const body = await page.textContent('body')
        expect(body?.length).toBeGreaterThan(10) // not a blank page

        // Should show some error message
        const hasError = await page.locator('text=/erro|server|conexão|conectar/i').count() > 0
        expect(hasError).toBeTruthy()
    })

    test('localStorage limpo deve redirecionar para login', async ({ page }) => {
        await page.goto(BASE + '/login')
        await page.evaluate(() => localStorage.clear())

        await page.goto(BASE + '/')
        await page.waitForURL(/\/login/, { timeout: 5000 })
        expect(page.url()).toContain('/login')
    })
})
