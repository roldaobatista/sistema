import { useState, useEffect , useMemo } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2, FileText, Globe, Settings2, Save, MapPin } from 'lucide-react'
import { InmetroBaseConfigSection } from '@/components/inmetro/InmetroBaseConfigSection'
import {
    useImportXml, useSubmitPsieResults, useInmetroConfig,
    useUpdateInmetroConfig, useAvailableUfs, useInstrumentTypes
} from '@/hooks/useInmetro'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

const UF_REGIONS: Record<string, string[]> = {
    'Norte': ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
    'Nordeste': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
    'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
    'Sudeste': ['ES', 'MG', 'RJ', 'SP'],
    'Sul': ['PR', 'RS', 'SC'],
}

export function InmetroImportPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['inmetro-import'],
    queryFn: () => api.get('/inmetro-import').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/inmetro-import/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['inmetro-import'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
    const { hasPermission } = useAuthStore()
    const canImport = hasPermission('inmetro.intelligence.import')
    const [importType, setImportType] = useState('all')
    const [psieResults, setPsieResults] = useState('')

    const xmlImport = useImportXml()
    const psieSubmit = useSubmitPsieResults()
    const { data: config, isLoading: configLoading } = useInmetroConfig()
    const updateConfig = useUpdateInmetroConfig()
    const { data: instrumentTypes } = useInstrumentTypes()

    const [selectedUfs, setSelectedUfs] = useState<string[]>(['MT'])
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])
    const [autoSync, setAutoSync] = useState(true)
    const [syncDays, setSyncDays] = useState(7)
    const [configDirty, setConfigDirty] = useState(false)

    useEffect(() => {
        if (config) {
            setSelectedUfs(config.monitored_ufs)
            setSelectedTypes(config.instrument_types)
            setAutoSync(config.auto_sync_enabled)
            setSyncDays(config.sync_interval_days)
        }
    }, [config])

    const toggleUf = (uf: string) => {
        setSelectedUfs(prev => {
            const next = prev.includes(uf) ? prev.filter(u => u !== uf) : [...prev, uf]
            if (next.length === 0) return prev // at least 1
            setConfigDirty(true)
            return next
        })
    }

    const toggleType = (slug: string) => {
        setSelectedTypes(prev => {
            const next = prev.includes(slug) ? prev.filter(t => t !== slug) : [...prev, slug]
            if (next.length === 0) return prev // at least 1
            setConfigDirty(true)
            return next
        })
    }

    const selectAllRegion = (ufs: string[]) => {
        setSelectedUfs(prev => {
            const allSelected = ufs.every(uf => prev.includes(uf))
            const next = allSelected
                ? prev.filter(u => !ufs.includes(u))
                : [...new Set([...prev, ...ufs])]
            if (next.length === 0) return prev
            setConfigDirty(true)
            return next
        })
    }

    const handleSaveConfig = () => {
        updateConfig.mutate({
            monitored_ufs: selectedUfs,
            instrument_types: selectedTypes,
            auto_sync_enabled: autoSync,
            sync_interval_days: syncDays,
        }, {
            onSuccess: () => setConfigDirty(false),
        })
    }

    const handleXmlImport = () => {
        xmlImport.mutate({ type: importType, ufs: selectedUfs } as any, {
            onSuccess: (res) => {
                const results = res.data?.results
                const msgs: string[] = []
                if (results?.instruments?.results?.grand_totals) {
                    const gt = results.instruments.results.grand_totals
                    msgs.push(`Instrumentos: ${gt.instruments_created} novos, ${gt.owners_created} proprietários`)
                }
                toast.success(msgs.join(' | ') || 'Importação concluída')
            },
            onError: (err: any) => {
                toast.error(err.response?.data?.error || 'Erro na importação')
            },
        })
    }

    const handlePsieSubmit = () => {
        try {
            const results = JSON.parse(psieResults)
            if (!Array.isArray(results)) {
                toast.error('Dados devem ser um array JSON')
                return
            }
            psieSubmit.mutate({ results }, {
                onSuccess: (res) => {
                    const stats = res.data?.stats
                    toast.success(`PSIE: ${stats?.instruments_created ?? 0} instrumentos, ${stats?.owners_created ?? 0} proprietários, ${stats?.history_added ?? 0} históricos`)
                    setPsieResults('')
                },
                onError: () => toast.error('Erro ao salvar dados do PSIE'),
            })
        } catch {
            toast.error('JSON inválido. Cole os dados no formato correto.')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-surface-900">Importação INMETRO</h1>
                <p className="text-sm text-surface-500 mt-0.5">Configurar estados, tipos e importar dados do portal RBMLQ</p>
            </div>

            {/* Config Section */}
            <div className="rounded-xl border border-default bg-surface-0 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-brand-100 flex items-center justify-center">
                            <Settings2 className="h-5 w-5 text-brand-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-surface-800">Configuração de Monitoramento</h2>
                            <p className="text-xs text-surface-500">Selecione os estados e tipos de instrumentos</p>
                        </div>
                    </div>
                    {configDirty && canImport && (
                        <button
                            onClick={handleSaveConfig}
                            disabled={updateConfig.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                        >
                            {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Salvar
                        </button>
                    )}
                </div>

                {configLoading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="h-20 bg-surface-100 rounded-lg" />
                        <div className="h-16 bg-surface-100 rounded-lg" />
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* UF Selection by Region */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <MapPin className="h-4 w-4 text-surface-500" />
                                <label className="text-xs font-medium text-surface-700">Estados Monitorados ({selectedUfs.length})</label>
                            </div>
                            <div className="space-y-2">
                                {Object.entries(UF_REGIONS).map(([region, ufs]) => {
                                    const allSelected = ufs.every(uf => selectedUfs.includes(uf))
                                    const someSelected = ufs.some(uf => selectedUfs.includes(uf))
                                    return (
                                        <div key={region}>
                                            <button
                                                onClick={() => selectAllRegion(ufs)}
                                                className={`text-xs font-medium mb-1 transition-colors ${allSelected ? 'text-brand-700' : someSelected ? 'text-surface-700' : 'text-surface-500'
                                                    } hover:text-brand-600`}
                                            >
                                                {region} {allSelected ? '✓' : ''}
                                            </button>
                                            <div className="flex flex-wrap gap-1 ml-2">
                                                {ufs.map(uf => (
                                                    <button
                                                        key={uf}
                                                        onClick={() => toggleUf(uf)}
                                                        className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${selectedUfs.includes(uf)
                                                            ? 'bg-brand-600 text-white border-brand-600'
                                                            : 'bg-surface-50 text-surface-600 border-default hover:border-brand-300'
                                                            }`}
                                                    >
                                                        {uf}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Instrument Type Selection */}
                        <div>
                            <label className="text-xs font-medium text-surface-700 block mb-2">Tipos de Instrumento ({selectedTypes.length})</label>
                            <div className="flex flex-wrap gap-1.5">
                                {instrumentTypes?.map(t => (
                                    <button
                                        key={t.slug}
                                        onClick={() => toggleType(t.slug)}
                                        className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${selectedTypes.includes(t.slug)
                                            ? 'bg-green-600 text-white border-green-600'
                                            : 'bg-surface-50 text-surface-600 border-default hover:border-green-300'
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sync Settings */}
                        <div className="flex items-center gap-6 pt-2 border-t border-subtle">
                            <label className="inline-flex items-center gap-2 text-xs text-surface-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoSync}
                                    onChange={e => { setAutoSync(e.target.checked); setConfigDirty(true) }}
                                    className="rounded border-surface-300"
                                />
                                Sincronização automática
                            </label>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-surface-500">Intervalo:</label>
                                <select
                                    value={syncDays}
                                    onChange={e => { setSyncDays(Number(e.target.value)); setConfigDirty(true) }}
                                    className="rounded-lg border border-default bg-surface-0 px-2 py-1 text-xs"
                                    aria-label="Intervalo de sincronização"
                                >
                                    <option value={1}>Diário</option>
                                    <option value={3}>3 dias</option>
                                    <option value={7}>Semanal</option>
                                    <option value={14}>Quinzenal</option>
                                    <option value={30}>Mensal</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* XML Import */}
                <div className="rounded-xl border border-default bg-surface-0 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-surface-800">Dados Abertos (XML)</h2>
                            <p className="text-xs text-surface-500">Sem captcha — importação direta</p>
                        </div>
                    </div>

                    <p className="text-xs text-surface-600 mb-2">
                        Importa dados de <strong>{selectedUfs.length}</strong> estado(s) e <strong>{selectedTypes.length}</strong> tipo(s) de instrumento.
                    </p>
                    <p className="text-xs text-surface-400 mb-4">
                        UFs: {selectedUfs.join(', ')}
                    </p>

                    <div className="mb-4">
                        <label className="text-xs font-medium text-surface-700 block mb-1.5">O que importar</label>
                        <select
                            value={importType}
                            onChange={e => setImportType(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            aria-label="Tipo de importação"
                        >
                            <option value="all">Tudo (Oficinas + Instrumentos)</option>
                            <option value="competitors">Apenas Oficinas (concorrentes)</option>
                            <option value="instruments">Apenas Instrumentos</option>
                        </select>
                    </div>

                    <button
                        onClick={handleXmlImport}
                        disabled={xmlImport.isPending || !canImport}
                        title={!canImport ? 'Você não tem permissão para importar' : ''}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                        {xmlImport.isPending ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Importando {selectedUfs.length} UF(s)...</>
                        ) : (
                            <><Upload className="h-4 w-4" /> Importar XML ({selectedUfs.join(', ')})</>
                        )}
                    </button>

                    {xmlImport.isSuccess && (
                        <div className="mt-3 flex items-center gap-2 text-green-600 text-xs">
                            <CheckCircle className="h-4 w-4" /> Importação concluída com sucesso
                        </div>
                    )}
                </div>

                {/* PSIE Scraping */}
                <div className="rounded-xl border border-default bg-surface-0 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-lg bg-brand-100 flex items-center justify-center">
                            <Globe className="h-5 w-5 text-brand-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-surface-800">Portal PSIE (Captcha Manual)</h2>
                            <p className="text-xs text-surface-500">Dados completos — requer captcha</p>
                        </div>
                    </div>

                    <div className="space-y-3 text-xs text-surface-600 mb-4">
                        <p><strong>Passo 1:</strong> Acesse o portal PSIE e resolva o captcha:</p>
                        <a
                            href="https://servicos.rbmlq.gov.br/Instrumento"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 underline"
                        >
                            <Globe className="h-3.5 w-3.5" /> Abrir portal PSIE
                        </a>
                        <p><strong>Passo 2:</strong> Consulte por município, copie os resultados da tabela.</p>
                        <p><strong>Passo 3:</strong> Cole os dados JSON abaixo.</p>
                    </div>

                    <textarea
                        value={psieResults}
                        onChange={e => setPsieResults(e.target.value)}
                        placeholder='[{"inmetro_number": "12345", "owner_name": "Fazenda X", "document": "123.456.789-00", "city": "Rondonópolis", "result": "Aprovado", "last_verification": "01/06/2025"}]'
                        rows={6}
                        className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-xs font-mono mb-3 resize-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    />

                    <button
                        onClick={handlePsieSubmit}
                        disabled={psieSubmit.isPending || !psieResults.trim() || !canImport}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                        {psieSubmit.isPending ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                        ) : (
                            <><Upload className="h-4 w-4" /> Salvar Dados do PSIE</>
                        )}
                    </button>
                </div>
            </div>

            {/* Base de Operações */}
            <InmetroBaseConfigSection />

            {/* Info Box */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-700 space-y-1">
                        <p className="font-semibold">Sincronização Automática</p>
                        <p>Os dados XML são sincronizados automaticamente conforme o intervalo configurado. Os dados do PSIE (com captcha) precisam ser importados manualmente.</p>
                        <p className="text-blue-600">A importação agora suporta múltiplos estados e tipos de instrumento simultaneamente.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InmetroImportPage
