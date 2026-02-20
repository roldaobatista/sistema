import React, { useState, useEffect } from "react"
import { Input, InputProps } from "@/components/ui/input"

interface CurrencyInputProps extends Omit<InputProps, "onChange" | "value"> {
    value?: number
    onChange?: (value: number) => void
}

export function CurrencyInput({ value = 0, onChange, onBlur, ...props }: CurrencyInputProps) {
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
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value

        // Remove tudo que não for dígito
        val = val.replace(/\D/g, "")

        if (!val) {
            val = "0"
        }

        // Converte para valor float (assume que sempre tem 2 casas decimais devido a regex)
        const numericValue = parseInt(val, 10) / 100

        // Atualiza a visualização localmente ao digitar
        setDisplayValue(formatValue(numericValue))

        // Trigger callback externo
        if (onChange) {
            onChange(numericValue)
        }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        // Opcional: Selecionar o texto todo foca
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
