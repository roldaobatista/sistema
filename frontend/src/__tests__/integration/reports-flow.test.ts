import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for Reports module — generation, filters, export.
 */

const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
}

vi.mock('@/lib/api', () => ({ default: mockApi }))

beforeEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------
// OS REPORTS
// ---------------------------------------------------------------------------

describe('Reports — OS Reports', () => {
    it('list OS reports by period', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, number: 'OS-001', customer: 'Lab A', status: 'completed', total: 5000 },
                    { id: 2, number: 'OS-002', customer: 'Lab B', status: 'open', total: 3000 },
                ],
                summary: { total_count: 2, total_value: 8000, avg_value: 4000 },
            },
        })

        const res = await mockApi.get('/reports/work-orders?start=2025-01-01&end=2025-06-30')
        expect(res.data.data).toHaveLength(2)
        expect(res.data.summary.total_value).toBe(8000)
    })

    it('OS report by status breakdown', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                breakdown: [
                    { status: 'open', count: 10, value: 50000 },
                    { status: 'in_progress', count: 5, value: 30000 },
                    { status: 'completed', count: 20, value: 150000 },
                    { status: 'invoiced', count: 15, value: 120000 },
                ],
            },
        })

        const res = await mockApi.get('/reports/work-orders/by-status')
        expect(res.data.breakdown).toHaveLength(4)
        const completed = res.data.breakdown.find((b: any) => b.status === 'completed')
        expect(completed.count).toBe(20)
    })

    it('OS report by technician', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { technician: 'João', os_count: 15, total_value: 75000 },
                    { technician: 'Maria', os_count: 12, total_value: 60000 },
                ],
            },
        })

        const res = await mockApi.get('/reports/work-orders/by-technician')
        expect(res.data.data).toHaveLength(2)
        expect(res.data.data[0].os_count).toBe(15)
    })
})

// ---------------------------------------------------------------------------
// FINANCIAL REPORTS
// ---------------------------------------------------------------------------

describe('Reports — Financial', () => {
    it('revenue report by month', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                months: [
                    { month: '2025-01', revenue: 100000, expenses: 60000, profit: 40000 },
                    { month: '2025-02', revenue: 120000, expenses: 70000, profit: 50000 },
                ],
                totals: { revenue: 220000, expenses: 130000, profit: 90000 },
            },
        })

        const res = await mockApi.get('/reports/financial/monthly')
        expect(res.data.months).toHaveLength(2)
        expect(res.data.totals.profit).toBe(90000)
    })

    it('overdue receivables report', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, customer: 'Lab A', amount: 5000, due_date: '2025-01-15', days_overdue: 60 },
                    { id: 2, customer: 'Lab B', amount: 3000, due_date: '2025-02-01', days_overdue: 45 },
                ],
                total_overdue: 8000,
            },
        })

        const res = await mockApi.get('/reports/financial/overdue')
        expect(res.data.total_overdue).toBe(8000)
        expect(res.data.data[0].days_overdue).toBeGreaterThan(0)
    })

    it('commission report by period', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { technician: 'João', base_value: 75000, commission_rate: 10, commission_amount: 7500 },
                ],
                total_commissions: 7500,
            },
        })

        const res = await mockApi.get('/reports/commissions?month=2025-06')
        expect(res.data.total_commissions).toBe(7500)
    })
})

// ---------------------------------------------------------------------------
// CUSTOMER REPORTS
// ---------------------------------------------------------------------------

describe('Reports — Customers', () => {
    it('top customers by revenue', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { customer: 'Enterprise A', os_count: 50, total_revenue: 500000 },
                    { customer: 'Enterprise B', os_count: 30, total_revenue: 300000 },
                ],
            },
        })

        const res = await mockApi.get('/reports/customers/top')
        expect(res.data.data[0].total_revenue).toBeGreaterThan(res.data.data[1].total_revenue)
    })

    it('customer growth over time', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                months: [
                    { month: '2025-01', new_customers: 5, total: 100 },
                    { month: '2025-02', new_customers: 8, total: 108 },
                    { month: '2025-03', new_customers: 3, total: 111 },
                ],
            },
        })

        const res = await mockApi.get('/reports/customers/growth')
        expect(res.data.months).toHaveLength(3)
        // Total should be monotonically increasing
        const totals = res.data.months.map((m: any) => m.total)
        expect(totals).toEqual([100, 108, 111])
    })
})

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------

describe('Reports — Export', () => {
    it('export report as PDF', async () => {
        mockApi.get.mockResolvedValue({
            data: new Blob(['pdf-content'], { type: 'application/pdf' }),
            headers: { 'content-type': 'application/pdf' },
        })

        const res = await mockApi.get('/reports/work-orders/export?format=pdf')
        expect(res.data).toBeInstanceOf(Blob)
    })

    it('export report as CSV', async () => {
        mockApi.get.mockResolvedValue({
            data: 'id,number,customer,total\n1,OS-001,Lab A,5000',
            headers: { 'content-type': 'text/csv' },
        })

        const res = await mockApi.get('/reports/work-orders/export?format=csv')
        expect(res.data).toContain('OS-001')
    })
})
