import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Permissão e Acesso', () => {
    test('deve redirecionar rotas protegidas para login', async ({ page }) => {
        await page.goto(BASE + '/login')
        await page.evaluate(() => localStorage.clear())

        const protectedRoutes = [
            '/',
            '/cadastros/clientes',
            '/os',
            '/financeiro/receber',
            '/financeiro/pagar',
            '/financeiro/comissoes',
            '/financeiro/despesas',
            '/relatorios',
            '/estoque',
            '/equipamentos',
            '/inmetro',
            '/crm',
            '/configuracoes',
            '/iam/usuarios',
        ]

        for (const route of protectedRoutes) {
            await page.goto(BASE + route)
            await page.waitForURL(/\/login/, { timeout: 5000 })
            expect(page.url()).toContain('/login')
        }
    })

    test('token expirado deve redirecionar para login', async ({ page }) => {
        await page.goto(BASE + '/login')

        await page.evaluate(() => {
            localStorage.setItem('auth-store', JSON.stringify({
                state: { token: 'expired-invalid-token', isAuthenticated: true },
                version: 0,
            }))
            localStorage.setItem('auth_token', 'expired-invalid-token')
        })

        await page.goto(BASE + '/')
        await page.waitForTimeout(3000)
        const url = page.url()
        const hasLoginRedirect = url.includes('/login')
        const hasErrorMsg = await page.locator('text=/unauthorized|sessão|expirad/i').count() > 0

        expect(hasLoginRedirect || hasErrorMsg).toBeTruthy()
    })

    test('rotas do portal devem redirecionar para portal/login', async ({ page }) => {
        await page.goto(BASE + '/portal/login')
        await page.evaluate(() => localStorage.clear())

        await page.goto(BASE + '/portal')
        await page.waitForURL(/\/portal\/login/, { timeout: 5000 })
        expect(page.url()).toContain('/portal/login')
    })
})
