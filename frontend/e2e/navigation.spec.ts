import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'
const API_BASE = 'http://127.0.0.1:8000/api/v1'

// Helper: Simula login direto via API e seta token no localStorage
async function loginAsAdmin(page: import('@playwright/test').Page) {
    // Go to login first to ensure the app is loaded
    await page.goto(BASE + '/login')

    const credentials = [
        { email: 'admin@sistema.local', password: 'password' },
        { email: 'admin@sistema.com', password: 'password' },
    ]

    for (const c of credentials) {
        try {
            const response = await page.request.post(`${API_BASE}/login`, { data: c })
            if (!response.ok()) continue

            const body = await response.json()
            const token = body.token || body.data?.token
            if (!token) continue

            await page.evaluate((t) => {
                localStorage.setItem('auth_token', t)
                localStorage.setItem('auth-store', JSON.stringify({
                    state: { token: t, isAuthenticated: true },
                    version: 0,
                }))
            }, token)

            await page.goto(BASE + '/')
            return true
        } catch {
            // API indisponível para o teste atual
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

        await page.goto(BASE + '/os')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1').first()).toContainText(/ordens de serviço|ordens de servico|ordens/i)
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
