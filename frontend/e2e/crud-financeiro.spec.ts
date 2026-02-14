import { test, expect } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

test.describe('CRUD Financeiro', () => {
    test('contas a receber deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/financeiro/receber')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })

    test('contas a pagar deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/financeiro/pagar')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })

    test('despesas deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/financeiro/despesas')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })

    test('fluxo de caixa deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/financeiro/fluxo-caixa')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })

    test('formas de pagamento deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/financeiro/formas-pagamento')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })

    test('comissões deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/financeiro/comissoes')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })
})
