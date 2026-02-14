import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Switch } from '@/components/ui/switch'

describe('Switch', () => {
    it('renders without crashing', () => {
        render(<Switch />)
        expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('is unchecked by default', () => {
        render(<Switch />)
        expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked')
    })

    it('can be checked', () => {
        render(<Switch defaultChecked />)
        expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked')
    })

    it('toggles on click', () => {
        const onCheckedChange = vi.fn()
        render(<Switch onCheckedChange={onCheckedChange} />)
        fireEvent.click(screen.getByRole('switch'))
        expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it('handles disabled state', () => {
        render(<Switch disabled />)
        expect(screen.getByRole('switch')).toBeDisabled()
    })

    it('merges custom className', () => {
        render(<Switch className="my-switch" />)
        expect(screen.getByRole('switch').className).toContain('my-switch')
    })

    it('has correct display name', () => {
        expect(Switch.displayName).toBeDefined()
    })

    it('has cursor-pointer when enabled', () => {
        render(<Switch />)
        expect(screen.getByRole('switch').className).toContain('cursor-pointer')
    })

    it('renders thumb element', () => {
        const { container } = render(<Switch />)
        const thumb = container.querySelector('[data-state]')
        expect(thumb).toBeInTheDocument()
    })

    it('supports aria-label', () => {
        render(<Switch aria-label="Ativar notificações" />)
        expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Ativar notificações')
    })
})
