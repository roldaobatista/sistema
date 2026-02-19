import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

describe('Card', () => {
    it('renders Card with children', () => {
        render(<Card data-testid="card">Content</Card>)
        expect(screen.getByTestId('card')).toHaveTextContent('Content')
    })

    it('renders with border and shadow classes', () => {
        render(<Card data-testid="card">X</Card>)
        const card = screen.getByTestId('card')
        expect(card.className).toMatch(/rounded/)
        expect(card.className).toContain('border')
        expect(card.className).toMatch(/shadow/)
    })

    it('merges custom className', () => {
        render(<Card data-testid="card" className="my-card">X</Card>)
        expect(screen.getByTestId('card').className).toContain('my-card')
    })
})

describe('Card composition', () => {
    it('renders full Card composition (Header, Title, Description, Content, Footer)', () => {
        render(
            <Card data-testid="full-card">
                <CardHeader data-testid="header">
                    <CardTitle>My Title</CardTitle>
                    <CardDescription>My Description</CardDescription>
                </CardHeader>
                <CardContent data-testid="content">Body content</CardContent>
                <CardFooter data-testid="footer">Footer content</CardFooter>
            </Card>
        )

        expect(screen.getByTestId('full-card')).toBeInTheDocument()
        expect(screen.getByTestId('header')).toBeInTheDocument()
        expect(screen.getByText('My Title')).toBeInTheDocument()
        expect(screen.getByText('My Description')).toBeInTheDocument()
        expect(screen.getByTestId('content')).toHaveTextContent('Body content')
        expect(screen.getByTestId('footer')).toHaveTextContent('Footer content')
    })

    it('CardHeader has padding classes', () => {
        render(<CardHeader data-testid="hdr">H</CardHeader>)
        expect(screen.getByTestId('hdr').className).toContain('p-6')
    })

    it('CardContent has padding classes', () => {
        render(<CardContent data-testid="cnt">C</CardContent>)
        expect(screen.getByTestId('cnt').className).toContain('p-6')
    })

    it('CardFooter has flex layout', () => {
        render(<CardFooter data-testid="ftr">F</CardFooter>)
        expect(screen.getByTestId('ftr').className).toContain('flex')
    })
})
