import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
}

// ===========================================================================
// SECURITY — Auth, XSS, SQL Injection, Session
// ===========================================================================

test.describe('Security — Authentication Redirect', () => {
    test('unauthenticated visit to dashboard redirects to login', async ({ page }) => {
        await page.goto(BASE + '/login')
        await page.evaluate(() => localStorage.clear())

        await page.goto(BASE + '/')
        await page.waitForTimeout(3000)
        expect(page.url()).toContain('/login')
    })

    test('unauthenticated visit to clientes redirects to login', async ({ page }) => {
        await page.goto(BASE + '/login')
        await page.evaluate(() => localStorage.clear())

        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForTimeout(3000)
        expect(page.url()).toContain('/login')
    })
})

test.describe('Security — XSS Prevention', () => {
    test('script tags in search input are not executed', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        const search = page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]').first()
        if (await search.count() === 0) {
            test.skip(true, 'No search input found')
            return
        }

        const xssPayload = '<script>document.title="XSS"</script>'
        await search.fill(xssPayload)
        await page.waitForTimeout(1000)

        expect(await page.title()).not.toBe('XSS')
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
    })
})

test.describe('Security — SQL Injection Prevention', () => {
    test('SQL injection in search does not break the page', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        const search = page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]').first()
        if (await search.count() === 0) {
            test.skip(true, 'No search input')
            return
        }

        await search.fill("'; DROP TABLE customers; --")
        await page.waitForTimeout(1500)

        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)
        expect(body).not.toMatch(/SQLSTATE|syntax error|pgsql/i)
    })
})

test.describe('Security — Portal Route Isolation', () => {
    test('portal routes redirect to portal login', async ({ page }) => {
        await page.goto(BASE + '/login')
        await page.evaluate(() => localStorage.clear())

        await page.goto(BASE + '/portal')
        await page.waitForTimeout(3000)

        const url = page.url()
        expect(url.includes('/portal/login') || url.includes('/login')).toBeTruthy()
    })
})

test.describe('Security — Session Management', () => {
    test('authenticated user can access dashboard', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/')
        await page.waitForLoadState('networkidle')

        expect(page.url()).not.toContain('/login')
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
    })
})
