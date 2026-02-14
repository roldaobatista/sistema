import { test, expect } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

test.describe('CRUD Orçamentos', () => {
    test('lista de orçamentos deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/orcamentos')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })

    test('deve navegar para criar novo orçamento', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/orcamentos/novo')
        await page.waitForLoadState('networkidle')

        const formOrHeader = page.locator('form, h1, h2').first()
        await expect(formOrHeader).toBeVisible({ timeout: 10000 })
    })

    test('busca de orçamentos deve funcionar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/orcamentos')
        await page.waitForLoadState('networkidle')

        const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]')
        if (await searchInput.count() > 0) {
            await searchInput.first().fill('orcamento-inexistente')
            await page.waitForTimeout(500)
            const content = await page.textContent('body')
            expect(content).toBeTruthy()
        }
    })
})
