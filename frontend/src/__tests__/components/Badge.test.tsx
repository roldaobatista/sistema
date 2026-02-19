import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
    it('renders with children text', () => {
        render(<Badge>Active</Badge>)
        expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders default variant', () => {
        render(<Badge>Default</Badge>)
        const badge = screen.getByText('Default')
        expect(badge.className).toContain('bg-surface-100')
    })

    it('renders success variant', () => {
        render(<Badge variant="success">Paid</Badge>)
        const badge = screen.getByText('Paid')
        expect(badge.className).toContain('bg-emerald-50')
        expect(badge.className).toContain('text-emerald-700')
    })

    it('renders danger variant', () => {
        render(<Badge variant="danger">Overdue</Badge>)
        const badge = screen.getByText('Overdue')
        expect(badge.className).toContain('bg-red-50')
        expect(badge.className).toContain('text-red-700')
    })

    it('renders warning variant', () => {
        render(<Badge variant="warning">Pending</Badge>)
        const badge = screen.getByText('Pending')
        expect(badge.className).toContain('bg-amber-50')
    })

    it('renders info variant', () => {
        render(<Badge variant="info">Info</Badge>)
        const badge = screen.getByText('Info')
        expect(badge.className).toContain('bg-sky-50')
    })

    it('renders outline variant', () => {
        render(<Badge variant="outline">Outline</Badge>)
        const badge = screen.getByText('Outline')
        expect(badge.className).toContain('border')
    })

    it('renders children when dot prop is true', () => {
        render(<Badge dot>Status</Badge>)
        expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('renders without dot when dot prop is false/undefined', () => {
        render(<Badge>No Dot</Badge>)
        expect(screen.getByText('No Dot')).toBeInTheDocument()
    })

    it('merges custom className', () => {
        render(<Badge className="my-class">Custom</Badge>)
        expect(screen.getByText('Custom').className).toContain('my-class')
    })
})
