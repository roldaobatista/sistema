import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, MicOff, Save, Trash2, FileText, Copy, Check } from 'lucide-react'
import { useVoiceToText } from '@/hooks/useVoiceToText'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

export default function TechVoiceReportPage() {
  const { hasPermission } = useAuthStore()

    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const voice = useVoiceToText('pt-BR')
    const [reportText, setReportText] = useState('')
    const [copied, setCopied] = useState(false)

    const fullText = reportText + voice.transcript + voice.interimTranscript

    const handleToggleVoice = () => {
        if (voice.isListening) {
            // Append current transcript to report and stop
            setReportText(prev => prev + voice.transcript)
            voice.clearTranscript()
            voice.stopListening()
        } else {
            voice.startListening()
        }
    }

    const handleSave = () => {
        const finalText = reportText + voice.transcript
        if (!finalText.trim()) {
            toast.error('Relatório vazio')
            return
        }

        // Save to localStorage for offline sync
        const key = `voice-report-os-${id || 'draft'}`
        const existing = JSON.parse(localStorage.getItem('voice-reports') || '[]')
        existing.push({
            id: Date.now(),
            work_order_id: id ? parseInt(id) : null,
            text: finalText.trim(),
            created_at: new Date().toISOString(),
            synced: false,
        })
        localStorage.setItem('voice-reports', JSON.stringify(existing))

        toast.success('Relatório salvo!')
        navigate(-1)
    }

    const handleCopy = async () => {
        const text = reportText + voice.transcript
        if (text.trim()) {
            await navigator.clipboard.writeText(text.trim())
            setCopied(true)
            toast.success('Texto copiado!')
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleClear = () => {
        if (confirm('Limpar todo o texto do relatório?')) {
            setReportText('')
            voice.clearTranscript()
        }
    }

    return (
        <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-950">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700 shrink-0">
                <button onClick={() => navigate(-1)} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                        <h1 className="text-sm font-bold text-surface-900 dark:text-surface-50">
                            Relatório por Voz
                        </h1>
                    </div>
                    {id && <p className="text-xs text-surface-500 ml-7">OS #{id}</p>}
                </div>
                <button
                    onClick={handleSave}
                    disabled={!fullText.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
                >
                    <Save className="w-4 h-4" />
                    Salvar
                </button>
            </div>

            {/* Text Area */}
            <div className="flex-1 px-4 py-4 overflow-auto">
                <textarea
                    value={reportText + voice.transcript}
                    onChange={e => {
                        setReportText(e.target.value)
                        if (voice.transcript) voice.clearTranscript()
                    }}
                    placeholder="Dite ou digite o relatório técnico aqui..."
                    className="w-full h-full min-h-[300px] resize-none bg-white dark:bg-surface-800/80 rounded-xl p-4 text-sm text-surface-900 dark:text-surface-50 border border-surface-200 dark:border-surface-700 outline-none focus:ring-2 focus:ring-brand-500/30 placeholder:text-surface-400"
                />

                {/* Interim (live) text */}
                {voice.isListening && voice.interimTranscript && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
                        <p className="text-sm text-brand-600 dark:text-brand-300 italic">
                            {voice.interimTranscript}
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom toolbar */}
            <div className="bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 px-4 py-3 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            onClick={handleCopy}
                            disabled={!fullText.trim()}
                            className="p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 disabled:opacity-30"
                        >
                            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={handleClear}
                            disabled={!fullText.trim()}
                            className="p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-red-500 disabled:opacity-30"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Big mic button */}
                    <button
                        onClick={handleToggleVoice}
                        disabled={!voice.isSupported}
                        className={cn(
                            'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
                            voice.isListening
                                ? 'bg-red-500 text-white scale-110 shadow-red-500/40 animate-pulse'
                                : 'bg-brand-600 text-white shadow-brand-600/30',
                            !voice.isSupported && 'opacity-40 cursor-not-allowed',
                        )}
                    >
                        {voice.isListening
                            ? <MicOff className="w-7 h-7" />
                            : <Mic className="w-7 h-7" />
                        }
                    </button>

                    <div className="w-[84px] text-right">
                        {voice.isListening && (
                            <span className="text-xs text-red-500 font-medium animate-pulse">
                                ● Gravando
                            </span>
                        )}
                        {!voice.isSupported && (
                            <span className="text-xs text-surface-400">
                                Não suportado
                            </span>
                        )}
                    </div>
                </div>

                {voice.error && (
                    <p className="text-xs text-red-500 mt-2 text-center">{voice.error}</p>
                )}
            </div>
        </div>
    )
}
