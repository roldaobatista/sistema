import { cn } from '@/lib/utils'

interface ToleranceBarProps {
    /** Proporção do segmento verde (OK). Valor de 0 a 1. */
    ok?: number
    /** Proporção do segmento âmbar (atenção). Valor de 0 a 1. */
    warn?: number
    /** Proporção do segmento vermelho (crítico). Valor de 0 a 1. */
    critical?: number
    /** Altura da barra. Default: 'sm' (4px) */
    size?: 'xs' | 'sm' | 'md'
    className?: string
}

const sizeMap = {
    xs: 'h-0.5',
    sm: 'h-1',
    md: 'h-1.5',
}

/**
 * Barra de Tolerância — elemento assinatura do Kalibrium.
 *
 * Inspirada nos displays de equipamentos de medição:
 * verde (dentro da tolerância) → âmbar (próximo do limite) → vermelho (fora de tolerância).
 *
 * Pode receber proporções customizadas ou usar os padrões (3:1:1).
 */
export function ToleranceBar({
    ok = 0.6,
    warn = 0.2,
    critical = 0.2,
    size = 'sm',
    className,
}: ToleranceBarProps) {
    const h = sizeMap[size]

    return (
        <div className={cn('flex gap-0.5', className)} role="img" aria-label="Indicador de tolerância">
            <div
                className={cn(h, 'rounded-l-full bg-emerald-400/70 transition-all duration-300')}
                style={{ flex: ok }}
            />
            <div
                className={cn(h, 'bg-amber-400/70 transition-all duration-300')}
                style={{ flex: warn }}
            />
            <div
                className={cn(h, 'rounded-r-full bg-red-400/70 transition-all duration-300')}
                style={{ flex: critical }}
            />
        </div>
    )
}
