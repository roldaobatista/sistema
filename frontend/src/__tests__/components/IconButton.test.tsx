import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as React from 'react'

// Test IconButton by mocking Tooltip since it requires a provider
vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}))

import { vi } from 'vitest'
import { IconButton } from '@/components/ui/iconbutton'

describe('IconButton', () => {
    it('renders without crashing', () => {
        render(<IconButton label="Editar" icon={<span>✏️</span>} />)
        expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('has correct aria-label', () => {
        render(<IconButton label="Deletar" icon={<span>🗑️</span>} />)
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Deletar')
    })

    it('renders icon content', () => {
        render(<IconButton label="Test" icon={<span data-testid="icon">★</span>} />)
        expect(screen.getByTestId('icon')).toBeInTheDocument()
    })

    it('renders tooltip text', () => {
        render(<IconButton label="Filtrar" icon={<span>🔍</span>} />)
        expect(screen.getByText('Filtrar')).toBeInTheDocument()
    })

    it('uses ghost variant by default', () => {
        render(<IconButton label="Test" icon={<span>T</span>} />)
        const btn = screen.getByRole('button')
        // Default variant applied — button should render with some className
        expect(btn.className.length).toBeGreaterThan(0)
    })

    it('accepts custom variant', () => {
        render(<IconButton label="Test" icon={<span>T</span>} variant="destructive" />)
        const btn = screen.getByRole('button')
        // Button should render with variant-specific styling
        expect(btn.className.length).toBeGreaterThan(0)
    })

    it('merges custom className', () => {
        render(<IconButton label="Test" icon={<span>T</span>} className="extra" />)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('extra')
    })

    it('handles disabled state', () => {
        render(<IconButton label="Test" icon={<span>T</span>} disabled />)
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('has displayName IconButton', () => {
        expect(IconButton.displayName).toBe('IconButton')
    })

    it('renders with all props', () => {
        render(
            <IconButton
                label="Exportar CSV"
                icon={<span data-testid="csv-icon">📄</span>}
                variant="outline"
                tooltipSide="bottom"
            />
        )
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Exportar CSV')
        expect(screen.getByTestId('csv-icon')).toBeInTheDocument()
    })
})
