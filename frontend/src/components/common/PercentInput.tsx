import React, { useState, useEffect } from "react"
import { Input, InputProps } from "@/components/ui/input"

interface PercentInputProps extends Omit<InputProps, "onChange" | "value" | "min" | "max"> {
    value?: number
    onChange?: (value: number) => void
}

export function PercentInput({ value = 0, onChange, onBlur, ...props }: PercentInputProps) {
    const [displayValue, setDisplayValue] = useState("")

    useEffect(() => {
        // Sync external value with local formatted value
        if (value !== undefined && value !== null && !isNaN(value)) {
            setDisplayValue(formatValue(value))
        } else {
            setDisplayValue(formatValue(0))
        }
    }, [value])

    const formatValue = (val: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "percent",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val / 100)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value

        // Validações básicas de negativo (se não aceitar no teclado n tem problema, regex lida)
        val = val.replace(/\D/g, "")

        if (!val) {
            val = "0"
        }

        // Converte para valor float (100 = 1,00%)
        const numericValue = parseInt(val, 10) / 100

        setDisplayValue(formatValue(numericValue))

        if (onChange) {
            onChange(numericValue)
        }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select()
    }

    return (
        <Input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={onBlur}
            {...props}
        />
    )
}
