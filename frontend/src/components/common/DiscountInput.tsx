import { useState, useEffect } from 'react'
import { Percent, DollarSign } from 'lucide-react'

export type DiscountMode = 'percent' | 'value'

interface DiscountInputProps {
    mode: DiscountMode
    value: number
    onUpdate: (mode: DiscountMode, value: number) => void
    referenceAmount?: number
    className?: string
    title?: string
}

const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)

const fmtPercent = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(v / 100)

export function DiscountInput({ mode, value, onUpdate, referenceAmount, className, title }: DiscountInputProps) {
    const [display, setDisplay] = useState('')

    useEffect(() => {
        const v = value ?? 0
        setDisplay(mode === 'percent' ? fmtPercent(v) : fmtCurrency(v))
    }, [value, mode])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '') || '0'
        const num = parseInt(raw, 10) / 100
        setDisplay(mode === 'percent' ? fmtPercent(num) : fmtCurrency(num))
        onUpdate(mode, num)
    }

    const handleToggle = () => {
        const newMode = mode === 'percent' ? 'value' : 'percent'
        if (referenceAmount && referenceAmount > 0 && value > 0) {
            const converted = mode === 'percent'
                ? referenceAmount * value / 100
                : (value / referenceAmount) * 100
            onUpdate(newMode, Math.round(converted * 100) / 100)
        } else {
            onUpdate(newMode, 0)
        }
    }

    return (
        <div className={`flex items-center gap-0 ${className ?? ''}`}>
            <input
                type="text"
                inputMode="numeric"
                title={title}
                value={display}
                onChange={handleChange}
                onFocus={e => e.target.select()}
                className="min-w-0 flex-1 rounded-l-md border border-r-0 border-default bg-surface-0 px-2 py-1 text-right text-sm h-8 focus:border-brand-500 focus:outline-none"
            />
            <button
                type="button"
                onClick={handleToggle}
                title={mode === 'percent' ? 'Trocar para valor (R$)' : 'Trocar para percentual (%)'}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-r-md border border-default bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors"
            >
                {mode === 'percent'
                    ? <Percent className="h-3.5 w-3.5" />
                    : <DollarSign className="h-3.5 w-3.5" />
                }
            </button>
        </div>
    )
}
