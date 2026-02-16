import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    FileText, Download, Mail, Printer, CheckCircle2, Loader2, ArrowLeft,
    Award, Send, Eye,
} from 'lucide-react'
import { cn, getApiErrorMessage } from '@/lib/utils'
import api, { getApiOrigin } from '@/lib/api'
import { toast } from 'sonner'

interface Equipment {
    id: number
    code?: string
    name?: string
    serial_number?: string
}

interface Calibration {
    id: number
    calibration_date: string
    result?: string
    certificate_number?: string
    certificate_pdf_path?: string
    readings?: unknown[]
}

interface CertificateTemplate {
    id: number
    name: string
    is_default?: boolean
}

export default function TechCertificatePage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [equipments, setEquipments] = useState<Equipment[]>([])
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
    const [calibrations, setCalibrations] = useState<Calibration[]>([])
    const [templates, setTemplates] = useState<CertificateTemplate[]>([])
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [certificate, setCertificate] = useState<{
        certificate_number: string
        path?: string
        url?: string
    } | null>(null)
    const [emailForm, setEmailForm] = useState({ email: '', sending: false })
    const [generatingAndPrint, setGeneratingAndPrint] = useState(false)

    useEffect(() => {
        if (!id) return
        async function fetchWorkOrder() {
            try {
                setLoading(true)
                const { data } = await api.get(`/work-orders/${id}`)
                const wo = data.data || data
                const list: Equipment[] = []
                if (wo.equipment?.id) list.push(wo.equipment)
                if (wo.equipmentsList?.length) {
                    wo.equipmentsList.forEach((e: any) => {
                        const eq = e.equipment || e
                        if (eq?.id && !list.some((x) => x.id === eq.id)) list.push(eq)
                    })
                }
                setEquipments(list)
                if (list.length === 1) setSelectedEquipment(list[0])
            } catch {
                toast.error('Erro ao carregar OS')
            } finally {
                setLoading(false)
            }
        }
        fetchWorkOrder()
    }, [id])

    useEffect(() => {
        async function fetchTemplates() {
            try {
                const { data } = await api.get('/certificate-templates')
                setTemplates(Array.isArray(data) ? data : data.data || [])
                const def = (Array.isArray(data) ? data : data.data || []).find(
                    (t: CertificateTemplate) => t.is_default
                )
                if (def) setSelectedTemplateId(def.id)
                else if ((data?.data || data)?.length) setSelectedTemplateId(data[0]?.id ?? data[0]?.id)
            } catch {
                toast.error('Erro ao carregar templates')
            }
        }
        fetchTemplates()
    }, [])

    useEffect(() => {
        if (!selectedEquipment) {
            setCalibrations([])
            return
        }
        async function fetchCalibrations() {
            try {
                const { data } = await api.get(`/equipments/${selectedEquipment!.id}/calibrations`)
                setCalibrations(data.calibrations || [])
            } catch {
                setCalibrations([])
            }
        }
        fetchCalibrations()
    }, [selectedEquipment])

    const workOrderId = id ? Number(id) : 0
    const latestCalibration =
        calibrations.find((c: Calibration & { work_order_id?: number }) => c.work_order_id === workOrderId) ??
        calibrations[0] ??
        null

    const handleSelectEquipment = (eq: Equipment) => {
        setSelectedEquipment(eq)
        setCertificate(null)
    }

    const handleGenerate = async () => {
        if (!latestCalibration) {
            toast.error('Nenhuma calibração encontrada para este equipamento')
            return
        }
        setGenerating(true)
        setCertificate(null)
        try {
            const { data } = await api.post(
                `/calibration/${latestCalibration.id}/generate-certificate`,
                selectedTemplateId ? { template_id: selectedTemplateId } : {}
            )
            setCertificate({
                certificate_number: data.certificate_number || 'Gerado',
                path: data.path,
                url: data.url,
            })
            toast.success('Certificado gerado com sucesso')
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao gerar certificado'))
        } finally {
            setGenerating(false)
        }
    }

    const handleViewPdf = () => {
        if (certificate?.url) {
            window.open(certificate.url, '_blank')
        } else if (certificate?.path) {
            const base = getApiOrigin()
            window.open(`${base}/storage/${certificate.path}`, '_blank')
        } else {
            toast.error('URL do PDF não disponível')
        }
    }

    const handleGenerateAndPrint = async () => {
        if (!latestCalibration || !selectedEquipment) return
        setGeneratingAndPrint(true)
        setCertificate(null)
        try {
            await api.post(
                `/calibration/${latestCalibration.id}/generate-certificate`,
                selectedTemplateId ? { template_id: selectedTemplateId } : {}
            )
            const { data } = await api.get(
                `/equipments/${selectedEquipment.id}/calibrations/${latestCalibration.id}/pdf`,
                { responseType: 'blob' }
            )
            const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
            const w = window.open(url, '_blank')
            if (w) w.focus()
            setCertificate({
                certificate_number: latestCalibration.certificate_number ?? 'Gerado',
                path: undefined,
                url,
            })
            toast.success('Certificado aberto. Use Ctrl+P na nova aba para imprimir.')
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao gerar certificado'))
        } finally {
            setGeneratingAndPrint(false)
        }
    }

    const handleSendEmail = async () => {
        const email = emailForm.email.trim()
        if (!email) {
            toast.error('Informe o e-mail')
            return
        }
        setEmailForm((p) => ({ ...p, sending: true }))
        try {
            await api.post(`/calibration/${latestCalibration?.id}/send-certificate-email`, {
                email,
            })
            toast.success('E-mail enviado com sucesso')
            setEmailForm({ email: '', sending: false })
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao enviar e-mail'))
            setEmailForm((p) => ({ ...p, sending: false }))
        }
    }

    const handlePrint = () => {
        navigate(`/tech/os/${id}/print`)
    }

    const equipmentList = equipments.length > 0 ? equipments : selectedEquipment ? [selectedEquipment] : []

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/tech/os/${id}`)}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        aria-label="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Certificado de Calibração
                    </h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                        <p className="text-sm text-surface-500">Carregando...</p>
                    </div>
                ) : (
                    <>
                        <div>
                            <h2 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center gap-2">
                                <Award className="w-4 h-4" />
                                Selecione o equipamento
                            </h2>
                            <div className="grid gap-2">
                                {equipmentList.map((eq) => (
                                    <button
                                        key={eq.id}
                                        onClick={() => handleSelectEquipment(eq)}
                                        className={cn(
                                            'bg-white dark:bg-surface-800/80 rounded-xl p-4 text-left transition-colors',
                                            selectedEquipment?.id === eq.id
                                                ? 'ring-2 ring-brand-500'
                                                : 'hover:bg-surface-50 dark:hover:bg-surface-700/80'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-brand-500" />
                                            <div>
                                                <p className="font-medium text-surface-900 dark:text-surface-50">
                                                    {eq.code || eq.name || `Equipamento #${eq.id}`}
                                                </p>
                                                {eq.serial_number && (
                                                    <p className="text-xs text-surface-500">
                                                        S/N: {eq.serial_number}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedEquipment && (
                            <>
                                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                                    <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                        Resumo da Calibração
                                    </h3>
                                    {latestCalibration ? (
                                        <div className="space-y-1 text-sm">
                                            <p>
                                                <span className="text-surface-500">Data:</span>{' '}
                                                {new Date(latestCalibration.calibration_date).toLocaleDateString(
                                                    'pt-BR'
                                                )}
                                            </p>
                                            <p>
                                                <span className="text-surface-500">Resultado:</span>{' '}
                                                <span
                                                    className={cn(
                                                        latestCalibration.result === 'aprovado'
                                                            ? 'text-emerald-600'
                                                            : latestCalibration.result === 'reprovado'
                                                              ? 'text-red-600'
                                                              : 'text-amber-600'
                                                    )}
                                                >
                                                    {latestCalibration.result === 'aprovado'
                                                        ? 'Aprovado'
                                                        : latestCalibration.result === 'reprovado'
                                                          ? 'Reprovado'
                                                          : 'Aprovado com Ressalva'}
                                                </span>
                                            </p>
                                            {latestCalibration.certificate_number && (
                                                <p>
                                                    <span className="text-surface-500">Certificado:</span>{' '}
                                                    {latestCalibration.certificate_number}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-surface-500">
                                            Nenhuma calibração registrada para este equipamento
                                        </p>
                                    )}
                                </div>

                                {templates.length > 0 && (
                                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                                        <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                            Modelo de Certificado
                                        </h3>
                                        <div className="space-y-2">
                                            {templates.map((t) => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setSelectedTemplateId(t.id)}
                                                    className={cn(
                                                        'w-full flex items-center gap-2 p-3 rounded-lg text-left transition-colors',
                                                        selectedTemplateId === t.id
                                                            ? 'bg-brand-100 dark:bg-brand-900/30 ring-1 ring-brand-500'
                                                            : 'bg-surface-50 dark:bg-surface-700/50 hover:bg-surface-100 dark:hover:bg-surface-700'
                                                    )}
                                                >
                                                    <FileText className="w-4 h-4 text-surface-500" />
                                                    <span className="text-sm font-medium">
                                                        {t.name}
                                                        {t.is_default && (
                                                            <span className="ml-1 text-xs text-surface-400">
                                                                (padrão)
                                                            </span>
                                                        )}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={generating || generatingAndPrint || !latestCalibration}
                                        className="flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl font-medium disabled:opacity-50"
                                    >
                                        {generating ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Gerando...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-5 h-5" />
                                                Gerar Certificado
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleGenerateAndPrint}
                                        disabled={generating || generatingAndPrint || !latestCalibration}
                                        className="flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium disabled:opacity-50"
                                    >
                                        {generatingAndPrint ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Gerando...
                                            </>
                                        ) : (
                                            <>
                                                <Printer className="w-5 h-5" />
                                                Gerar e imprimir
                                            </>
                                        )}
                                    </button>
                                </div>

                                {certificate && (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium text-emerald-800 dark:text-emerald-300">
                                                    Certificado gerado
                                                </p>
                                                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                                    Nº {certificate.certificate_number}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={handleViewPdf}
                                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-surface-800 rounded-lg text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-700"
                                            >
                                                <Eye className="w-4 h-4" />
                                                Visualizar PDF
                                            </button>
                                            <button
                                                onClick={handlePrint}
                                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-surface-800 rounded-lg text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-700"
                                            >
                                                <Printer className="w-4 h-4" />
                                                Imprimir
                                            </button>
                                        </div>
                                        <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                                            <p className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">
                                                Enviar por e-mail
                                            </p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="email"
                                                    placeholder="E-mail do destinatário"
                                                    value={emailForm.email}
                                                    onChange={(e) =>
                                                        setEmailForm((p) => ({ ...p, email: e.target.value }))
                                                    }
                                                    className="flex-1 px-3 py-2.5 rounded-lg bg-white dark:bg-surface-800 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                                />
                                                <button
                                                    onClick={handleSendEmail}
                                                    disabled={emailForm.sending}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                                >
                                                    {emailForm.sending ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Send className="w-4 h-4" />
                                                    )}
                                                    Enviar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
