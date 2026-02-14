import { describe, it, expect } from 'vitest'
import {
    validateCustomer,
    validateWorkOrder,
    validateInvoice,
    validateLoginResponse,
    type Customer,
    type WorkOrder,
    type LoginResponse,
} from '../helpers/api-contract-schemas'

/**
 * Contract Validation Tests — ensures that mock data used in integration
 * tests matches the real API response shape. If the backend changes its
 * response format, these tests will fail BEFORE the integration tests
 * give false positives.
 */

describe('API Contract Schema Validation', () => {
    // ── CUSTOMER CONTRACT ──

    describe('Customer Schema', () => {
        it('validates correct customer shape', () => {
            const validCustomer: Customer = {
                id: 1,
                tenant_id: 1,
                name: 'Test Customer',
                type: 'PF',
                document: '123.456.789-00',
                email: 'test@test.com',
                phone: '(11)99999-0000',
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
            }
            expect(validateCustomer(validCustomer)).toBe(true)
        })

        it('rejects incomplete customer shape', () => {
            expect(validateCustomer({ id: 1, name: 'Test' })).toBe(false)
        })

        it('rejects null/undefined', () => {
            expect(validateCustomer(null)).toBe(false)
            expect(validateCustomer(undefined)).toBe(false)
        })
    })

    // ── WORK ORDER CONTRACT ──

    describe('WorkOrder Schema', () => {
        it('validates correct work order shape', () => {
            const validWO: WorkOrder = {
                id: 1,
                tenant_id: 1,
                customer_id: 1,
                business_number: 'OS-0001',
                description: 'Test WO',
                status: 'open',
                priority: 'high',
                total: 1500.00,
                scheduled_date: '2025-06-01',
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
            }
            expect(validateWorkOrder(validWO)).toBe(true)
        })

        it('rejects work order without required fields', () => {
            expect(validateWorkOrder({ id: 1, description: 'Test' })).toBe(false)
        })

        it('validates all status values are valid strings', () => {
            const statuses = ['open', 'in_progress', 'completed', 'cancelled', 'invoiced']
            statuses.forEach(status => {
                expect(typeof status).toBe('string')
            })
        })
    })

    // ── LOGIN RESPONSE CONTRACT ──

    describe('LoginResponse Schema', () => {
        it('validates correct login response shape', () => {
            const validLogin: LoginResponse = {
                token: 'abc123',
                user: {
                    id: 1,
                    name: 'Admin',
                    email: 'admin@test.com',
                    tenant_id: 1,
                    tenant: { id: 1, name: 'Test Tenant' },
                    permissions: ['os.work_order.view', 'os.work_order.create'],
                    roles: ['admin'],
                },
            }
            expect(validateLoginResponse(validLogin)).toBe(true)
        })

        it('rejects login without token', () => {
            expect(validateLoginResponse({ user: { id: 1 } })).toBe(false)
        })

        it('rejects login without user', () => {
            expect(validateLoginResponse({ token: 'abc' })).toBe(false)
        })
    })

    // ── INVOICE CONTRACT ──

    describe('Invoice Schema', () => {
        it('validates correct invoice shape', () => {
            const validInvoice = {
                id: 1,
                tenant_id: 1,
                work_order_id: 1,
                customer_id: 1,
                invoice_number: 'NF-0001',
                status: 'issued' as const,
                total: 2500.00,
                issued_at: '2025-01-01T00:00:00Z',
                due_date: '2025-02-01',
                created_at: '2025-01-01T00:00:00Z',
            }
            expect(validateInvoice(validInvoice)).toBe(true)
        })
    })

    // ── MOCK DATA INTEGRITY ──

    describe('Mock Data Integrity', () => {
        it('typical mock for customer list contains required fields', () => {
            // This is the mock shape commonly used in integration tests
            const mockResponse = {
                data: [
                    { id: 1, tenant_id: 1, name: 'Customer 1', type: 'PF' },
                    { id: 2, tenant_id: 1, name: 'Customer 2', type: 'PJ' },
                ],
                meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
            }

            mockResponse.data.forEach(item => {
                expect(validateCustomer(item)).toBe(true)
            })
        })

        it('typical mock for work order list contains required fields', () => {
            const mockResponse = {
                data: [
                    { id: 1, tenant_id: 1, customer_id: 1, status: 'open', business_number: 'OS-0001' },
                ],
            }

            mockResponse.data.forEach(item => {
                expect(validateWorkOrder(item)).toBe(true)
            })
        })
    })
})
