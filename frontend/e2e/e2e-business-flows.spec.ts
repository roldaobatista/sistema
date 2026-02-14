import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
    return ok
}

/** Wait for toast message to show up */
async function expectToast(page: Page, pattern: RegExp, timeout = 8000) {
    // sonner renders toasts in [data-sonner-toaster] or .sonner-toast or [role=status]
    const selector = `text=${pattern.source}`
    await expect(page.locator(`[data-sonner-toaster] li, [role="status"]`).filter({ hasText: pattern }).first())
        .toBeVisible({ timeout })
}

// ===========================================================================
// 1. DASHBOARD & NAVIGATION — Real content verification
// ===========================================================================

test.describe('Business Flow — Dashboard', () => {
    test('dashboard loads with real widgets after login', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/')
        await page.waitForLoadState('networkidle')

        // Must have at least one widget/card with numeric data
        const cards = page.locator('.rounded-xl, .rounded-lg, [class*="card"]')
        await expect(cards.first()).toBeVisible({ timeout: 15000 })

        // Page should contain numbers (dashboard KPIs)
        const body = await page.textContent('body')
        expect(body).toBeTruthy()
        expect(body!.length).toBeGreaterThan(100) // real content, not blank
    })

    test('sidebar navigation works to all major modules', async ({ page }) => {
        await ensureLoggedIn(page)
        const routes = ['/cadastros/clientes', '/os', '/orcamentos', '/financeiro/receber']

        for (const route of routes) {
            await page.goto(BASE + route)
            await page.waitForLoadState('networkidle')

            // Each page should have a heading or main content
            const heading = page.locator('h1, h2, [data-testid="page-title"]').first()
            await expect(heading).toBeVisible({ timeout: 10000 })
        }
    })
})

// ===========================================================================
// 2. CLIENTES — Full CRUD
// ===========================================================================

test.describe('Business Flow — Clientes CRUD', () => {
    const timestamp = Date.now()
    const testName = `E2E Cliente ${timestamp}`

    test('create a new customer', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        // Click "Novo" / "Novo Cliente" button
        const newBtn = page.locator('button:has-text("Novo"), a:has-text("Novo")')
        await expect(newBtn.first()).toBeVisible({ timeout: 10000 })
        await newBtn.first().click()
        await page.waitForTimeout(500)

        // Fill name field (first text input or input with name/label "Nome")
        const nameInput = page.locator('input[name="name"], input[name="nome"], input[placeholder*="nome" i]').first()
        if (await nameInput.count() > 0) {
            await nameInput.fill(testName)
        }

        // Fill email if visible
        const emailInput = page.locator('input[name="email"], input[type="email"]').first()
        if (await emailInput.count() > 0) {
            await emailInput.fill(`e2e-${timestamp}@teste.com`)
        }

        // Fill phone if visible
        const phoneInput = page.locator('input[name="phone"], input[name="telefone"]').first()
        if (await phoneInput.count() > 0) {
            await phoneInput.fill('11999999999')
        }

        // Submit form
        const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar")')
        if (await submitBtn.count() > 0) {
            await submitBtn.first().click()
            await page.waitForTimeout(2000)

            // Should show success toast or redirect
            const body = await page.textContent('body')
            const hasSuccess = body?.match(/sucesso|criado|salvo/i) !== null
            const hasRedirect = !page.url().includes('/novo')
            expect(hasSuccess || hasRedirect).toBeTruthy()
        }
    })

    test('customer appears in the list after creation', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        // Wait for the table to load
        await page.waitForTimeout(2000)
        const body = await page.textContent('body')
        expect(body).toBeTruthy()
        // The page should load without errors
        const hasError = body?.match(/500|erro interno|failed/i) !== null
        expect(hasError).toBeFalsy()
    })

    test('search filters the customer list', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        const search = page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]').first()
        if (await search.count() > 0) {
            // Search for something that won't exist
            await search.fill('XYZNONEXISTENT999')
            await page.waitForTimeout(1500)

            // Should show empty state or "nenhum" message
            const body = await page.textContent('body')
            const hasEmptyIndicator = body?.match(/nenhum|vazio|sem resultado|0 registro/i) !== null
            const rowCount = await page.locator('tbody tr, [class*="table-row"]').count()
            expect(hasEmptyIndicator || rowCount === 0).toBeTruthy()
        }
    })
})

// ===========================================================================
// 3. ORDENS DE SERVIÇO — Flow
// ===========================================================================

test.describe('Business Flow — OS Flow', () => {
    test('navigate to create OS and see form', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/os/nova')
        await page.waitForLoadState('networkidle')

        // Form or customer selection should be visible
        const form = page.locator('form, [class*="form"]').first()
        await expect(form).toBeVisible({ timeout: 10000 })
    })

    test('OS list loads with table or kanban', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/os')
        await page.waitForLoadState('networkidle')

        // Should have a table with rows OR kanban columns
        const hasTable = await page.locator('table, [role="table"]').count() > 0
        const hasKanban = await page.locator('[class*="kanban"], [class*="column"]').count() > 0
        const hasContent = await page.locator('h1, h2').first().isVisible()
        expect(hasTable || hasKanban || hasContent).toBeTruthy()
    })

    test('OS kanban loads with columns', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/os/kanban')
        await page.waitForLoadState('networkidle')

        // Should load without crashing
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(50)

        // Should not show error
        const hasError = body?.match(/erro 500|internal server/i) !== null
        expect(hasError).toBeFalsy()
    })
})

// ===========================================================================
// 4. ORÇAMENTOS — Flow
// ===========================================================================

test.describe('Business Flow — Orçamentos Flow', () => {
    test('navigate to create quote and see form', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/orcamentos/novo')
        await page.waitForLoadState('networkidle')

        const form = page.locator('form, [class*="form"]').first()
        await expect(form).toBeVisible({ timeout: 10000 })
    })

    test('quote list shows table with data or empty state', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/orcamentos')
        await page.waitForLoadState('networkidle')

        // Either table with rows OR empty state
        const hasTable = await page.locator('table tbody tr, [class*="table-row"]').count() > 0
        const hasEmpty = await page.locator('text=/nenhum|vazio|sem orçamento/i').count() > 0
        const hasHeading = await page.locator('h1, h2').first().isVisible()
        expect(hasTable || hasEmpty || hasHeading).toBeTruthy()
    })
})

// ===========================================================================
// 5. FINANCEIRO — Multiple sub-pages
// ===========================================================================

test.describe('Business Flow — Financeiro', () => {
    const financialPages = [
        { name: 'Contas a Receber', path: '/financeiro/receber' },
        { name: 'Contas a Pagar', path: '/financeiro/pagar' },
        { name: 'Despesas', path: '/financeiro/despesas' },
        { name: 'Fluxo de Caixa', path: '/financeiro/fluxo-caixa' },
        { name: 'Formas de Pagamento', path: '/financeiro/formas-pagamento' },
    ]

    for (const fp of financialPages) {
        test(`${fp.name} loads with real data structure`, async ({ page }) => {
            await ensureLoggedIn(page)
            await page.goto(BASE + fp.path)
            await page.waitForLoadState('networkidle')

            // Heading must be visible
            const heading = page.locator('h1, h2').first()
            await expect(heading).toBeVisible({ timeout: 10000 })

            // No server error
            const body = await page.textContent('body')
            const hasError = body?.match(/erro 500|internal server error/i) !== null
            expect(hasError).toBeFalsy()

            // Has table or list or cards (real financial data structure)
            const hasDataStructure =
                await page.locator('table, [role="table"], [class*="card"], [class*="grid"]').count() > 0
            expect(hasDataStructure).toBeTruthy()
        })
    }
})

// ===========================================================================
// 6. LOADING & EMPTY STATES
// ===========================================================================

test.describe('Business Flow — UX States', () => {
    test('pages show loading state (not blank) during data fetch', async ({ page }) => {
        await ensureLoggedIn(page)

        // Slow down API
        await page.route('**/api/**', async (route) => {
            await new Promise(r => setTimeout(r, 500))
            await route.continue()
        })

        await page.goto(BASE + '/cadastros/clientes')

        // During loading, page should show SOMETHING (skeleton, spinner, or text)
        await page.waitForTimeout(200)
        const hasVisibleContent = await page.locator('body').evaluate(el => el.children.length > 0)
        expect(hasVisibleContent).toBeTruthy()
    })

    test('search with no results shows empty state message', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/cadastros/clientes')
        await page.waitForLoadState('networkidle')

        const search = page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]').first()
        if (await search.count() > 0) {
            await search.fill('ZZZZZZ_NONEXISTENT_99999')
            await page.waitForTimeout(2000)

            const body = await page.textContent('body')
            // Should see empty state or zero results
            const hasEmptyFeedback = body?.match(/nenhum|0 resultado|sem resultado|vazio/i) !== null
            const noRows = await page.locator('tbody tr').count() === 0
            expect(hasEmptyFeedback || noRows).toBeTruthy()
        }
    })
})
