import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@/components/ui/emptystate'

describe('EmptyState', () => {
    it('renders message', () => {
        render(<EmptyState message="Nenhum registro encontrado" />)
        expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument()
    })

    it('renders title when provided', () => {
        render(<EmptyState title="Vazio" message="Sem dados" />)
        expect(screen.getByText('Vazio')).toBeInTheDocument()
    })

    it('does not render title when not provided', () => {
        const { container } = render(<EmptyState message="Sem dados" />)
        const paragraphs = container.querySelectorAll('p')
        expect(paragraphs).toHaveLength(1)
    })

    it('renders default icon when none provided', () => {
        const { container } = render(<EmptyState message="Vazio" />)
        expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders custom icon when provided in compact mode', () => {
        render(<EmptyState message="Vazio" compact icon={<span data-testid="custom-icon">★</span>} />)
        expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })

    it('renders action button when provided', () => {
        const onClick = vi.fn()
        render(<EmptyState message="Vazio" action={{ label: 'Criar', onClick }} />)
        expect(screen.getByText('Criar')).toBeInTheDocument()
    })

    it('calls action onClick when button clicked', () => {
        const onClick = vi.fn()
        render(<EmptyState message="Vazio" action={{ label: 'Criar', onClick }} />)
        fireEvent.click(screen.getByText('Criar'))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not render action when not provided', () => {
        const { container } = render(<EmptyState message="Vazio" />)
        expect(container.querySelector('button')).toBeNull()
    })

    it('applies compact styles when compact=true', () => {
        const { container } = render(<EmptyState message="Vazio" compact />)
        expect(container.firstChild).toHaveClass('py-6')
    })

    it('applies normal styles when compact=false', () => {
        const { container } = render(<EmptyState message="Vazio" />)
        expect(container.firstChild).toHaveClass('py-12')
    })

    it('merges custom className', () => {
        const { container } = render(<EmptyState message="Vazio" className="extra" />)
        expect(container.firstChild).toHaveClass('extra')
    })

    it('renders action with icon', () => {
        const onClick = vi.fn()
        render(
            <EmptyState
                message="Vazio"
                action={{
                    label: 'Adicionar',
                    onClick,
                    icon: <span data-testid="btn-icon">+</span>,
                }}
            />
        )
        expect(screen.getByTestId('btn-icon')).toBeInTheDocument()
    })
})
