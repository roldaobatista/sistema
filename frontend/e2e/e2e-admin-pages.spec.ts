import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
}

// ===========================================================================
// IAM, CONFIGURAÇÕES, RELATÓRIOS, FINANCEIRO AVANÇADO, CADASTROS
// ===========================================================================

test.describe('IAM — Users & Roles', () => {
    test('users page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/iam/usuarios')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })

    test('roles page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/iam/roles')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })

    test('permissions matrix page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/iam/permissoes')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})

test.describe('Configurações', () => {
    test('settings page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/configuracoes')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })

    test('profile page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/configuracoes/perfil')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })

    test('audit logs page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/configuracoes/audit')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})

test.describe('Relatórios', () => {
    test('reports page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/relatorios')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })
})

test.describe('Financeiro — Páginas Avançadas', () => {
    test('cash flow page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/financeiro/fluxo-caixa')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })

    test('payment methods page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/financeiro/formas-pagamento')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })

    test('commissions page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/financeiro/comissoes')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })

    test('invoices page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/financeiro/notas')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})

test.describe('Cadastros — Produtos, Serviços, Fornecedores', () => {
    test('products page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/produtos')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })

    test('services page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/servicos')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })

    test('suppliers page loads', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/fornecedores')
        await page.waitForLoadState('networkidle')

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})
