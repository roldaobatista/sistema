import { useState } from 'react'
import { QrCode, Copy, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface QRTrackingProps {
    workOrderId: number
    osNumber: string
}

export default function QRTracking({ workOrderId, osNumber }: QRTrackingProps) {
    const [copied, setCopied] = useState(false)

    const trackingUrl = `${window.location.origin}/os/${workOrderId}`
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingUrl)}`

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(trackingUrl)
            setCopied(true)
            toast.success('Link de rastreamento copiado!')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Erro ao copiar')
        }
    }

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-brand-500" />
                QR Code
            </h3>

            <div className="flex flex-col items-center gap-3">
                <img
                    src={qrApiUrl}
                    alt={`QR Code OS ${osNumber}`}
                    className="rounded-lg border border-default"
                    width={120}
                    height={120}
                />
                <p className="text-[10px] text-surface-400 text-center">
                    Escaneie para acessar esta OS
                </p>
                <button
                    onClick={copyUrl}
                    className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
                    aria-label="Copiar link de rastreamento"
                >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copiado!' : 'Copiar link'}
                </button>
            </div>
        </div>
    )
}
