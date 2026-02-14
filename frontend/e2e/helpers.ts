import { type Page } from '@playwright/test'

const BASE = 'http://localhost:3000'
const API_BASE = 'http://127.0.0.1:8000/api/v1'

let cachedToken: string | null = null

export async function loginAsAdmin(page: Page): Promise<boolean> {
    await page.goto(BASE + '/login')

    // Reuse cached token if available
    if (cachedToken) {
        await page.evaluate((t) => {
            localStorage.setItem('auth_token', t)
            localStorage.setItem('auth-store', JSON.stringify({
                state: { token: t, isAuthenticated: true },
                version: 0,
            }))
        }, cachedToken)
        await page.goto(BASE + '/')
        return true
    }

    const credentials = [
        { email: 'admin@sistema.local', password: 'password' },
        { email: 'admin@sistema.com', password: 'password' },
    ]

    for (const c of credentials) {
        try {
            const response = await page.request.post(`${API_BASE}/login`, { data: c })
            if (!response.ok()) continue

            const body = await response.json()
            const token = body.token || body.data?.token
            if (!token) continue

            cachedToken = token

            await page.evaluate((t) => {
                localStorage.setItem('auth_token', t)
                localStorage.setItem('auth-store', JSON.stringify({
                    state: { token: t, isAuthenticated: true },
                    version: 0,
                }))
            }, token)

            await page.goto(BASE + '/')
            return true
        } catch {
            // API indisponível
        }
    }
    return false
}

export { BASE, API_BASE }
