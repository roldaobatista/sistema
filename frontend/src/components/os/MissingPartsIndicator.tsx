import { useState } from 'react'
import { AlertTriangle, Package, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Item {
    id: number
    name: string
    quantity: number
    stock_quantity?: number | null
    unit_price?: string
}

interface MissingPartsProps {
    items: Item[]
}

export default function MissingPartsIndicator({ items }: MissingPartsProps) {
    const missingParts = items.filter(i =>
        i.stock_quantity !== null && i.stock_quantity !== undefined && i.stock_quantity < i.quantity
    )

    if (missingParts.length === 0) return null

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Peças em Falta
                <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {missingParts.length}
                </span>
            </h3>

            <div className="space-y-1.5">
                {missingParts.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-amber-700">
                            <Package className="h-3 w-3" />
                            {p.name}
                        </span>
                        <span className="font-mono text-amber-800">
                            {p.stock_quantity ?? 0}/{p.quantity}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
