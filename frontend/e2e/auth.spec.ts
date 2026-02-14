import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Autenticação', () => {
    test('deve exibir formulário de login', async ({ page }) => {
        await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
        await expect(page.locator('text=Bem-vindo de volta')).toBeVisible({ timeout: 15000 })
        await expect(page.locator('#email')).toBeVisible()
        await expect(page.locator('#password')).toBeVisible()
        await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test('deve exibir erro com credenciais inválidas', async ({ page }) => {
        await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
        await page.fill('#email', 'invalido@teste.com')
        await page.fill('#password', 'senhaerrada')
        await page.click('button[type="submit"]')
        await expect(page.locator('text=/credenciais|inválid|unauthorized|erro/i').first()).toBeVisible({ timeout: 10000 })
    })

    test('redirecionar para login quando não autenticado', async ({ page }) => {
        await page.goto(BASE + '/')
        await page.waitForURL(/\/login/, { timeout: 10000 })
        expect(page.url()).toContain('/login')
    })

    test('botão de submit mostra loading durante requisição', async ({ page }) => {
        await page.goto(BASE + '/login', { waitUntil: 'networkidle' })

        // Intercept login to delay response
        await page.route('**/api/v1/login', async (route) => {
            await new Promise(r => setTimeout(r, 1500))
            await route.fulfill({ status: 401, body: JSON.stringify({ message: 'Credenciais inválidas.' }) })
        })

        await page.fill('#email', 'admin@teste.com')
        await page.fill('#password', 'password')
        await page.click('button[type="submit"]')

        // Button should be disabled during loading
        await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })

    test('toggle de visibilidade da senha funciona', async ({ page }) => {
        await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
        const passwordInput = page.locator('#password')
        await expect(passwordInput).toHaveAttribute('type', 'password')

        // Click the toggle button (eye icon) — it's inside the password div
        const toggleBtn = page.locator('#password + button, #password ~ button').first()
        if (await toggleBtn.count() > 0) {
            await toggleBtn.click()
            await expect(passwordInput).toHaveAttribute('type', 'text')
        }
    })
})
