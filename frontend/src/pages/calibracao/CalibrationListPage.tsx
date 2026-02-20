import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
    Plus, Search, FileCheck, Clock, Scale, ChevronRight, Filter,
} from 'lucide-react'

interface CalibrationItem {
    id: number
    certificate_number: string | null
    calibration_date: string
    result: string
    equipment?: {
        id: number
        code: string
        brand: string
        model: string
        serial_number: string
        precision_class: string
        customer?: { id: number; name: string }
    }
    performer?: { id: number; name: string }
}

export default function CalibrationListPage() {
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [page, setPage] = useState(1)

    const { data: response, isLoading } = useQuery({
        queryKey: ['calibrations-list', search, statusFilter, page],
        queryFn: () => api.get('/calibration', {
            params: { search: search || undefined, status: statusFilter || undefined, page, per_page: 20 },
        }).then((r) => r.data),
        placeholderData: (prev) => prev,
    })

    const calibrations: CalibrationItem[] = response?.data ?? []
    const lastPage = response?.last_page ?? 1

    const [showEquipmentSelect, setShowEquipmentSelect] = useState(false)
    const [equipSearch, setEquipSearch] = useState('')

    const { data: equipments } = useQuery({
        queryKey: ['equipments-for-wizard', equipSearch],
        queryFn: () => api.get('/equipment', { params: { search: equipSearch || undefined, per_page: 20, category: 'balanca' } }).then((r) => r.data?.data ?? r.data ?? []),
        enabled: showEquipmentSelect,
    })

    return (
        <div className="space-y-6">
            <PageHeader title="Calibrações" subtitle="Todas as calibrações e certificados">
                <Button onClick={() => setShowEquipmentSelect(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Nova Calibração
                </Button>
            </PageHeader>

            {showEquipmentSelect && (
                <Card className="border-primary/50">
                    <CardContent className="pt-4 space-y-3">
                        <p className="font-medium text-sm">Selecione o equipamento para calibrar:</p>
                        <Input
                            placeholder="Buscar por código, modelo, série..."
                            value={equipSearch}
                            onChange={(e) => setEquipSearch(e.target.value)}
                            autoFocus
                        />
                        <div className="max-h-60 overflow-y-auto space-y-1">
                            {(equipments ?? []).map((eq: any) => (
                                <button
                                    key={eq.id}
                                    type="button"
                                    onClick={() => navigate(`/calibracao/wizard/${eq.id}`)}
                                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-all text-sm flex items-center gap-3"
                                >
                                    <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{eq.code || eq.serial_number} — {eq.brand} {eq.model}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {eq.customer?.name} · Classe {eq.precision_class || '—'} · {eq.capacity} {eq.capacity_unit}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                </button>
                            ))}
                            {equipments?.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">Nenhum equipamento encontrado</p>
                            )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowEquipmentSelect(false)}>Cancelar</Button>
                    </CardContent>
                </Card>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Buscar por certificado, código do equipamento..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                    className="border rounded-md px-3 py-2 text-sm bg-background w-full sm:w-48"
                    aria-label="Filtrar por status"
                >
                    <option value="">Todos</option>
                    <option value="with_certificate">Com Certificado</option>
                    <option value="draft">Rascunho</option>
                </select>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : calibrations.length === 0 ? (
                <div className="text-center py-12">
                    <Scale className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhuma calibração encontrada</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {calibrations.map((cal) => (
                        <button
                            key={cal.id}
                            type="button"
                            onClick={() => {
                                if (cal.certificate_number) {
                                    navigate(`/calibracoes/${cal.id}`)
                                } else if (cal.equipment?.id) {
                                    navigate(`/calibracao/wizard/${cal.equipment.id}/${cal.id}`)
                                }
                            }}
                            className="w-full text-left p-4 rounded-lg border hover:bg-muted/50 transition-all"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    {cal.certificate_number ? (
                                        <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                            <FileCheck className="h-4 w-4 text-green-700 dark:text-green-400" />
                                        </div>
                                    ) : (
                                        <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                            <Clock className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {cal.certificate_number || 'Rascunho'}
                                            {cal.equipment && <span className="text-muted-foreground font-normal"> — {cal.equipment.code || cal.equipment.serial_number} ({cal.equipment.brand} {cal.equipment.model})</span>}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {cal.calibration_date && new Date(cal.calibration_date).toLocaleDateString('pt-BR')}
                                            {cal.equipment?.customer?.name && ` · ${cal.equipment.customer.name}`}
                                            {cal.performer?.name && ` · ${cal.performer.name}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        cal.result === 'aprovado' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                        cal.result === 'reprovado' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                        {cal.result === 'aprovado' ? 'Aprovado' : cal.result === 'reprovado' ? 'Reprovado' : 'Ressalva'}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {lastPage > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <span className="text-sm text-muted-foreground self-center">{page} / {lastPage}</span>
                    <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
                </div>
            )}
        </div>
    )
}
