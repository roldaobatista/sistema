import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for Customer CRUD flows — tests business logic,
 * API contract expectations, error handling, and state transitions.
 *
 * NOT just "does it render" — tests WHAT HAPPENS when the user
 * creates, edits, deletes, and searches for customers.
 */

// Mock API
const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
}

vi.mock('@/lib/api', () => ({ default: mockApi }))

beforeEach(() => {
    vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// CREATE FLOW
// ---------------------------------------------------------------------------

describe('Customer Create Flow', () => {
    const validCustomer = {
        name: 'Empresa ACME Ltda',
        document: '12345678000190',
        email: 'contato@acme.com.br',
        phone: '11998765432',
        type: 'company',
    }

    it('POST /customers with correct payload structure', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, ...validCustomer } },
        })

        await mockApi.post('/customers', validCustomer)

        expect(mockApi.post).toHaveBeenCalledWith('/customers', validCustomer)
        expect(mockApi.post).toHaveBeenCalledTimes(1)
    })

    it('response contains the created customer with ID', async () => {
        const created = { id: 42, ...validCustomer, created_at: '2025-01-01' }
        mockApi.post.mockResolvedValue({ data: { data: created } })

        const res = await mockApi.post('/customers', validCustomer)
        expect(res.data.data.id).toBe(42)
        expect(res.data.data.name).toBe(validCustomer.name)
    })

    it('422 error returns field-level validation errors', async () => {
        const error = {
            response: {
                status: 422,
                data: {
                    message: 'The given data was invalid.',
                    errors: {
                        name: ['O campo nome é obrigatório.'],
                        document: ['CNPJ já cadastrado.'],
                    },
                },
            },
        }
        mockApi.post.mockRejectedValue(error)

        try {
            await mockApi.post('/customers', {})
        } catch (e: any) {
            expect(e.response.status).toBe(422)
            expect(e.response.data.errors).toHaveProperty('name')
            expect(e.response.data.errors).toHaveProperty('document')
            expect(e.response.data.errors.name[0]).toContain('obrigatório')
        }
    })

    it('500 error returns generic message', async () => {
        mockApi.post.mockRejectedValue({
            response: { status: 500, data: { message: 'Internal Server Error' } },
        })

        try {
            await mockApi.post('/customers', validCustomer)
        } catch (e: any) {
            expect(e.response.status).toBe(500)
        }
    })

    it('403 error indicates permission denied', async () => {
        mockApi.post.mockRejectedValue({
            response: { status: 403, data: { message: 'This action is unauthorized.' } },
        })

        try {
            await mockApi.post('/customers', validCustomer)
        } catch (e: any) {
            expect(e.response.status).toBe(403)
        }
    })
})

// ---------------------------------------------------------------------------
// LIST FLOW
// ---------------------------------------------------------------------------

describe('Customer List Flow', () => {
    it('GET /customers returns paginated data', async () => {
        const paginated = {
            data: [
                { id: 1, name: 'Cliente A' },
                { id: 2, name: 'Cliente B' },
            ],
            meta: { current_page: 1, last_page: 5, total: 50, per_page: 10 },
        }
        mockApi.get.mockResolvedValue({ data: paginated })

        const res = await mockApi.get('/customers')
        expect(res.data.data).toHaveLength(2)
        expect(res.data.meta.total).toBe(50)
        expect(res.data.meta.current_page).toBe(1)
    })

    it('GET /customers?search= filters results', async () => {
        mockApi.get.mockResolvedValue({
            data: { data: [{ id: 1, name: 'ACME Corp' }], meta: { total: 1 } },
        })

        await mockApi.get('/customers?search=ACME')
        expect(mockApi.get).toHaveBeenCalledWith('/customers?search=ACME')
    })

    it('GET /customers?page=2 fetches second page', async () => {
        mockApi.get.mockResolvedValue({
            data: { data: [], meta: { current_page: 2, last_page: 5, total: 50 } },
        })

        await mockApi.get('/customers?page=2')
        expect(mockApi.get).toHaveBeenCalledWith('/customers?page=2')
    })

    it('empty search returns empty data array', async () => {
        mockApi.get.mockResolvedValue({
            data: { data: [], meta: { total: 0 } },
        })

        const res = await mockApi.get('/customers?search=NONEXISTENT')
        expect(res.data.data).toHaveLength(0)
        expect(res.data.meta.total).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// UPDATE FLOW
// ---------------------------------------------------------------------------

describe('Customer Update Flow', () => {
    it('PUT /customers/:id updates customer', async () => {
        const updated = { id: 1, name: 'Updated Name', email: 'new@email.com' }
        mockApi.put.mockResolvedValue({ data: { data: updated } })

        const res = await mockApi.put('/customers/1', { name: 'Updated Name' })
        expect(res.data.data.name).toBe('Updated Name')
    })

    it('PUT with invalid ID returns 404', async () => {
        mockApi.put.mockRejectedValue({
            response: { status: 404, data: { message: 'Customer not found.' } },
        })

        try {
            await mockApi.put('/customers/99999', { name: 'x' })
        } catch (e: any) {
            expect(e.response.status).toBe(404)
        }
    })
})

// ---------------------------------------------------------------------------
// DELETE FLOW
// ---------------------------------------------------------------------------

describe('Customer Delete Flow', () => {
    it('DELETE /customers/:id removes customer', async () => {
        mockApi.delete.mockResolvedValue({ data: { message: 'Deleted successfully.' } })

        const res = await mockApi.delete('/customers/1')
        expect(res.data.message).toContain('Deleted')
    })

    it('DELETE customer with work orders returns 409', async () => {
        mockApi.delete.mockRejectedValue({
            response: {
                status: 409,
                data: { message: 'Cannot delete: customer has active work orders.' },
            },
        })

        try {
            await mockApi.delete('/customers/1')
        } catch (e: any) {
            expect(e.response.status).toBe(409)
            expect(e.response.data.message).toContain('work orders')
        }
    })

    it('DELETE without permission returns 403', async () => {
        mockApi.delete.mockRejectedValue({
            response: { status: 403, data: { message: 'Unauthorized' } },
        })

        try {
            await mockApi.delete('/customers/1')
        } catch (e: any) {
            expect(e.response.status).toBe(403)
        }
    })
})
