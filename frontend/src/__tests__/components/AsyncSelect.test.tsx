import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AsyncSelect } from '@/components/ui/asyncselect'

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { data: [] } }),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}))

describe('AsyncSelect', () => {
    const defaultProps = {
        onChange: vi.fn(),
        endpoint: '/api/customers',
    }

    beforeEach(() => vi.clearAllMocks())

    it('renders without crashing', () => {
        const { container } = render(<AsyncSelect {...defaultProps} />)
        expect(container.firstChild).toBeInTheDocument()
    })

    it('shows default placeholder', () => {
        render(<AsyncSelect {...defaultProps} />)
        expect(screen.getByText('Selecione...')).toBeInTheDocument()
    })

    it('shows custom placeholder', () => {
        render(<AsyncSelect {...defaultProps} placeholder="Escolha um cliente" />)
        expect(screen.getByText('Escolha um cliente')).toBeInTheDocument()
    })

    it('shows label when provided', () => {
        render(<AsyncSelect {...defaultProps} label="Cliente" />)
        expect(screen.getByText('Cliente')).toBeInTheDocument()
    })

    it('opens dropdown on click', () => {
        render(<AsyncSelect {...defaultProps} />)
        fireEvent.click(screen.getByText('Selecione...'))
        expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument()
    })

    it('does not open dropdown when disabled', () => {
        render(<AsyncSelect {...defaultProps} disabled />)
        fireEvent.click(screen.getByText('Selecione...'))
        expect(screen.queryByPlaceholderText('Buscar...')).not.toBeInTheDocument()
    })

    it('has opacity-50 when disabled', () => {
        const { container } = render(<AsyncSelect {...defaultProps} disabled />)
        const trigger = container.querySelector('.opacity-50')
        expect(trigger).toBeInTheDocument()
    })

    it('update search input value', () => {
        render(<AsyncSelect {...defaultProps} />)
        fireEvent.click(screen.getByText('Selecione...'))
        const input = screen.getByPlaceholderText('Buscar...')
        fireEvent.change(input, { target: { value: 'Test' } })
        expect(input).toHaveValue('Test')
    })

    it('shows Nenhum resultado when options empty', async () => {
        render(<AsyncSelect {...defaultProps} />)
        fireEvent.click(screen.getByText('Selecione...'))
        await waitFor(() => {
            expect(screen.getByText('Nenhum resultado encontrado')).toBeInTheDocument()
        })
    })

    it('has search icon', () => {
        const { container } = render(<AsyncSelect {...defaultProps} />)
        const searchIcon = container.querySelector('svg')
        expect(searchIcon).toBeInTheDocument()
    })

    it('renders as relative container', () => {
        const { container } = render(<AsyncSelect {...defaultProps} />)
        expect(container.firstChild).toHaveClass('relative')
    })
})
