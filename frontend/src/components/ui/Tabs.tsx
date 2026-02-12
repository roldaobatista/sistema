import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
    value: string
    onChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue>({ value: '', onChange: () => { } })

interface TabsProps {
    value: string
    onValueChange: (value: string) => void
    children: ReactNode
    className?: string
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
    return (
        <TabsContext.Provider value={{ value, onChange: onValueChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    )
}

interface TabsListProps {
    children: ReactNode
    className?: string
}

export function TabsList({ children, className }: TabsListProps) {
    return (
        <div className={cn('inline-flex items-center gap-1 rounded-lg bg-surface-100 p-1', className)}>
            {children}
        </div>
    )
}

interface TabsTriggerProps {
    value: string
    children: ReactNode
    className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
    const ctx = useContext(TabsContext)
    const isActive = ctx.value === value

    return (
        <button
            type="button"
            onClick={() => ctx.onChange(value)}
            className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                isActive
                    ? 'bg-surface-0 text-surface-900 shadow-sm'
                    : 'text-surface-500 hover:text-surface-700',
                className
            )}
        >
            {children}
        </button>
    )
}

interface TabsContentProps {
    value: string
    children: ReactNode
    className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
    const ctx = useContext(TabsContext)
    if (ctx.value !== value) return null
    return <div className={className}>{children}</div>
}
