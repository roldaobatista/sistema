import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea', () => {
    it('renders without crashing', () => {
        render(<Textarea />)
        expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders label when provided', () => {
        render(<Textarea label="Descrição" />)
        expect(screen.getByText('Descrição')).toBeInTheDocument()
    })

    it('does not render label when not provided', () => {
        const { container } = render(<Textarea />)
        expect(container.querySelector('label')).toBeNull()
    })

    it('renders error message', () => {
        render(<Textarea error="Obrigatório" />)
        expect(screen.getByText('Obrigatório')).toBeInTheDocument()
    })

    it('applies error border styles', () => {
        render(<Textarea error="err" />)
        expect(screen.getByRole('textbox').className).toContain('border-red')
    })

    it('does not apply error styles when no error', () => {
        render(<Textarea />)
        expect(screen.getByRole('textbox').className).not.toContain('border-red')
    })

    it('handles disabled state', () => {
        render(<Textarea disabled />)
        expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('accepts placeholder', () => {
        render(<Textarea placeholder="Digite aqui..." />)
        expect(screen.getByPlaceholderText('Digite aqui...')).toBeInTheDocument()
    })

    it('handles value changes', () => {
        const onChange = vi.fn()
        render(<Textarea onChange={onChange} />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } })
        expect(onChange).toHaveBeenCalled()
    })

    it('merges custom className', () => {
        render(<Textarea className="custom-class" />)
        expect(screen.getByRole('textbox').className).toContain('custom-class')
    })

    it('has displayName Textarea', () => {
        expect(Textarea.displayName).toBe('Textarea')
    })

    it('renders rows attribute', () => {
        render(<Textarea rows={10} />)
        expect(screen.getByRole('textbox')).toHaveAttribute('rows', '10')
    })

    it('renders with label and error together', () => {
        render(<Textarea label="Obs" error="Muito curto" />)
        expect(screen.getByText('Obs')).toBeInTheDocument()
        expect(screen.getByText('Muito curto')).toBeInTheDocument()
    })
})
