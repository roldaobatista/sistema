import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function TabsExample({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
    return (
        <Tabs value={value} onValueChange={onValueChange}>
            <TabsList>
                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">Content 1</TabsContent>
            <TabsContent value="tab2">Content 2</TabsContent>
            <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
    )
}

describe('Tabs', () => {
    it('renders trigger buttons', () => {
        render(<TabsExample value="tab1" onValueChange={vi.fn()} />)
        expect(screen.getByText('Tab 1')).toBeInTheDocument()
        expect(screen.getByText('Tab 2')).toBeInTheDocument()
        expect(screen.getByText('Tab 3')).toBeInTheDocument()
    })

    it('shows active tab content', () => {
        render(<TabsExample value="tab1" onValueChange={vi.fn()} />)
        expect(screen.getByText('Content 1')).toBeInTheDocument()
    })

    it('hides inactive tab content', () => {
        render(<TabsExample value="tab1" onValueChange={vi.fn()} />)
        expect(screen.queryByText('Content 2')).not.toBeInTheDocument()
        expect(screen.queryByText('Content 3')).not.toBeInTheDocument()
    })

    it('calls onValueChange when trigger is clicked', () => {
        const onChange = vi.fn()
        render(<TabsExample value="tab1" onValueChange={onChange} />)
        fireEvent.click(screen.getByText('Tab 2'))
        expect(onChange).toHaveBeenCalledWith('tab2')
    })

    it('shows tab2 content when value=tab2', () => {
        render(<TabsExample value="tab2" onValueChange={vi.fn()} />)
        expect(screen.getByText('Content 2')).toBeInTheDocument()
        expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    })

    it('shows tab3 content when value=tab3', () => {
        render(<TabsExample value="tab3" onValueChange={vi.fn()} />)
        expect(screen.getByText('Content 3')).toBeInTheDocument()
    })

    it('TabsTrigger renders as button', () => {
        render(<TabsExample value="tab1" onValueChange={vi.fn()} />)
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThanOrEqual(3)
    })

    it('TabsTrigger has type=button', () => {
        render(<TabsExample value="tab1" onValueChange={vi.fn()} />)
        const buttons = screen.getAllByRole('button')
        buttons.forEach(btn => expect(btn).toHaveAttribute('type', 'button'))
    })

    it('active trigger has active styles', () => {
        render(<TabsExample value="tab1" onValueChange={vi.fn()} />)
        expect(screen.getByText('Tab 1').className).toContain('bg-white')
    })

    it('inactive trigger has inactive styles', () => {
        render(<TabsExample value="tab1" onValueChange={vi.fn()} />)
        expect(screen.getByText('Tab 2').className).toContain('text-surface-500')
    })

    it('TabsList merges className', () => {
        render(
            <Tabs value="a" onValueChange={vi.fn()}>
                <TabsList className="my-list">
                    <TabsTrigger value="a">A</TabsTrigger>
                </TabsList>
            </Tabs>
        )
        const list = screen.getByText('A').parentElement!
        expect(list.className).toContain('my-list')
    })

    it('Tabs merges className', () => {
        const { container } = render(
            <Tabs value="a" onValueChange={vi.fn()} className="custom-tabs">
                <TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList>
            </Tabs>
        )
        expect(container.firstChild).toHaveClass('custom-tabs')
    })

    it('TabsContent merges className', () => {
        render(
            <Tabs value="a" onValueChange={vi.fn()}>
                <TabsContent value="a" className="my-content">Hello</TabsContent>
            </Tabs>
        )
        expect(screen.getByText('Hello')).toHaveClass('my-content')
    })
})
