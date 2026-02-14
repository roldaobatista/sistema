import { test, expect } from '@playwright/test'
import { loginAsAdmin, BASE } from './helpers'

test.describe('Navegação — Páginas Principais', () => {
    test('sidebar deve conter menus principais', async ({ page }) => {
        const loggedIn = await loginAsAdmin(page)
        test.skip(!loggedIn, 'API de login não disponível')

        await page.waitForSelector('nav', { timeout: 5000 })
        const menuTexts = await page.locator('nav').textContent()
        expect(menuTexts).toContain('Dashboard')
    })

    const pages = [
        { name: 'Dashboard', path: '/', heading: /dashboard|painel/i },
        { name: 'Clientes', path: '/cadastros/clientes', heading: /clientes/i },
        { name: 'Produtos', path: '/cadastros/produtos', heading: /produtos/i },
        { name: 'Serviços', path: '/cadastros/servicos', heading: /serviços|servicos/i },
        { name: 'Fornecedores', path: '/cadastros/fornecedores', heading: /fornecedores/i },
        { name: 'Ordens de Serviço', path: '/os', heading: /ordens|os/i },
        { name: 'Orçamentos', path: '/orcamentos', heading: /orçamentos|orcamentos/i },
        { name: 'Chamados', path: '/chamados', heading: /chamados/i },
        { name: 'Contas a Receber', path: '/financeiro/receber', heading: /receber/i },
        { name: 'Contas a Pagar', path: '/financeiro/pagar', heading: /pagar/i },
        { name: 'Comissões', path: '/financeiro/comissoes', heading: /comissões|comissoes/i },
        { name: 'Despesas', path: '/financeiro/despesas', heading: /despesas/i },
        { name: 'Fluxo de Caixa', path: '/financeiro/fluxo-caixa', heading: /fluxo|caixa/i },
        { name: 'Relatórios', path: '/relatorios', heading: /relatórios|relatorios/i },
        { name: 'Estoque', path: '/estoque', heading: /estoque/i },
        { name: 'Equipamentos', path: '/equipamentos', heading: /equipamentos/i },
        { name: 'INMETRO', path: '/inmetro', heading: /inmetro|inteligência/i },
        { name: 'CRM', path: '/crm', heading: /crm|funil|pipeline/i },
        { name: 'Configurações', path: '/configuracoes', heading: /configurações|configuracoes|ajustes/i },
        { name: 'Perfil', path: '/perfil', heading: /perfil|minha conta/i },
    ]

    for (const pg of pages) {
        test(`página ${pg.name} deve carregar (${pg.path})`, async ({ page }) => {
            const loggedIn = await loginAsAdmin(page)
            test.skip(!loggedIn, 'API de login não disponível')

            await page.goto(BASE + pg.path)
            await page.waitForLoadState('networkidle')

            const heading = page.locator('h1, h2, [data-testid="page-title"]').first()
            await expect(heading).toBeVisible({ timeout: 10000 })
        })
    }
})
