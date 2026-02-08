import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// Helper: Simula login direto via API e seta token no localStorage
async function loginAsAdmin(page: import('@playwright/test').Page) {
    // Go to login first to ensure the app is loaded
    await page.goto(BASE + '/login')

    // Attempt API login
    const response = await page.request.post('http://localhost:8000/api/v1/login', {
        data: { email: 'admin@sistema.com', password: 'password' },
    })

    if (response.ok()) {
        const body = await response.json()
        const token = body.token || body.data?.token

        if (token) {
            await page.evaluate((t) => {
                localStorage.setItem('auth-storage', JSON.stringify({
                    state: { token: t, isAuthenticated: true },
                    version: 0,
                }))
            }, token)
            await page.goto(BASE + '/')
            return true
        }
    }

    return false
}

test.describe('Navegação e CRUD', () => {
    test('sidebar deve conter menus principais', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.waitForSelector('nav', { timeout: 5000 })

        const menuTexts = await page.locator('nav').textContent()
        expect(menuTexts).toContain('Dashboard')
        expect(menuTexts).toContain('Cadastros')
        expect(menuTexts).toContain('Ordens de Serviço')
        expect(menuTexts).toContain('Financeiro')
    })

    test('página de clientes deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        // Check page header
        await expect(page.locator('h1').first()).toContainText(/clientes/i)
    })

    test('página de OS deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/ordens-de-servico')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1').first()).toContainText(/ordens de serviço/i)
    })

    test('página financeiro - contas a receber', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/financeiro/receber')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1').first()).toContainText(/receber/i)
    })

    test('página de relatórios deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/relatorios')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1').first()).toContainText(/relatórios/i)
    })
})
