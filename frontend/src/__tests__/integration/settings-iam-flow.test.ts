import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for Settings, Tenant Management, and User Profile.
 */

const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
}

vi.mock('@/lib/api', () => ({ default: mockApi }))

beforeEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------
// TENANT SETTINGS
// ---------------------------------------------------------------------------

describe('Settings — Tenant Config', () => {
    it('get tenant settings', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: {
                    name: 'Kalibrium Labs',
                    document: '12.345.678/0001-90',
                    email: 'contato@kalibrium.com',
                    phone: '11999999999',
                    os_prefix: 'OS',
                    os_next_number: 1001,
                    quote_prefix: 'ORC',
                    logo_url: '/logos/tenant-1.png',
                },
            },
        })

        const res = await mockApi.get('/settings')
        expect(res.data.data.name).toBe('Kalibrium Labs')
        expect(res.data.data.os_prefix).toBe('OS')
    })

    it('update tenant settings', async () => {
        mockApi.put.mockResolvedValue({
            data: { message: 'Configurações atualizadas com sucesso!' },
        })

        const res = await mockApi.put('/settings', { name: 'New Name', phone: '11888888888' })
        expect(res.data.message).toContain('sucesso')
    })

    it('upload tenant logo', async () => {
        mockApi.post.mockResolvedValue({
            data: { logo_url: '/logos/tenant-1-new.png' },
        })

        const res = await mockApi.post('/settings/logo', new FormData())
        expect(res.data.logo_url).toBeTruthy()
    })
})

// ---------------------------------------------------------------------------
// USER PROFILE
// ---------------------------------------------------------------------------

describe('Settings — User Profile', () => {
    it('get current user profile', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: {
                    id: 1,
                    name: 'Admin User',
                    email: 'admin@kalibrium.com',
                    avatar_url: null,
                    created_at: '2025-01-01',
                },
            },
        })

        const res = await mockApi.get('/me')
        expect(res.data.data.name).toBe('Admin User')
        expect(res.data.data.email).toBeTruthy()
    })

    it('update profile name and email', async () => {
        mockApi.put.mockResolvedValue({
            data: { data: { name: 'Updated Name', email: 'new@email.com' } },
        })

        const res = await mockApi.put('/profile', { name: 'Updated Name', email: 'new@email.com' })
        expect(res.data.data.name).toBe('Updated Name')
    })

    it('change password requires current password', async () => {
        mockApi.put.mockRejectedValue({
            response: {
                status: 422,
                data: { errors: { current_password: ['Senha atual incorreta.'] } },
            },
        })

        try {
            await mockApi.put('/profile/password', { current_password: 'wrong', password: 'new123', password_confirmation: 'new123' })
        } catch (e: any) {
            expect(e.response.status).toBe(422)
            expect(e.response.data.errors).toHaveProperty('current_password')
        }
    })

    it('successful password change', async () => {
        mockApi.put.mockResolvedValue({
            data: { message: 'Senha alterada com sucesso!' },
        })

        const res = await mockApi.put('/profile/password', {
            current_password: 'oldpass',
            password: 'newpass123',
            password_confirmation: 'newpass123',
        })
        expect(res.data.message).toContain('sucesso')
    })
})

// ---------------------------------------------------------------------------
// IAM — USER MANAGEMENT
// ---------------------------------------------------------------------------

describe('IAM — User Management', () => {
    it('list users', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, name: 'Admin', email: 'admin@test.com', roles: ['admin'], is_active: true },
                    { id: 2, name: 'Tech', email: 'tech@test.com', roles: ['technician'], is_active: true },
                ],
                meta: { total: 2 },
            },
        })

        const res = await mockApi.get('/users')
        expect(res.data.data).toHaveLength(2)
        expect(res.data.data[0].roles).toContain('admin')
    })

    it('create user', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 3, name: 'New User', email: 'new@test.com', roles: ['viewer'] },
            },
        })

        const res = await mockApi.post('/users', {
            name: 'New User',
            email: 'new@test.com',
            password: 'password123',
            roles: ['viewer'],
        })
        expect(res.data.data.id).toBe(3)
    })

    it('assign role to user', async () => {
        mockApi.put.mockResolvedValue({
            data: { data: { id: 2, roles: ['technician', 'manager'] } },
        })

        const res = await mockApi.put('/users/2/roles', { roles: ['technician', 'manager'] })
        expect(res.data.data.roles).toContain('manager')
    })

    it('deactivate user', async () => {
        mockApi.patch.mockResolvedValue({
            data: { data: { id: 2, is_active: false } },
        })

        const res = await mockApi.patch('/users/2', { is_active: false })
        expect(res.data.data.is_active).toBe(false)
    })

    it('cannot delete own account', async () => {
        mockApi.delete.mockRejectedValue({
            response: {
                status: 422,
                data: { message: 'Você não pode remover sua própria conta.' },
            },
        })

        try {
            await mockApi.delete('/users/1')
        } catch (e: any) {
            expect(e.response.status).toBe(422)
            expect(e.response.data.message).toContain('própria')
        }
    })
})

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------

describe('Notifications', () => {
    it('list unread notifications', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, type: 'os_completed', title: 'OS #100 finalizada', read: false },
                    { id: 2, type: 'payment_received', title: 'Pagamento recebido', read: false },
                ],
                unread_count: 2,
            },
        })

        const res = await mockApi.get('/notifications?read=false')
        expect(res.data.unread_count).toBe(2)
    })

    it('mark notification as read', async () => {
        mockApi.patch.mockResolvedValue({
            data: { data: { id: 1, read: true } },
        })

        const res = await mockApi.patch('/notifications/1', { read: true })
        expect(res.data.data.read).toBe(true)
    })

    it('mark all as read', async () => {
        mockApi.post.mockResolvedValue({
            data: { message: 'Todas as notificações marcadas como lidas.' },
        })

        const res = await mockApi.post('/notifications/mark-all-read')
        expect(res.data.message).toContain('lidas')
    })
})
