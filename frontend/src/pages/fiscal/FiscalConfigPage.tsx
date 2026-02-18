import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Settings, Upload, Shield, FileText, CheckCircle2, AlertTriangle,
    Loader2, Save, Trash2, Eye, EyeOff, Info, RefreshCw
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

interface FiscalConfig {
    fiscal_regime?: string
    cnae?: string
    inscricao_municipal?: string
    inscricao_estadual?: string
    ambiente?: string
    serie_nfe?: number
    serie_nfse?: number
    auto_send_email?: boolean
    provider?: string
}

interface CertificateInfo {
    uploaded: boolean
    expires_at?: string
    subject?: string
    issuer?: string
    days_until_expiry?: number
}

export default function FiscalConfigPage() {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [showPassword, setShowPassword] = useState(false)
    const [certFile, setCertFile] = useState<File | null>(null)
    const [certPassword, setCertPassword] = useState('')

    const { data: config, isLoading } = useQuery<FiscalConfig>({
        queryKey: ['fiscal-config'],
        queryFn: async () => {
            const { data } = await api.get('/fiscal/config')
            return data.data ?? data ?? {}
        },
    })

    const { data: certInfo } = useQuery<CertificateInfo>({
        queryKey: ['fiscal-certificate-info'],
        queryFn: async () => {
            const { data } = await api.get('/fiscal/config/certificate')
            return data.data ?? data ?? { uploaded: false }
        },
    })

    const [form, setForm] = useState<FiscalConfig>({})

    // Sync form when config loads
    const isFormInitialized = Object.keys(form).length > 0
    if (config && !isFormInitialized) {
        setForm(config)
    }

    const updateField = (field: keyof FiscalConfig, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const saveMutation = useMutation({
        mutationFn: async () => {
            const { data } = await api.put('/fiscal/config', form)
            return data
        },
        onSuccess: () => {
            toast.success('Configurações fiscais salvas')
            queryClient.invalidateQueries({ queryKey: ['fiscal-config'] })
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Erro ao salvar configurações')
        },
    })

    const uploadCertMutation = useMutation({
        mutationFn: async () => {
            if (!certFile) throw new Error('Selecione um arquivo .pfx')
            if (!certPassword) throw new Error('Informe a senha do certificado')

            const formData = new FormData()
            formData.append('certificate', certFile)
            formData.append('password', certPassword)

            const { data } = await api.post('/fiscal/config/certificate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            return data
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Certificado digital enviado')
            queryClient.invalidateQueries({ queryKey: ['fiscal-certificate-info'] })
            setCertFile(null)
            setCertPassword('')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || err.message || 'Erro ao enviar certificado')
        },
    })

    const removeCertMutation = useMutation({
        mutationFn: async () => {
            const { data } = await api.delete('/fiscal/config/certificate')
            return data
        },
        onSuccess: () => {
            toast.success('Certificado removido')
            queryClient.invalidateQueries({ queryKey: ['fiscal-certificate-info'] })
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Erro ao remover certificado')
        },
    })

    const testConnectionMutation = useMutation({
        mutationFn: async () => {
            const { data } = await api.get('/fiscal/contingency/status')
            return data
        },
        onSuccess: (data) => {
            if (data.data?.sefaz_available || data.sefaz_available) {
                toast.success('SEFAZ online e respondendo ✓')
            } else {
                toast.warning('SEFAZ indisponível no momento')
            }
        },
        onError: () => toast.error('Falha na comunicação com SEFAZ'),
    })

    const canManage = user?.all_permissions?.includes('fiscal.config.manage')
    const certExpiringSoon = certInfo?.days_until_expiry !== undefined && certInfo.days_until_expiry <= 30

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Configurações Fiscais</h1>
                        <p className="text-sm text-surface-500">Gerencie certificado digital, regime fiscal e parâmetros de emissão</p>
                    </div>
                </div>
                <button
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                    Testar SEFAZ
                </button>
            </div>

            {/* Certificate Section */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-surface-50 dark:bg-surface-800/50">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                        <h2 className="font-semibold">Certificado Digital (A1 - .pfx)</h2>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    {certInfo?.uploaded ? (
                        <div className={`flex items-start gap-4 p-4 rounded-lg border ${certExpiringSoon
                                ? 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                                : 'border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                            }`}>
                            <div className={`p-2 rounded-full ${certExpiringSoon ? 'bg-amber-100 dark:bg-amber-800/30' : 'bg-emerald-100 dark:bg-emerald-800/30'}`}>
                                {certExpiringSoon
                                    ? <AlertTriangle className="w-5 h-5 text-amber-600" />
                                    : <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                }
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="font-medium text-sm">
                                    {certExpiringSoon ? 'Certificado expirando em breve' : 'Certificado ativo'}
                                </p>
                                {certInfo.subject && (
                                    <p className="text-xs text-surface-600 dark:text-surface-400">Titular: {certInfo.subject}</p>
                                )}
                                {certInfo.expires_at && (
                                    <p className="text-xs text-surface-600 dark:text-surface-400">
                                        Validade: {new Date(certInfo.expires_at).toLocaleDateString('pt-BR')}
                                        {certInfo.days_until_expiry !== undefined && (
                                            <span className="ml-1">({certInfo.days_until_expiry} dias restantes)</span>
                                        )}
                                    </p>
                                )}
                                {certInfo.issuer && (
                                    <p className="text-xs text-surface-500">Emissor: {certInfo.issuer}</p>
                                )}
                            </div>
                            {canManage && (
                                <button
                                    onClick={() => {
                                        if (confirm('Tem certeza que deseja remover o certificado digital?')) {
                                            removeCertMutation.mutate()
                                        }
                                    }}
                                    className="p-2 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    aria-label="Remover certificado"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-4 rounded-lg border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800/50">
                            <Info className="w-5 h-5 text-surface-400" />
                            <p className="text-sm text-surface-600 dark:text-surface-400">
                                Nenhum certificado digital cadastrado. Envie um arquivo .pfx para habilitar a emissão de notas fiscais.
                            </p>
                        </div>
                    )}

                    {canManage && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium mb-1">Arquivo (.pfx)</label>
                                <input
                                    type="file"
                                    accept=".pfx,.p12"
                                    onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                                    className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 file:rounded-lg file:cursor-pointer dark:file:bg-brand-900/20 dark:file:text-brand-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Senha do Certificado</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={certPassword}
                                        onChange={(e) => setCertPassword(e.target.value)}
                                        placeholder="••••••"
                                        className="w-full px-3 py-2.5 pr-10 rounded-lg border border-border bg-card text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400"
                                        aria-label="Toggle password"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={() => uploadCertMutation.mutate()}
                                    disabled={!certFile || !certPassword || uploadCertMutation.isPending}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {uploadCertMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Upload className="w-4 h-4" />
                                    )}
                                    Enviar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Fiscal Settings */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-surface-50 dark:bg-surface-800/50">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                        <h2 className="font-semibold">Parâmetros Fiscais</h2>
                    </div>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Regime Tributário</label>
                            <select
                                value={form.fiscal_regime ?? ''}
                                onChange={(e) => updateField('fiscal_regime', e.target.value)}
                                disabled={!canManage}
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm disabled:opacity-60"
                            >
                                <option value="">Selecione...</option>
                                <option value="1">Simples Nacional</option>
                                <option value="2">Simples Nacional - Excesso de Sublimite</option>
                                <option value="3">Regime Normal (Lucro Presumido/Real)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Ambiente</label>
                            <select
                                value={form.ambiente ?? ''}
                                onChange={(e) => updateField('ambiente', e.target.value)}
                                disabled={!canManage}
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm disabled:opacity-60"
                            >
                                <option value="">Selecione...</option>
                                <option value="homologacao">Homologação (Testes)</option>
                                <option value="producao">Produção</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">CNAE</label>
                            <input
                                value={form.cnae ?? ''}
                                onChange={(e) => updateField('cnae', e.target.value)}
                                disabled={!canManage}
                                placeholder="0000-0/00"
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Inscrição Municipal</label>
                            <input
                                value={form.inscricao_municipal ?? ''}
                                onChange={(e) => updateField('inscricao_municipal', e.target.value)}
                                disabled={!canManage}
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Inscrição Estadual</label>
                            <input
                                value={form.inscricao_estadual ?? ''}
                                onChange={(e) => updateField('inscricao_estadual', e.target.value)}
                                disabled={!canManage}
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm disabled:opacity-60"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Série NF-e</label>
                            <input
                                type="number"
                                min="1"
                                value={form.serie_nfe ?? ''}
                                onChange={(e) => updateField('serie_nfe', parseInt(e.target.value) || undefined)}
                                disabled={!canManage}
                                placeholder="1"
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Série NFS-e</label>
                            <input
                                type="number"
                                min="1"
                                value={form.serie_nfse ?? ''}
                                onChange={(e) => updateField('serie_nfse', parseInt(e.target.value) || undefined)}
                                disabled={!canManage}
                                placeholder="1"
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Provider</label>
                            <select
                                value={form.provider ?? ''}
                                onChange={(e) => updateField('provider', e.target.value)}
                                disabled={!canManage}
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm disabled:opacity-60"
                            >
                                <option value="">Selecione...</option>
                                <option value="focus_nfe">Focus NF-e</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.auto_send_email ?? false}
                                onChange={(e) => updateField('auto_send_email', e.target.checked)}
                                disabled={!canManage}
                                className="rounded border-surface-300"
                            />
                            Enviar NF-e/NFS-e automaticamente por e-mail após autorização
                        </label>
                    </div>
                </div>
            </section>

            {/* Save Button */}
            {canManage && (
                <div className="flex justify-end">
                    <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                        {saveMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Salvar Configurações
                    </button>
                </div>
            )}
        </div>
    )
}
