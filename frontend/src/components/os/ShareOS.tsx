import { useState } from 'react'
import { Share2, MessageCircle, Mail, Link2, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ShareOSProps {
    workOrderId: number
    osNumber: string
    customerName: string
    status: string
}

export default function ShareOS({ workOrderId, osNumber, customerName, status }: ShareOSProps) {
    const [copied, setCopied] = useState(false)

    const osUrl = `${window.location.origin}/os/${workOrderId}`

    const shareText = `📋 OS ${osNumber} - ${customerName}\n📌 Status: ${status}\n🔗 ${osUrl}`

    const shareWhatsApp = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
    }

    const shareEmail = () => {
        const subject = `OS ${osNumber} - ${customerName}`
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`, '_blank')
    }

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(osUrl)
            setCopied(true)
            toast.success('Link copiado!')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Erro ao copiar link')
        }
    }

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-brand-500" />
                Compartilhar
            </h3>
            <div className="flex gap-2">
                <button onClick={shareWhatsApp}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                </button>
                <button onClick={shareEmail}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors"
                >
                    <Mail className="h-3.5 w-3.5" />
                    Email
                </button>
                <button onClick={copyLink}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-xs font-medium text-surface-600 hover:bg-surface-200 transition-colors"
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
            </div>
        </div>
    )
}
