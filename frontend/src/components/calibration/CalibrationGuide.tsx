import { useRef, useEffect } from 'react'
import { Info, AlertTriangle, CheckCircle, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GuideStep {
    title: string
    what: string
    why: string
    how: string[]
    tips?: string[]
    warnings?: string[]
    normRef?: string
}

const WIZARD_GUIDES: Record<string, GuideStep> = {
    identification: {
        title: 'Identificação do Equipamento',
        what: 'Nesta etapa você informa os dados da balança que será calibrada.',
        why: 'A ISO 17025 (§7.8.2.1g) exige identificação inequívoca do instrumento calibrado no certificado.',
        how: [
            'Selecione o equipamento cadastrado no sistema',
            'Verifique se a classe de exatidão (I, II, III ou IIII) está correta',
            'Confirme os valores de capacidade máxima (Max) e divisão de verificação (e)',
            'Selecione o tipo de verificação: Inicial (nova), Subsequente (periódica) ou Em Uso (supervisão)',
        ],
        tips: [
            'A divisão de verificação "e" define a precisão dos cálculos de EMA',
            'Se "e" não estiver informado, o sistema usará a resolução "d" da balança',
        ],
        normRef: 'Portaria INMETRO 157/2022, ISO 17025 §7.8.2.1g',
    },
    environment: {
        title: 'Condições Ambientais',
        what: 'Registre temperatura, umidade e pressão atmosférica no local da calibração.',
        why: 'As condições ambientais influenciam os resultados da medição. A ISO 17025 (§7.8.4) exige seu registro.',
        how: [
            'Meça a temperatura com termômetro calibrado (precisão ≈ 0.2°C)',
            'Registre a umidade relativa do ar',
            'Registre a pressão atmosférica (se disponível)',
            'O sistema buscará automaticamente a aceleração da gravidade local',
        ],
        tips: [
            'Faixa recomendada: 15-25°C de temperatura, 30-70% de umidade',
            'A gravidade local varia até 0,13% no Brasil — isso afeta a pesagem!',
            'Ligue a balança pelo menos 1 hora antes da calibração',
        ],
        warnings: [
            'Evite correntes de ar, vibrações e luz solar direta sobre a balança',
        ],
        normRef: 'ISO 17025 §7.8.4, OIML R76-1 Anexo A',
    },
    standards: {
        title: 'Padrões de Medição',
        what: 'Selecione os pesos padrão que serão usados na calibração.',
        why: 'A rastreabilidade metrológica (ISO 17025 §7.8.4) é garantida pelos certificados dos pesos padrão.',
        how: [
            'Selecione os pesos padrão cadastrados no sistema',
            'Verifique se os certificados estão dentro da validade',
            'O sistema validará automaticamente se a classe do peso é adequada para a balança',
        ],
        tips: [
            'Balança Classe I → Pesos classe E2 ou superior',
            'Balança Classe II → Pesos classe F1 ou superior',
            'Balança Classe III → Pesos classe M1 ou superior',
            'Balança Classe IIII → Pesos classe M2 ou superior',
        ],
        warnings: [
            'Pesos com certificado vencido NÃO devem ser usados',
            'Manuseie pesos das classes E e F com luvas limpas',
        ],
        normRef: 'OIML R111-1, ISO 17025 §7.8.4',
    },
    readings: {
        title: 'Leituras de Calibração (Linearidade)',
        what: 'Registre as indicações da balança em diferentes pontos de carga, crescente e decrescente.',
        why: 'O ensaio de linearidade verifica se a balança mede com a mesma exatidão em toda a faixa.',
        how: [
            'Use o sistema de sugestão automática de pontos (mínimo 5 pontos)',
            'Coloque os pesos centralizados no prato da balança',
            'Registre a indicação na carga crescente (adicionando pesos)',
            'Registre a indicação na carga decrescente (retirando pesos)',
            'O sistema calcula automaticamente: erro, EMA e conformidade',
        ],
        tips: [
            'Centralize bem os pesos para minimizar o erro de excentricidade',
            'Anote a leitura somente quando a balança estabilizar',
            'Os pontos sugeridos são: 10%, 25%, 50%, 75% e 100% da capacidade',
        ],
        normRef: 'Portaria INMETRO 157/2022, OIML R76-1 §3.5',
    },
    eccentricity: {
        title: 'Ensaio de Excentricidade',
        what: 'Verifica se a balança indica o mesmo valor independente da posição do peso no prato.',
        why: 'Cargas não centralizadas no uso real podem gerar erros. Este ensaio avalia essa influência.',
        how: [
            'Use um peso de aproximadamente 1/3 da capacidade máxima',
            'Coloque o peso em 5 posições: Centro, Frente-Esq, Frente-Dir, Traseira-Esq, Traseira-Dir',
            'Retorne ao Centro para verificar estabilidade',
            'NÃO zere/tare a balança durante o ensaio',
            'Posicione o peso próximo à borda do prato',
        ],
        tips: [
            'A diferença entre qualquer posição e o centro não deve exceder o EMA',
            'Use sempre o mesmo peso em todas as posições',
        ],
        normRef: 'OIML R76-1 §A.4.7, Portaria 157/2022',
    },
    repeatability: {
        title: 'Ensaio de Repetibilidade',
        what: 'Verifica a consistência das leituras em medições repetidas com a mesma carga.',
        why: 'Avalia a dispersão das medições e contribui para o cálculo da incerteza tipo A.',
        how: [
            'Use uma carga próxima da capacidade máxima (≈50% do Max)',
            'Coloque o peso no prato, anote a leitura, retire o peso',
            'Repita 10 vezes consecutivas',
            'O sistema calcula automaticamente: média, desvio padrão, amplitude e incerteza tipo A',
        ],
        tips: [
            'Se o cliente costuma tarar antes de cada pesagem, faça o mesmo no ensaio',
            'Anote cada leitura assim que a balança estabilizar',
            'O desvio padrão é a base do cálculo de incerteza tipo A',
        ],
        normRef: 'OIML R76-1 §A.4.10, NIT-DICLA-021',
    },
}

interface CalibrationGuideProps {
    step: string
    compact?: boolean
    className?: string
}

export function CalibrationGuide({ step, compact = false, className }: CalibrationGuideProps) {
    const guide = WIZARD_GUIDES[step]
    if (!guide) return null

    if (compact) {
        return (
            <div className={cn('rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800', className)}>
                <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <div>
                        <p className="font-semibold">{guide.title}</p>
                        <p className="mt-1 text-blue-700">{guide.what}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={cn('rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-3', className)}>
            <div className="flex items-center gap-2 text-blue-800">
                <BookOpen className="h-5 w-5" />
                <h3 className="font-bold text-sm">{guide.title}</h3>
            </div>

            <div className="text-xs text-blue-800 space-y-2">
                <div>
                    <span className="font-semibold">O que é:</span> {guide.what}
                </div>
                <div>
                    <span className="font-semibold">Por que é obrigatório:</span> {guide.why}
                </div>
            </div>

            <div className="text-xs">
                <span className="font-semibold text-blue-800">Como fazer:</span>
                <ol className="mt-1 ml-4 space-y-0.5 text-blue-700 list-decimal">
                    {guide.how.map((item, i) => <li key={i}>{item}</li>)}
                </ol>
            </div>

            {guide.tips && guide.tips.length > 0 && (
                <div className="text-xs">
                    <div className="flex items-center gap-1 text-green-700 font-semibold">
                        <CheckCircle className="h-3.5 w-3.5" /> Dicas
                    </div>
                    <ul className="mt-1 ml-5 space-y-0.5 text-green-700 list-disc">
                        {guide.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                    </ul>
                </div>
            )}

            {guide.warnings && guide.warnings.length > 0 && (
                <div className="text-xs">
                    <div className="flex items-center gap-1 text-amber-700 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" /> Atenção
                    </div>
                    <ul className="mt-1 ml-5 space-y-0.5 text-amber-700 list-disc">
                        {guide.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            )}

            {guide.normRef && (
                <div className="text-[10px] text-blue-500 border-t border-blue-200 pt-2">
                    Ref: {guide.normRef}
                </div>
            )}
        </div>
    )
}

interface EnvironmentAlertProps {
    temperature?: number
    humidity?: number
}

export function EnvironmentAlert({ temperature, humidity }: EnvironmentAlertProps) {
    const warnings: string[] = []
    if (temperature !== undefined && (temperature < 15 || temperature > 25)) {
        warnings.push(`Temperatura ${temperature}°C fora da faixa recomendada (15-25°C)`)
    }
    if (humidity !== undefined && (humidity < 30 || humidity > 70)) {
        warnings.push(`Umidade ${humidity}% fora da faixa recomendada (30-70%)`)
    }
    if (warnings.length === 0) return null

    return (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Condições fora da faixa recomendada</p>
                    <ul className="mt-1 list-disc ml-4">
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            </div>
        </div>
    )
}

interface WeightClassAlertProps {
    balanceClass: string
    weights: Array<{ code: string; precisionClass?: string; certificateExpiry?: string }>
}

export function WeightClassAlert({ balanceClass, weights }: WeightClassAlertProps) {
    const MIN_WEIGHT_CLASS: Record<string, string> = {
        I: 'E2', II: 'F1', III: 'M1', IIII: 'M2',
    }
    const WEIGHT_CLASS_RANK: Record<string, number> = {
        E1: 1, E2: 2, F1: 3, F2: 4, M1: 5, 'M1-2': 6, M2: 7, 'M2-3': 8, M3: 9,
    }

    const issues: string[] = []
    const minClass = MIN_WEIGHT_CLASS[balanceClass]
    if (!minClass) return null

    const minRank = WEIGHT_CLASS_RANK[minClass] ?? 99

    for (const w of weights) {
        if (w.precisionClass) {
            const rank = WEIGHT_CLASS_RANK[w.precisionClass] ?? 99
            if (rank > minRank) {
                issues.push(`Peso ${w.code}: classe ${w.precisionClass} insuficiente (mínimo: ${minClass})`)
            }
        }
        if (w.certificateExpiry && new Date(w.certificateExpiry) < new Date()) {
            issues.push(`Peso ${w.code}: certificado vencido`)
        }
    }

    if (issues.length === 0) return null

    return (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
            <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Problemas com os pesos padrão</p>
                    <ul className="mt-1 list-disc ml-4">
                        {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                </div>
            </div>
        </div>
    )
}

interface Iso17025ProgressProps {
    filledCount: number
    totalCount: number
    missingFields: string[]
}

const FIELD_LABELS: Record<string, string> = {
    title: 'Título do certificado',
    laboratory_name: 'Nome do laboratório',
    calibration_location: 'Local da calibração',
    certificate_number: 'Número do certificado',
    client_name: 'Nome do cliente',
    calibration_method: 'Método de calibração',
    item_identification: 'Identificação do instrumento',
    calibration_date: 'Data da calibração',
    scope_declaration: 'Declaração de escopo',
    measurement_results: 'Resultados de medição',
    authorizer_signature: 'Assinatura do autorizador',
    measurement_uncertainty: 'Incerteza de medição',
    environmental_conditions: 'Condições ambientais',
    traceability_declaration: 'Declaração de rastreabilidade',
    before_after_adjustment: 'Dados antes/depois ajuste',
    conformity_declaration: 'Declaração de conformidade',
}

export function Iso17025Progress({ filledCount, totalCount, missingFields }: Iso17025ProgressProps) {
    const pct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0
    const isComplete = pct === 100
    const barRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (barRef.current) barRef.current.style.width = `${pct}%`
    }, [pct])

    return (
        <div className={cn(
            'rounded-lg border p-3 text-xs',
            isComplete ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'
        )}>
            <div className="flex items-center justify-between mb-2">
                <span className={cn('font-semibold', isComplete ? 'text-green-800' : 'text-amber-800')}>
                    {isComplete ? '✓ ISO 17025 Completo' : 'ISO 17025: Progresso'}
                </span>
                <span className={cn('font-bold', isComplete ? 'text-green-700' : 'text-amber-700')}>
                    {filledCount}/{totalCount} ({pct}%)
                </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                    ref={barRef}
                    className={cn('h-full rounded-full transition-all', isComplete ? 'bg-green-500' : 'bg-amber-500')}
                />
            </div>
            {missingFields.length > 0 && (
                <div className="mt-2 text-amber-700">
                    <span className="font-medium">Campos faltantes:</span>
                    <ul className="mt-1 ml-4 list-disc">
                        {missingFields.map((f) => (
                            <li key={f}>{FIELD_LABELS[f] || f}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
