import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '@/components/ui/input'

describe('Input', () => {
    it('renders an input element', () => {
        render(<Input placeholder="Type here" />)
        expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
    })

    it('renders label when provided', () => {
        render(<Input label="Email" />)
        expect(screen.getByText('Email')).toBeInTheDocument()
    })

    it('generates id from label text (lowercase, dashes)', () => {
        render(<Input label="Full Name" />)
        const input = screen.getByLabelText('Full Name')
        expect(input.id).toBe('full-name')
    })

    it('uses provided id over auto-generated id', () => {
        render(<Input label="Name" id="my-id" />)
        const input = screen.getByLabelText('Name')
        expect(input.id).toBe('my-id')
    })

    it('shows error message when error prop is provided', () => {
        render(<Input error="Field is required" />)
        expect(screen.getByText('Field is required')).toBeInTheDocument()
    })

    it('applies red border classes when error is present', () => {
        render(<Input error="Required" placeholder="e" />)
        const input = screen.getByPlaceholderText('e')
        expect(input.className).toContain('border-red-300')
    })

    it('applies default border when no error', () => {
        render(<Input placeholder="ok" />)
        const input = screen.getByPlaceholderText('ok')
        expect(input.className).toContain('border-default')
    })

    it('shows hint text when hint prop is set and no error', () => {
        render(<Input hint="Optional field" />)
        expect(screen.getByText('Optional field')).toBeInTheDocument()
    })

    it('hides hint when error is present (error takes priority)', () => {
        render(<Input hint="Hint" error="Error" />)
        expect(screen.queryByText('Hint')).toBeNull()
        expect(screen.getByText('Error')).toBeInTheDocument()
    })

    it('is disabled when disabled prop is set', () => {
        render(<Input disabled placeholder="dis" />)
        expect(screen.getByPlaceholderText('dis')).toBeDisabled()
    })

    it('accepts value changes', () => {
        render(<Input placeholder="val" />)
        const input = screen.getByPlaceholderText('val') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'hello' } })
        expect(input.value).toBe('hello')
    })

    it('renders without label (no label element)', () => {
        render(<Input placeholder="no-label" />)
        expect(screen.queryByRole('label')).toBeNull()
        expect(screen.getByPlaceholderText('no-label')).toBeInTheDocument()
    })
})
