import { useState } from 'react'
import { Upload, RefreshCw, CheckCircle, AlertCircle, Loader2, FileText, Globe } from 'lucide-react'
import { useImportXml, useSubmitPsieResults } from '@/hooks/useInmetro'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

export function InmetroImportPage() {
    const { hasPermission } = useAuthStore()
    const canImport = hasPermission('inmetro.intelligence.import')
    const [importType, setImportType] = useState('all')
    const [psieResults, setPsieResults] = useState('')

    const xmlImport = useImportXml()
    const psieSubmit = useSubmitPsieResults()

    const handleXmlImport = () => {
        xmlImport.mutate({ uf: 'MT', type: importType }, {
            onSuccess: (res) => {
                const results = res.data?.results
                const msgs: string[] = []
                if (results?.competitors?.stats) {
                    const s = results.competitors.stats
                    msgs.push(`Concorrentes: ${s.created} novos, ${s.updated} atualizados`)
                }
                if (results?.instruments?.stats) {
                    const s = results.instruments.stats
                    msgs.push(`Instrumentos: ${s.instruments_created} novos, Proprietários: ${s.owners_created} novos`)
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
                <p className="text-sm text-surface-500 mt-0.5">Importar dados de instrumentos e oficinas do portal PSIE</p>
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

                    <p className="text-xs text-surface-600 mb-4">
                        Importa oficinas autorizadas e balanças rodoferroviárias do portal de dados abertos do INMETRO
                        (<code className="text-xs bg-surface-100 px-1 rounded">servicos.rbmlq.gov.br/dados-abertos/MT/</code>).
                    </p>

                    <div className="mb-4">
                        <label className="text-xs font-medium text-surface-700 block mb-1.5">O que importar</label>
                        <select
                            value={importType}
                            onChange={e => setImportType(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
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
                            <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
                        ) : (
                            <><Upload className="h-4 w-4" /> Importar XML de MT</>
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
                        <p><strong>Passo 2:</strong> Consulte por município (UF: MT), copie os resultados da tabela.</p>
                        <p><strong>Passo 3:</strong> Cole os dados JSON abaixo (formato: array de objetos com campos inmetro_number, owner_name, document, city, etc.).</p>
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

            {/* Info Box */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-700 space-y-1">
                        <p className="font-semibold">Atualização Semanal Automática</p>
                        <p>Os dados XML são atualizados automaticamente toda segunda-feira às 06:00. Os dados do PSIE (com captcha) precisam ser importados manualmente.</p>
                        <p className="text-blue-600">Tip: Use o navegador para consultar município por município no PSIE. Priorize Rondonópolis e cidades num raio de 300km.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InmetroImportPage
