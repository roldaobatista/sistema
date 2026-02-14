import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}))

/**
 * Extended auth-store tests — deep permission logic, role checks, edge cases
 */
describe('auth-store — Extended Permission Logic', () => {
    beforeEach(() => {
        useAuthStore.setState({
            user: {
                id: 1,
                name: 'Admin',
                email: 'admin@test.com',
                phone: null,
                tenant_id: 1,
                roles: ['admin'],
                permissions: [
                    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
                    'workorder.view', 'workorder.create', 'workorder.update',
                    'quotes.quote.view', 'quotes.quote.create',
                    'financial.receivable.view', 'financial.payable.view',
                    'stock.view', 'stock.adjust',
                    'reports.view', 'reports.export',
                    'iam.user.view', 'iam.role.view',
                    'crm.deal.view', 'crm.deal.create',
                    'inmetro.owner.view', 'inmetro.instrument.view',
                ],
                all_permissions: [
                    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
                    'workorder.view', 'workorder.create', 'workorder.update',
                    'quotes.quote.view', 'quotes.quote.create',
                    'financial.receivable.view', 'financial.payable.view',
                    'stock.view', 'stock.adjust',
                    'reports.view', 'reports.export',
                    'iam.user.view', 'iam.role.view',
                    'crm.deal.view', 'crm.deal.create',
                    'inmetro.owner.view', 'inmetro.instrument.view',
                ],
                all_roles: ['admin'],
            },
            token: 'test-token',
            isAuthenticated: true,
            tenant: { id: 1, name: 'Empresa X', document: null, email: null, phone: null, status: 'active' },
        } as any)
    })

    // Individual permission checks
    it('hasPermission for customers.view', () => {
        expect(useAuthStore.getState().hasPermission('customers.view')).toBe(true)
    })

    it('hasPermission for customers.create', () => {
        expect(useAuthStore.getState().hasPermission('customers.create')).toBe(true)
    })

    it('hasPermission for customers.update', () => {
        expect(useAuthStore.getState().hasPermission('customers.update')).toBe(true)
    })

    it('hasPermission for customers.delete', () => {
        expect(useAuthStore.getState().hasPermission('customers.delete')).toBe(true)
    })

    it('hasPermission for workorder.view', () => {
        expect(useAuthStore.getState().hasPermission('workorder.view')).toBe(true)
    })

    it('hasPermission for workorder.create', () => {
        expect(useAuthStore.getState().hasPermission('workorder.create')).toBe(true)
    })

    it('hasPermission for quotes.quote.view', () => {
        expect(useAuthStore.getState().hasPermission('quotes.quote.view')).toBe(true)
    })

    it('hasPermission for financial.receivable.view', () => {
        expect(useAuthStore.getState().hasPermission('financial.receivable.view')).toBe(true)
    })

    it('hasPermission for stock.view', () => {
        expect(useAuthStore.getState().hasPermission('stock.view')).toBe(true)
    })

    it('hasPermission for reports.export', () => {
        expect(useAuthStore.getState().hasPermission('reports.export')).toBe(true)
    })

    it('hasPermission for crm.deal.view', () => {
        expect(useAuthStore.getState().hasPermission('crm.deal.view')).toBe(true)
    })

    it('hasPermission for inmetro.owner.view', () => {
        expect(useAuthStore.getState().hasPermission('inmetro.owner.view')).toBe(true)
    })

    // Negative cases
    it('denies permission not in list', () => {
        expect(useAuthStore.getState().hasPermission('admin.super')).toBe(false)
    })

    it('denies empty permission', () => {
        expect(useAuthStore.getState().hasPermission('')).toBe(false)
    })

    it('denies permission with typo', () => {
        expect(useAuthStore.getState().hasPermission('customer.view')).toBe(false)
    })

    it('denies partial permission match', () => {
        expect(useAuthStore.getState().hasPermission('customers')).toBe(false)
    })

    // Role checks — roles are string[]
    it('hasRole admin', () => {
        expect(useAuthStore.getState().hasRole('admin')).toBe(true)
    })

    it('denies hasRole for non-existent role', () => {
        expect(useAuthStore.getState().hasRole('superadmin')).toBe(false)
    })

    it('denies hasRole for empty string', () => {
        expect(useAuthStore.getState().hasRole('')).toBe(false)
    })

    // State accessors
    it('user name is Admin', () => {
        expect(useAuthStore.getState().user?.name).toBe('Admin')
    })

    it('user email is admin@test.com', () => {
        expect(useAuthStore.getState().user?.email).toBe('admin@test.com')
    })

    it('token is set', () => {
        expect(useAuthStore.getState().token).toBe('test-token')
    })

    it('isAuthenticated is true', () => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    it('tenant name is Empresa X', () => {
        expect(useAuthStore.getState().tenant?.name).toBe('Empresa X')
    })

    // Null user state
    it('denies permissions when user is null', () => {
        useAuthStore.setState({ user: null } as any)
        expect(useAuthStore.getState().hasPermission('customers.view')).toBe(false)
    })

    it('denies roles when user is null', () => {
        useAuthStore.setState({ user: null } as any)
        expect(useAuthStore.getState().hasRole('admin')).toBe(false)
    })
})
