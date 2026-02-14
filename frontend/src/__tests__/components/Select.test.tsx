import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from '@/components/ui/select'

describe('Select', () => {
    it('renders without crashing', () => {
        render(<Select><option>A</option></Select>)
        expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders label when provided', () => {
        render(<Select label="Tipo"><option>A</option></Select>)
        expect(screen.getByText('Tipo')).toBeInTheDocument()
    })

    it('does not render label when not provided', () => {
        const { container } = render(<Select><option>A</option></Select>)
        expect(container.querySelector('label')).toBeNull()
    })

    it('renders error message', () => {
        render(<Select error="Campo obrigatório"><option>A</option></Select>)
        expect(screen.getByText('Campo obrigatório')).toBeInTheDocument()
    })

    it('applies error styles when error prop is set', () => {
        render(<Select error="err"><option>A</option></Select>)
        const sel = screen.getByRole('combobox')
        expect(sel.className).toContain('border-red')
    })

    it('does not apply error styles when no error', () => {
        render(<Select><option>A</option></Select>)
        const sel = screen.getByRole('combobox')
        expect(sel.className).not.toContain('border-red')
    })

    it('renders children options', () => {
        render(
            <Select>
                <option value="a">Opção A</option>
                <option value="b">Opção B</option>
                <option value="c">Opção C</option>
            </Select>
        )
        expect(screen.getAllByRole('option')).toHaveLength(3)
    })

    it('handles disabled state', () => {
        render(<Select disabled><option>A</option></Select>)
        expect(screen.getByRole('combobox')).toBeDisabled()
    })

    it('handles value changes', () => {
        const onChange = vi.fn()
        render(
            <Select onChange={onChange} defaultValue="a">
                <option value="a">A</option>
                <option value="b">B</option>
            </Select>
        )
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
        expect(onChange).toHaveBeenCalled()
    })

    it('merges custom className', () => {
        render(<Select className="my-class"><option>A</option></Select>)
        expect(screen.getByRole('combobox').className).toContain('my-class')
    })

    it('has displayName Select', () => {
        expect(Select.displayName).toBe('Select')
    })

    it('renders with label and error together', () => {
        render(<Select label="Status" error="Inválido"><option>A</option></Select>)
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Inválido')).toBeInTheDocument()
    })
})
