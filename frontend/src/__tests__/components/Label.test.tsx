import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'

describe('Label', () => {
    it('renders without crashing', () => {
        render(<Label>Nome</Label>)
        expect(screen.getByText('Nome')).toBeInTheDocument()
    })

    it('renders as label element', () => {
        const { container } = render(<Label>Nome</Label>)
        expect(container.querySelector('label')).toBeInTheDocument()
    })

    it('merges custom className', () => {
        render(<Label className="my-label">Nome</Label>)
        expect(screen.getByText('Nome')).toHaveClass('my-label')
    })

    it('has correct display name', () => {
        expect(Label.displayName).toBeDefined()
    })

    it('supports htmlFor attribute', () => {
        render(<Label htmlFor="email">Email</Label>)
        expect(screen.getByText('Email')).toHaveAttribute('for', 'email')
    })

    it('has text-[13px] font size', () => {
        render(<Label>Campo</Label>)
        expect(screen.getByText('Campo').className).toContain('text-[13px]')
    })

    it('has font-medium class', () => {
        render(<Label>Campo</Label>)
        expect(screen.getByText('Campo').className).toContain('font-medium')
    })

    it('renders children content', () => {
        render(<Label>Required *</Label>)
        expect(screen.getByText('Required *')).toBeInTheDocument()
    })
})
