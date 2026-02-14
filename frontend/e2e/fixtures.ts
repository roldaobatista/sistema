import { type Page } from '@playwright/test'

export const BASE = 'http://localhost:3000'
export const API_BASE = 'http://127.0.0.1:8000/api/v1'

// ── TEST DATA FIXTURES ──

export const testCustomer = {
    type: 'PF',
    name: 'Cliente Teste E2E',
    document: '123.456.789-00',
    email: 'e2e_test@test.com',
    phone: '(11)99999-0000',
}

export const testCustomerPJ = {
    type: 'PJ',
    name: 'Empresa Teste E2E LTDA',
    document: '12.345.678/0001-90',
    email: 'empresa_e2e@test.com',
    phone: '(11)98888-0000',
}

export const testWorkOrder = {
    description: 'OS de Teste E2E - Calibração balança',
    priority: 'high',
}

export const testQuote = {
    title: 'Orçamento Teste E2E',
    valid_until: '2027-12-31',
}

// ── REUSABLE ACTIONS ──

export async function navigateToModule(page: Page, path: string) {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
}

export async function waitForToast(page: Page, textPattern: RegExp, timeout = 8000) {
    const toaster = page.locator('[data-sonner-toaster] li, [role="status"]')
        .filter({ hasText: textPattern })
    await toaster.first().waitFor({ state: 'visible', timeout })
}

export async function confirmDeleteDialog(page: Page) {
    // Look for confirm/delete button in dialog
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.waitFor({ state: 'visible', timeout: 5000 })
    const confirmBtn = dialog.locator('button').filter({ hasText: /excluir|deletar|confirmar|sim|delete/i })
    await confirmBtn.click()
}

export async function fillFormField(page: Page, label: string, value: string) {
    const field = page.locator(`label:has-text("${label}")`).locator('..').locator('input, textarea, select')
    await field.first().fill(value)
}

export async function clickSubmitButton(page: Page) {
    const submitBtn = page.locator('button[type="submit"], button:has-text("Salvar"), button:has-text("Criar")')
    await submitBtn.first().click()
}

export async function waitForPageLoad(page: Page) {
    await page.waitForLoadState('networkidle')
    // Wait for any loading skeletons to disappear
    const skeleton = page.locator('[class*="skeleton"], [class*="Skeleton"]').first()
    if (await skeleton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skeleton.waitFor({ state: 'hidden', timeout: 10000 })
    }
}
