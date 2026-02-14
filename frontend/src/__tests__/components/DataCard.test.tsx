import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataCard } from '@/components/ui/datacard'

describe('DataCard', () => {
    it('renders title', () => {
        render(<DataCard title="Resumo">Content</DataCard>)
        expect(screen.getByText('Resumo')).toBeInTheDocument()
    })

    it('renders title as h3', () => {
        render(<DataCard title="Título">Content</DataCard>)
        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Título')
    })

    it('renders children', () => {
        render(<DataCard title="T"><p>Body content</p></DataCard>)
        expect(screen.getByText('Body content')).toBeInTheDocument()
    })

    it('renders headerAction when provided', () => {
        render(
            <DataCard title="T" headerAction={<button>Ação</button>}>
                Content
            </DataCard>
        )
        expect(screen.getByText('Ação')).toBeInTheDocument()
    })

    it('does not render headerAction when not provided', () => {
        const { container } = render(<DataCard title="T">Content</DataCard>)
        expect(container.querySelectorAll('button')).toHaveLength(0)
    })

    it('applies padding by default', () => {
        const { container } = render(<DataCard title="T">Content</DataCard>)
        const contentDiv = container.querySelector('.p-4')
        expect(contentDiv).toBeInTheDocument()
    })

    it('removes padding when noPadding=true', () => {
        const { container } = render(<DataCard title="T" noPadding>Content</DataCard>)
        const contentDiv = container.querySelector('.p-4')
        expect(contentDiv).toBeNull()
    })

    it('merges custom className', () => {
        const { container } = render(<DataCard title="T" className="extra-class">Content</DataCard>)
        expect(container.firstChild).toHaveClass('extra-class')
    })

    it('has rounded-xl border classes', () => {
        const { container } = render(<DataCard title="T">Content</DataCard>)
        expect(container.firstChild).toHaveClass('rounded-xl')
    })

    it('renders complex children', () => {
        render(
            <DataCard title="Stats">
                <div data-testid="stat1">R$ 1.000</div>
                <div data-testid="stat2">R$ 2.000</div>
            </DataCard>
        )
        expect(screen.getByTestId('stat1')).toBeInTheDocument()
        expect(screen.getByTestId('stat2')).toBeInTheDocument()
    })
})
