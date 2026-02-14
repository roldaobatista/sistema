import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toggle } from '@/components/ui/toggle'

describe('Toggle', () => {
    it('renders without crashing', () => {
        render(<Toggle>Ativar</Toggle>)
        expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders children text', () => {
        render(<Toggle>Bold</Toggle>)
        expect(screen.getByText('Bold')).toBeInTheDocument()
    })

    it('is unpressed by default', () => {
        render(<Toggle>B</Toggle>)
        expect(screen.getByRole('button')).toHaveAttribute('data-state', 'off')
    })

    it('can be default pressed', () => {
        render(<Toggle defaultPressed>B</Toggle>)
        expect(screen.getByRole('button')).toHaveAttribute('data-state', 'on')
    })

    it('calls onPressedChange on click', () => {
        const onPressedChange = vi.fn()
        render(<Toggle onPressedChange={onPressedChange}>B</Toggle>)
        fireEvent.click(screen.getByRole('button'))
        expect(onPressedChange).toHaveBeenCalledWith(true)
    })

    it('handles disabled state', () => {
        render(<Toggle disabled>B</Toggle>)
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('merges custom className', () => {
        render(<Toggle className="my-toggle">B</Toggle>)
        expect(screen.getByRole('button').className).toContain('my-toggle')
    })

    it('has correct display name', () => {
        expect(Toggle.displayName).toBeDefined()
    })

    it('supports aria-label', () => {
        render(<Toggle aria-label="Toggle bold"><span data-testid="icon">B</span></Toggle>)
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Toggle bold')
    })

    it('renders with outline variant', () => {
        render(<Toggle variant="outline">B</Toggle>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('border')
    })

    it('renders with sm size', () => {
        render(<Toggle size="sm">B</Toggle>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('h-9')
    })

    it('renders with lg size', () => {
        render(<Toggle size="lg">B</Toggle>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('h-11')
    })
})
