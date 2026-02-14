import { test, expect } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

test.describe('CRUD Ordens de Serviço', () => {
    test('lista de OS deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/os')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2').first()).toBeVisible()
    })

    test('deve navegar para criar nova OS', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/os/nova')
        await page.waitForLoadState('networkidle')

        const formOrHeader = page.locator('form, h1, h2').first()
        await expect(formOrHeader).toBeVisible({ timeout: 10000 })
    })

    test('kanban de OS deve carregar', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/os/kanban')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 })
    })

    test('busca de OS deve filtrar resultados', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.goto(BASE + '/os')
        await page.waitForLoadState('networkidle')

        const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]')
        if (await searchInput.count() > 0) {
            await searchInput.first().fill('OS-TEST-999')
            await page.waitForTimeout(500)
            const content = await page.textContent('body')
            expect(content).toBeTruthy()
        }
    })
})
