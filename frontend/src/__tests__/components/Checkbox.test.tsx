import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Checkbox } from '@/components/ui/checkbox'

describe('Checkbox', () => {
    it('renders without crashing', () => {
        render(<Checkbox />)
        expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('is unchecked by default', () => {
        render(<Checkbox />)
        expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'unchecked')
    })

    it('can be default checked', () => {
        render(<Checkbox defaultChecked />)
        expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'checked')
    })

    it('calls onCheckedChange on click', () => {
        const onCheckedChange = vi.fn()
        render(<Checkbox onCheckedChange={onCheckedChange} />)
        fireEvent.click(screen.getByRole('checkbox'))
        expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it('handles disabled state', () => {
        render(<Checkbox disabled />)
        expect(screen.getByRole('checkbox')).toBeDisabled()
    })

    it('merges custom className', () => {
        render(<Checkbox className="my-checkbox" />)
        expect(screen.getByRole('checkbox').className).toContain('my-checkbox')
    })

    it('has correct display name', () => {
        expect(Checkbox.displayName).toBeDefined()
    })

    it('renders indicator when checked', () => {
        const { container } = render(<Checkbox defaultChecked />)
        const indicator = container.querySelector('[data-state="checked"]')
        expect(indicator).toBeInTheDocument()
    })

    it('supports aria-label', () => {
        render(<Checkbox aria-label="Aceitar termos" />)
        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-label', 'Aceitar termos')
    })

    it('supports id attribute', () => {
        render(<Checkbox id="terms" />)
        expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'terms')
    })
})
