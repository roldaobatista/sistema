import { History } from 'lucide-react'
import { useCustomerPriceHistory } from '@/hooks/useCustomerPriceHistory'

interface Props {
    customerId: number | string | undefined
    type: 'product' | 'service'
    referenceId: number | string | undefined
    onApplyPrice?: (price: number) => void
}

function formatBRL(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string) {
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR')
    } catch {
        return dateStr
    }
}

export default function PriceHistoryHint({ customerId, type, referenceId, onApplyPrice }: Props) {
    const { priceHistory, isLoading } = useCustomerPriceHistory(customerId, type, referenceId ? String(referenceId) : undefined)

    if (!customerId || !referenceId || isLoading || !priceHistory) return null

    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-700 font-medium mb-1">
                <History className="h-3.5 w-3.5" />
                Preço praticado para este cliente
            </div>
            <div className="space-y-1">
                {priceHistory.history.slice(0, 3).map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-amber-800/80">
                        <span>OS {h.os_number} — {formatDate(h.date)}</span>
                        <span className="font-medium">
                            {formatBRL(h.unit_price)}
                            {h.discount > 0 && <span className="text-amber-600 ml-1">(-{formatBRL(h.discount)})</span>}
                        </span>
                    </div>
                ))}
            </div>
            {onApplyPrice && (
                <button
                    type="button"
                    onClick={() => onApplyPrice(priceHistory.last_price)}
                    className="mt-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
                >
                    Usar último preço ({formatBRL(priceHistory.last_price)})
                </button>
            )}
        </div>
    )
}
