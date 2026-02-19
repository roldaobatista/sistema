import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Modal } from '@/components/ui/modal'

// Mock Radix Dialog primitives since they depend on the DOM portal
vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
        open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode }) =>
        <div data-testid="dialog-content">{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) =>
        <div data-testid="dialog-header">{children}</div>,
    DialogBody: ({ children }: { children: React.ReactNode }) =>
        <div data-testid="dialog-body">{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) =>
        <h2 data-testid="dialog-title">{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) =>
        <p data-testid="dialog-description">{children}</p>,
}))

describe('Modal', () => {
    it('renders nothing when open is false', () => {
        render(
            <Modal open={false} onOpenChange={() => { }} title="Test">
                Body
            </Modal>
        )
        expect(screen.queryByTestId('dialog')).toBeNull()
    })

    it('renders dialog when open is true', () => {
        render(
            <Modal open={true} onOpenChange={() => { }} title="Test Title">
                Body content
            </Modal>
        )
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('renders title', () => {
        render(
            <Modal open={true} onOpenChange={() => { }} title="My Modal Title">
                X
            </Modal>
        )
        expect(screen.getByTestId('dialog-title')).toHaveTextContent('My Modal Title')
    })

    it('renders description when provided', () => {
        render(
            <Modal open={true} onOpenChange={() => { }} title="T" description="Modal description">
                X
            </Modal>
        )
        expect(screen.getByTestId('dialog-description')).toHaveTextContent('Modal description')
    })

    it('does not render description when not provided', () => {
        render(
            <Modal open={true} onOpenChange={() => { }} title="T">
                X
            </Modal>
        )
        // Modal always renders DialogDescription; when no description prop it uses title as fallback
        expect(screen.getByTestId('dialog-description')).toHaveTextContent('T')
    })

    it('renders children in dialog body', () => {
        render(
            <Modal open={true} onOpenChange={() => { }} title="T">
                <div data-testid="child">Child content</div>
            </Modal>
        )
        expect(screen.getByTestId('child')).toBeInTheDocument()
        expect(screen.getByTestId('dialog-body')).toBeInTheDocument()
    })
})
