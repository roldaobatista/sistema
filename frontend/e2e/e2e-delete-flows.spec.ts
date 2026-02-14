import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

async function ensureLoggedIn(page: Page) {
    const ok = await loginAsAdmin(page)
    test.skip(!ok, 'API de login não disponível')
}

// ===========================================================================
// DELETE FLOWS — Confirmation dialog, cancel, success, error
// ===========================================================================

test.describe('Delete Flow — Orçamentos', () => {
    test('delete button opens confirmation dialog', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/orcamentos')
        await page.waitForLoadState('networkidle')

        // Find a delete button (trash icon)
        const deleteBtn = page.locator('button[title="Excluir"], button:has(svg.lucide-trash-2), [aria-label*="xcluir" i]').first()
        if (await deleteBtn.count() === 0) {
            test.skip(true, 'No delete buttons visible — no records to delete')
            return
        }

        await deleteBtn.click()
        await page.waitForTimeout(500)

        // Confirmation dialog should appear
        const dialog = page.locator('text=/certeza|confirmar|deseja excluir/i').first()
        await expect(dialog).toBeVisible({ timeout: 5000 })
    })

    test('cancel button closes dialog without deleting', async ({ page }) => {
        await ensureLoggedIn(page)
        await page.goto(BASE + '/orcamentos')
        await page.waitForLoadState('networkidle')

        const deleteBtn = page.locator('button[title="Excluir"], button:has(svg.lucide-trash-2), [aria-label*="xcluir" i]').first()
        if (await deleteBtn.count() === 0) {
            test.skip(true, 'No delete buttons visible')
            return
        }

        // Count rows before
        const rowsBefore = await page.locator('tbody tr').count()

        await deleteBtn.click()
        await page.waitForTimeout(500)

        // Click cancel
        const cancelBtn = page.locator('button:has-text("Cancelar")').first()
        if (await cancelBtn.count() > 0) {
            await cancelBtn.click()
            await page.waitForTimeout(500)

            // Dialog should close
            const dialogGone = await page.locator('text=/certeza|deseja excluir/i').count() === 0
            expect(dialogGone).toBeTruthy()

            // Rows should be the same
            const rowsAfter = await page.locator('tbody tr').count()
            expect(rowsAfter).toBe(rowsBefore)
        }
    })
})

test.describe('Delete Flow — Financeiro', () => {
    const pages = [
        { name: 'Contas a Receber', path: '/financeiro/receber' },
        { name: 'Contas a Pagar', path: '/financeiro/pagar' },
        { name: 'Despesas', path: '/financeiro/despesas' },
    ]

    for (const fp of pages) {
        test(`${fp.name}: delete opens confirmation modal`, async ({ page }) => {
            await ensureLoggedIn(page)
            await page.goto(BASE + fp.path)
            await page.waitForLoadState('networkidle')

            const deleteBtn = page.locator('button[title="Excluir"], button:has(svg.lucide-trash-2), [aria-label="Excluir"]').first()
            if (await deleteBtn.count() === 0) {
                test.skip(true, `No delete buttons on ${fp.name}`)
                return
            }

            await deleteBtn.click()
            await page.waitForTimeout(500)

            // Should see confirmation
            const hasConfirm = await page.locator('text=/certeza|confirmar|excluir/i').count() > 0
            const hasModal = await page.locator('[role="dialog"], .fixed.inset-0').count() > 0
            expect(hasConfirm || hasModal).toBeTruthy()
        })
    }
})

test.describe('Delete Flow — Error Handling', () => {
    test('delete with 409 conflict shows restriction message', async ({ page }) => {
        await ensureLoggedIn(page)

        // Intercept delete to return 409
        await page.route('**/api/v1/**', async (route) => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({
                    status: 409,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Não é possível excluir: existem registros vinculados.' }),
                })
            } else {
                await route.continue()
            }
        })

        await page.goto(BASE + '/financeiro/formas-pagamento')
        await page.waitForLoadState('networkidle')

        const deleteBtn = page.locator('button[title="Excluir"], button:has(svg.lucide-trash-2), [aria-label="Excluir"]').first()
        if (await deleteBtn.count() === 0) {
            test.skip(true, 'No delete buttons visible')
            return
        }

        await deleteBtn.click()
        await page.waitForTimeout(500)

        // Confirm delete
        const confirmBtn = page.locator('button:has-text("Excluir"), button:has-text("Confirmar")').last()
        if (await confirmBtn.count() > 0) {
            await confirmBtn.click()
            await page.waitForTimeout(2000)

            // Should show error toast or message
            const body = await page.textContent('body')
            const hasErrorMsg = body?.match(/não é possível|vinculados|dependência|erro/i) !== null
            expect(hasErrorMsg).toBeTruthy()
        }
    })

    test('delete with 403 forbidden shows permission error', async ({ page }) => {
        await ensureLoggedIn(page)

        await page.route('**/api/v1/**', async (route) => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({
                    status: 403,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Sem permissão para exclusão.' }),
                })
            } else {
                await route.continue()
            }
        })

        await page.goto(BASE + '/financeiro/formas-pagamento')
        await page.waitForLoadState('networkidle')

        const deleteBtn = page.locator('button[title="Excluir"], button:has(svg.lucide-trash-2), [aria-label="Excluir"]').first()
        if (await deleteBtn.count() === 0) {
            test.skip(true, 'No delete buttons visible')
            return
        }

        await deleteBtn.click()
        await page.waitForTimeout(500)

        const confirmBtn = page.locator('button:has-text("Excluir"), button:has-text("Confirmar")').last()
        if (await confirmBtn.count() > 0) {
            await confirmBtn.click()
            await page.waitForTimeout(2000)

            const body = await page.textContent('body')
            const hasPermError = body?.match(/permissão|proibido|403|forbidden/i) !== null
            expect(hasPermError).toBeTruthy()
        }
    })
})
