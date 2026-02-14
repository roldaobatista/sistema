import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PageHeader } from '@/components/ui/pageheader'

describe('PageHeader', () => {
    it('renders title', () => {
        render(<PageHeader title="Clientes" />)
        expect(screen.getByText('Clientes')).toBeInTheDocument()
    })

    it('renders title as h1', () => {
        render(<PageHeader title="Clientes" />)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Clientes')
    })

    it('renders subtitle when provided', () => {
        render(<PageHeader title="Clientes" subtitle="Gerencie seus clientes" />)
        expect(screen.getByText('Gerencie seus clientes')).toBeInTheDocument()
    })

    it('does not render subtitle when not provided', () => {
        const { container } = render(<PageHeader title="Clientes" />)
        const subtitleP = container.querySelectorAll('p')
        expect(subtitleP).toHaveLength(0)
    })

    it('renders count badge when provided', () => {
        render(<PageHeader title="Clientes" count={42} />)
        expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('renders count=0', () => {
        render(<PageHeader title="Clientes" count={0} />)
        expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('does not render count when not provided', () => {
        const { container } = render(<PageHeader title="Clientes" />)
        expect(container.querySelector('span')).toBeNull()
    })

    it('renders action buttons', () => {
        const onClick = vi.fn()
        render(
            <PageHeader
                title="Clientes"
                actions={[{ label: 'Novo Cliente', onClick }]}
            />
        )
        expect(screen.getByText('Novo Cliente')).toBeInTheDocument()
    })

    it('calls action onClick', () => {
        const onClick = vi.fn()
        render(
            <PageHeader
                title="Clientes"
                actions={[{ label: 'Novo', onClick }]}
            />
        )
        fireEvent.click(screen.getByText('Novo'))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('renders multiple actions', () => {
        render(
            <PageHeader
                title="Clientes"
                actions={[
                    { label: 'Novo', onClick: vi.fn() },
                    { label: 'Exportar', onClick: vi.fn() },
                ]}
            />
        )
        expect(screen.getByText('Novo')).toBeInTheDocument()
        expect(screen.getByText('Exportar')).toBeInTheDocument()
    })

    it('hides action when permission=false', () => {
        render(
            <PageHeader
                title="Clientes"
                actions={[{ label: 'Deletar', onClick: vi.fn(), permission: false }]}
            />
        )
        expect(screen.queryByText('Deletar')).not.toBeInTheDocument()
    })

    it('shows action when permission=true', () => {
        render(
            <PageHeader
                title="Clientes"
                actions={[{ label: 'Editar', onClick: vi.fn(), permission: true }]}
            />
        )
        expect(screen.getByText('Editar')).toBeInTheDocument()
    })

    it('renders children', () => {
        render(
            <PageHeader title="Clientes">
                <span data-testid="child">Filtros</span>
            </PageHeader>
        )
        expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('renders with all props', () => {
        render(
            <PageHeader title="OS" subtitle="Ordens de Serviço" count={15} actions={[{ label: 'Nova OS', onClick: vi.fn() }]}>
                <input placeholder="Buscar" />
            </PageHeader>
        )
        expect(screen.getByText('OS')).toBeInTheDocument()
        expect(screen.getByText('Ordens de Serviço')).toBeInTheDocument()
        expect(screen.getByText('15')).toBeInTheDocument()
        expect(screen.getByText('Nova OS')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Buscar')).toBeInTheDocument()
    })
})
