const PREFIX = 'P'

/**
 * Payload da etiqueta de estoque: "P" + id do produto (ex: P123).
 * Retorna o product_id ou null se inválido.
 */
export function parseLabelQrPayload(value: string): number | null {
    const s = String(value || '').trim()
    if (s.toUpperCase().startsWith(PREFIX)) {
        const num = parseInt(s.slice(PREFIX.length), 10)
        if (Number.isFinite(num) && num > 0) return num
    }
    const num = parseInt(s, 10)
    if (Number.isFinite(num) && num > 0) return num
    return null
}

export function buildLabelQrPayload(productId: number): string {
    return `${PREFIX}${productId}`
}
