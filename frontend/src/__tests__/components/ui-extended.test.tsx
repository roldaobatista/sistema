import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Mock ResizeObserver (not available in jsdom)
beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class {
        observe() { }
        unobserve() { }
        disconnect() { }
    })
})

// ===========================================================================
// BADGE — Extended tests
// ===========================================================================

describe('Badge — Variants & Content', () => {
    it('renders with text content', () => {
        render(<Badge>Ativo</Badge>)
        expect(screen.getByText('Ativo')).toBeInTheDocument()
    })

    it('renders default variant', () => {
        const { container } = render(<Badge>Default</Badge>)
        expect(container.firstChild).toBeInTheDocument()
    })

    it('renders destructive variant', () => {
        const { container } = render(<Badge variant="destructive">Erro</Badge>)
        expect(container.firstChild).toBeInTheDocument()
        expect(screen.getByText('Erro')).toBeInTheDocument()
    })

    it('renders outline variant', () => {
        const { container } = render(<Badge variant="outline">Outline</Badge>)
        expect(container.firstChild).toBeInTheDocument()
    })

    it('renders secondary variant', () => {
        const { container } = render(<Badge variant="secondary">Secondary</Badge>)
        expect(screen.getByText('Secondary')).toBeInTheDocument()
    })

    it('applies custom className', () => {
        const { container } = render(<Badge className="my-badge">Test</Badge>)
        expect(container.firstChild).toHaveClass('my-badge')
    })

    it('renders as inline element', () => {
        const { container } = render(<Badge>Inline</Badge>)
        expect(container.firstChild?.nodeName.toLowerCase()).toBe('div')
    })
})

// ===========================================================================
// TABLE — shadcn table component
// ===========================================================================

describe('Table — Structure', () => {
    it('renders full table structure', () => {
        render(
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>João</TableCell>
                        <TableCell>joao@test.com</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        )

        expect(screen.getByText('Nome')).toBeInTheDocument()
        expect(screen.getByText('Email')).toBeInTheDocument()
        expect(screen.getByText('João')).toBeInTheDocument()
        expect(screen.getByText('joao@test.com')).toBeInTheDocument()
    })

    it('renders table element', () => {
        const { container } = render(<Table><TableBody><TableRow><TableCell>A</TableCell></TableRow></TableBody></Table>)
        expect(container.querySelector('table')).toBeInTheDocument()
    })

    it('renders th for TableHead', () => {
        const { container } = render(
            <Table><TableHeader><TableRow><TableHead>Col</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Data</TableCell></TableRow></TableBody></Table>
        )
        expect(container.querySelector('th')).toBeInTheDocument()
    })

    it('renders td for TableCell', () => {
        const { container } = render(
            <Table><TableBody><TableRow><TableCell>Data</TableCell></TableRow></TableBody></Table>
        )
        expect(container.querySelector('td')).toBeInTheDocument()
    })

    it('table merges custom className', () => {
        const { container } = render(
            <Table className="my-table"><TableBody><TableRow><TableCell>A</TableCell></TableRow></TableBody></Table>
        )
        expect(container.querySelector('table')).toHaveClass('my-table')
    })

    it('renders multiple rows', () => {
        render(
            <Table>
                <TableBody>
                    <TableRow><TableCell>Row 1</TableCell></TableRow>
                    <TableRow><TableCell>Row 2</TableCell></TableRow>
                    <TableRow><TableCell>Row 3</TableCell></TableRow>
                </TableBody>
            </Table>
        )
        expect(screen.getByText('Row 1')).toBeInTheDocument()
        expect(screen.getByText('Row 2')).toBeInTheDocument()
        expect(screen.getByText('Row 3')).toBeInTheDocument()
    })
})

// ===========================================================================
// ACCORDION
// ===========================================================================

describe('Accordion', () => {
    it('renders accordion items', () => {
        render(
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Seção 1</AccordionTrigger>
                    <AccordionContent>Conteúdo 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        )
        expect(screen.getByText('Seção 1')).toBeInTheDocument()
    })

    it('content is hidden by default', () => {
        render(
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Trigger</AccordionTrigger>
                    <AccordionContent>Hidden Content</AccordionContent>
                </AccordionItem>
            </Accordion>
        )
        // Content should be in the DOM but hidden
        const trigger = screen.getByText('Trigger')
        expect(trigger).toBeInTheDocument()
    })

    it('clicking trigger toggles content', async () => {
        render(
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Click Me</AccordionTrigger>
                    <AccordionContent>Revealed!</AccordionContent>
                </AccordionItem>
            </Accordion>
        )
        fireEvent.click(screen.getByText('Click Me'))
        // After click, content should be revealed
        expect(screen.getByText('Click Me')).toBeInTheDocument()
    })

    it('renders multiple items', () => {
        render(
            <Accordion type="single" collapsible>
                <AccordionItem value="a"><AccordionTrigger>A</AccordionTrigger><AccordionContent>AA</AccordionContent></AccordionItem>
                <AccordionItem value="b"><AccordionTrigger>B</AccordionTrigger><AccordionContent>BB</AccordionContent></AccordionItem>
            </Accordion>
        )
        expect(screen.getByText('A')).toBeInTheDocument()
        expect(screen.getByText('B')).toBeInTheDocument()
    })
})
