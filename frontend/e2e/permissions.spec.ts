import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

test.describe('Permissão e Acesso', () => {
    test('deve redirecionar rotas protegidas para login', async ({ page }) => {
        // Clear any stored auth
        await page.goto(BASE + '/login')
        await page.evaluate(() => localStorage.clear())

        const protectedRoutes = [
            '/',
            '/cadastros/clientes',
            '/ordens-de-servico',
            '/financeiro/receber',
            '/financeiro/pagar',
            '/financeiro/comissoes',
            '/financeiro/despesas',
            '/relatorios',
        ]

        for (const route of protectedRoutes) {
            await page.goto(BASE + route)
            await page.waitForURL(/\/login/, { timeout: 5000 })
            expect(page.url()).toContain('/login')
        }
    })

    test('token expirado deve redirecionar para login', async ({ page }) => {
        await page.goto(BASE + '/login')

        // Set an expired/invalid token
        await page.evaluate(() => {
            localStorage.setItem('auth-storage', JSON.stringify({
                state: { token: 'expired-invalid-token', isAuthenticated: true },
                version: 0,
            }))
        })

        await page.goto(BASE + '/')
        // Either redirects to login or shows error — both acceptable
        await page.waitForTimeout(3000)
        const url = page.url()
        const hasLoginRedirect = url.includes('/login')
        const hasErrorMsg = await page.locator('text=/unauthorized|sessão|expirad/i').count() > 0

        expect(hasLoginRedirect || hasErrorMsg).toBeTruthy()
    })
})
