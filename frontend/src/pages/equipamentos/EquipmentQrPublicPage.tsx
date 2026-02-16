import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Scale, Calendar, CheckCircle2, AlertTriangle, Building2, MapPin } from 'lucide-react'

interface EquipmentQrData {
    equipment: {
        code: string
        brand: string
        model: string
        serial_number: string
        capacity: string
        capacity_unit: string
        resolution: string
        precision_class: string
        location: string
    }
    customer: { name: string } | null
    last_calibration: {
        certificate_number: string
        calibration_date: string
        next_due_date: string
        result: string
        laboratory: string
    } | null
    tenant: { name: string } | null
}

export default function EquipmentQrPublicPage() {
    const { token } = useParams<{ token: string }>()
    const [data, setData] = useState<EquipmentQrData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!token) return
        const baseUrl = import.meta.env.VITE_API_URL || ''
        fetch(`${baseUrl}/api/v1/equipment-qr/${token}`)
            .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
            .then(setData)
            .catch(() => setError('Equipamento não encontrado ou token inválido.'))
            .finally(() => setLoading(false))
    }, [token])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="text-gray-500">Carregando...</div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="rounded-xl bg-white p-8 shadow-lg text-center max-w-md">
                    <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
                    <h1 className="mt-4 text-xl font-bold text-gray-900">Erro</h1>
                    <p className="mt-2 text-gray-600">{error}</p>
                </div>
            </div>
        )
    }

    const eq = data.equipment
    const cal = data.last_calibration
    const isExpired = cal?.next_due_date ? new Date(cal.next_due_date) < new Date() : false
    const isNearExpiry = cal?.next_due_date
        ? new Date(cal.next_due_date) < new Date(Date.now() + 30 * 86400000) && !isExpired
        : false

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-cyan-50 p-4">
            <div className="mx-auto max-w-md space-y-4">
                {/* Header */}
                <div className="rounded-2xl bg-white p-6 shadow-lg text-center">
                    <Scale className="mx-auto h-10 w-10 text-emerald-600" />
                    <h1 className="mt-2 text-xl font-bold text-gray-900">{eq.brand} {eq.model}</h1>
                    <p className="text-sm text-gray-500">Código: {eq.code}</p>
                    {data.tenant && (
                        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-400">
                            <Building2 className="h-3 w-3" /> {data.tenant.name}
                        </p>
                    )}
                </div>

                {/* Equipment Details */}
                <div className="rounded-2xl bg-white p-6 shadow-lg">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Equipamento</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Nº Série</span><span className="font-medium">{eq.serial_number || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Capacidade</span><span className="font-medium">{eq.capacity} {eq.capacity_unit}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Resolução</span><span className="font-medium">{eq.resolution || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Classe</span><span className="font-medium">{eq.precision_class || '—'}</span></div>
                        {eq.location && (
                            <div className="flex justify-between">
                                <span className="text-gray-500"><MapPin className="inline h-3 w-3" /> Local</span>
                                <span className="font-medium">{eq.location}</span>
                            </div>
                        )}
                        {data.customer && (
                            <div className="flex justify-between"><span className="text-gray-500">Proprietário</span><span className="font-medium">{data.customer.name}</span></div>
                        )}
                    </div>
                </div>

                {/* Calibration Status */}
                {cal ? (
                    <div className={`rounded-2xl p-6 shadow-lg ${
                        isExpired ? 'bg-red-50 border-2 border-red-200' :
                        isNearExpiry ? 'bg-amber-50 border-2 border-amber-200' :
                        'bg-emerald-50 border-2 border-emerald-200'
                    }`}>
                        <div className="flex items-center gap-2">
                            {isExpired ? (
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            ) : isNearExpiry ? (
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            )}
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-600">Última Calibração</h2>
                        </div>

                        <div className={`mt-3 text-center py-3 rounded-xl ${
                            isExpired ? 'bg-red-100' : isNearExpiry ? 'bg-amber-100' : 'bg-emerald-100'
                        }`}>
                            <div className={`text-2xl font-bold ${
                                isExpired ? 'text-red-700' : isNearExpiry ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                                {cal.result === 'aprovado' ? 'APROVADO' : 'REPROVADO'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Certificado: {cal.certificate_number}
                            </div>
                        </div>

                        <div className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500"><Calendar className="inline h-3 w-3" /> Data</span>
                                <span className="font-medium">{new Date(cal.calibration_date).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500"><Calendar className="inline h-3 w-3" /> Validade</span>
                                <span className={`font-medium ${isExpired ? 'text-red-600' : isNearExpiry ? 'text-amber-600' : ''}`}>
                                    {cal.next_due_date ? new Date(cal.next_due_date).toLocaleDateString('pt-BR') : '—'}
                                    {isExpired && ' (VENCIDA)'}
                                    {isNearExpiry && ' (VENCENDO)'}
                                </span>
                            </div>
                            {cal.laboratory && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Laboratório</span>
                                    <span className="font-medium">{cal.laboratory}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl bg-gray-100 p-6 shadow-lg text-center">
                        <AlertTriangle className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-500">Sem calibração registrada</p>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-gray-400 py-4">
                    Verificação gerada automaticamente
                </div>
            </div>
        </div>
    )
}
