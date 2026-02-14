import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
}

// ===========================================================================
// MODULE COVERAGE — Equipamentos, Estoque, CRM, Chamados
// ===========================================================================

test.describe('Equipamentos Module', () => {
    test('equipment list page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/equipamentos')
        await page.waitForLoadState('networkidle')

        expect(page.url()).toContain('/equipamentos')
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })

    test('equipment list shows table or empty state', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/equipamentos')
        await page.waitForLoadState('networkidle')

        const hasTable = await page.locator('table, [role="table"]').count() > 0
        const hasEmpty = await page.locator('text=/nenhum|vazio|sem equipamento|cadastr/i').count() > 0
        const hasCards = await page.locator('[class*="card"], [class*="grid"]').count() > 0
        expect(hasTable || hasEmpty || hasCards).toBeTruthy()
    })

    test('equipment create page navigates correctly', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/equipamentos/novo')
        await page.waitForLoadState('networkidle')

        // Should have a form
        const hasForm = await page.locator('form, input, select').count() > 0
        expect(hasForm).toBeTruthy()
    })

    test('equipment calendar page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/equipamentos/calendario')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })

    test('standard weights page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/equipamentos/pesos-padrao')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})

test.describe('Estoque Module', () => {
    test('stock dashboard loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/estoque')
        await page.waitForLoadState('networkidle')

        expect(page.url()).toContain('/estoque')
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })

    test('stock movements page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/estoque/movimentacoes')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})

test.describe('CRM Module', () => {
    test('CRM dashboard loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/crm')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })

    test('CRM pipeline page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/crm/pipeline')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})

test.describe('Chamados Module', () => {
    test('service calls list page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/chamados')
        await page.waitForLoadState('networkidle')

        expect(page.url()).toContain('/chamados')
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })

    test('service call create page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/chamados/novo')
        await page.waitForLoadState('networkidle')

        const hasForm = await page.locator('form, input, select, textarea').count() > 0
        expect(hasForm).toBeTruthy()
    })
})

test.describe('INMETRO Module', () => {
    test('INMETRO main page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/inmetro')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })

    test('INMETRO concorrentes page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/inmetro/concorrentes')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})
