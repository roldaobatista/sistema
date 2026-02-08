import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

test.describe('Autenticação', () => {
    test('deve exibir formulário de login', async ({ page }) => {
        await page.goto(BASE + '/login')
        await expect(page.locator('h1, h2').first()).toBeVisible()
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
        await expect(page.locator('input[type="password"]')).toBeVisible()
        await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test('deve exibir erro com credenciais inválidas', async ({ page }) => {
        await page.goto(BASE + '/login')
        await page.fill('input[type="email"], input[name="email"]', 'invalido@teste.com')
        await page.fill('input[type="password"]', 'senhaerrada')
        await page.click('button[type="submit"]')
        // Wait for error message or toast
        await expect(page.locator('text=/credenciais|inválid|unauthorized|erro/i').first()).toBeVisible({ timeout: 5000 })
    })

    test('redirecionar para login quando não autenticado', async ({ page }) => {
        await page.goto(BASE + '/')
        await page.waitForURL(/\/login/, { timeout: 5000 })
        expect(page.url()).toContain('/login')
    })
})
