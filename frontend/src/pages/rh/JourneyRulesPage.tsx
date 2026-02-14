import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Settings, Plus, Pencil, Trash2, Clock, Moon, TrendingUp, Archive
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface JourneyRule {
    id: number
    name: string
    daily_hours: string
    weekly_hours: string
    overtime_weekday_pct: number
    overtime_weekend_pct: number
    overtime_holiday_pct: number
    night_shift_pct: number
    night_start: string
    night_end: string
    uses_hour_bank: boolean
    hour_bank_expiry_months: number
    is_default: boolean
}

const defaultForm = {
    name: '',
    daily_hours: '8',
    weekly_hours: '44',
    overtime_weekday_pct: '50',
    overtime_weekend_pct: '100',
    overtime_holiday_pct: '100',
    night_shift_pct: '20',
    night_start: '22:00',
    night_end: '05:00',
    uses_hour_bank: false,
    hour_bank_expiry_months: '6',
}

export default function JourneyRulesPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canManage = hasRole('super_admin') || hasPermission('hr.journey.manage')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<JourneyRule | null>(null)
    const [form, setForm] = useState(defaultForm)
    const [deleteTarget, setDeleteTarget] = useState<JourneyRule | null>(null)

    const { data: rulesRes, isLoading } = useQuery({
  const [searchTerm, setSearchTerm] = useState('')
        queryKey: ['journey-rules'],
        queryFn: () => api.get('/hr/journey-rules').then(r => r.data?.data ?? []),
    })

    const rules: JourneyRule[] = rulesRes ?? []

    const saveMut = useMutation({
        mutationFn: (data: any) =>
            editing
                ? api.put(`/hr/journey-rules/${editing.id}`, data)
                : api.post('/hr/journey-rules', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['journey-rules'] })
            setShowModal(false)
            setEditing(null)
            toast.success(editing ? 'Regra atualizada' : 'Regra criada')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/hr/journey-rules/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['journey-rules'] })
            setDeleteTarget(null)
            toast.success('Regra excluída')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir'),
    })

    const openCreate = () => {
        setEditing(null)
        setForm(defaultForm)
        setShowModal(true)
    }

    const openEdit = (r: JourneyRule) => {
        setEditing(r)
        setForm({
            name: r.name,
            daily_hours: r.daily_hours,
            weekly_hours: r.weekly_hours,
            overtime_weekday_pct: String(r.overtime_weekday_pct),
            overtime_weekend_pct: String(r.overtime_weekend_pct),
            overtime_holiday_pct: String(r.overtime_holiday_pct),
            night_shift_pct: String(r.night_shift_pct),
            night_start: r.night_start,
            night_end: r.night_end,
            uses_hour_bank: r.uses_hour_bank,
            hour_bank_expiry_months: String(r.hour_bank_expiry_months),
        })
        setShowModal(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        saveMut.mutate({
            ...form,
            daily_hours: parseFloat(form.daily_hours),
            weekly_hours: parseFloat(form.weekly_hours),
            overtime_weekday_pct: parseInt(form.overtime_weekday_pct, 10),
            overtime_weekend_pct: parseInt(form.overtime_weekend_pct, 10),
            overtime_holiday_pct: parseInt(form.overtime_holiday_pct, 10),
            night_shift_pct: parseInt(form.night_shift_pct, 10),
            hour_bank_expiry_months: parseInt(form.hour_bank_expiry_months, 10),
        })
    }

    const set = (key: string, value: any) => setForm(p => ({ ...p, [key]: value }))

    return (
        <div className="space-y-5">
            <PageHeader title="Regras de Jornada" subtitle="Configuração de horários, HE e banco de horas (CLT)" />

            <div className="flex justify-end">
                {canManage && (
                    <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>Nova Regra</Button>
                )}
            </div>

            {/* Cards Grid */}
            {isLoading ? (
                <div className="py-12 text-center text-surface-400">Carregando...</div>
            ) : rules.length === 0 ? (
                <div className="rounded-xl border border-default bg-surface-0 p-12 text-center shadow-card">
                    <Settings className="mx-auto h-10 w-10 text-surface-300" />
                    <p className="mt-3 text-sm text-surface-400">Nenhuma regra configurada</p>
                    {canManage && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                            Criar primeira regra
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rules.map(r => (
                        <div key={r.id} className={cn(
                            'rounded-xl border bg-surface-0 p-5 shadow-card transition-all hover:shadow-md',
                            r.is_default ? 'border-brand-200 ring-1 ring-brand-100' : 'border-default'
                        )}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-surface-900">{r.name}</h3>
                                        {r.is_default && (
                                            <span className="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">PADRÃO</span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs text-surface-500">
                                        {r.daily_hours}h/dia · {r.weekly_hours}h/semana
                                    </p>
                                </div>
                                {canManage && (
                                    <div className="flex gap-1">
                                        <button title="Editar" onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button title="Excluir" onClick={() => setDeleteTarget(r)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                                    <div>
                                        <p className="text-[10px] text-amber-600">HE Dia Útil</p>
                                        <p className="text-xs font-bold text-amber-700">{r.overtime_weekday_pct}%</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-2.5 py-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-red-600" />
                                    <div>
                                        <p className="text-[10px] text-red-600">HE Fds/Feriado</p>
                                        <p className="text-xs font-bold text-red-700">{r.overtime_weekend_pct}%/{r.overtime_holiday_pct}%</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1.5">
                                    <Moon className="h-3.5 w-3.5 text-indigo-600" />
                                    <div>
                                        <p className="text-[10px] text-indigo-600">Noturno</p>
                                        <p className="text-xs font-bold text-indigo-700">{r.night_shift_pct}% ({r.night_start}-{r.night_end})</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-surface-50 px-2.5 py-1.5">
                                    <Archive className="h-3.5 w-3.5 text-surface-500" />
                                    <div>
                                        <p className="text-[10px] text-surface-500">Banco Horas</p>
                                        <p className="text-xs font-bold text-surface-700">
                                            {r.uses_hour_bank ? `Sim (${r.hour_bank_expiry_months}m)` : 'Não'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal open={showModal && canManage} onOpenChange={setShowModal} title={editing ? 'Editar Regra' : 'Nova Regra'} size="lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Nome *" value={form.name} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Horas/Dia" type="number" step="0.5" value={form.daily_hours}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('daily_hours', e.target.value)} />
                        <Input label="Horas/Semana" type="number" step="0.5" value={form.weekly_hours}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('weekly_hours', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <Input label="HE Dia Útil (%)" type="number" value={form.overtime_weekday_pct}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('overtime_weekday_pct', e.target.value)} />
                        <Input label="HE Fds (%)" type="number" value={form.overtime_weekend_pct}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('overtime_weekend_pct', e.target.value)} />
                        <Input label="HE Feriado (%)" type="number" value={form.overtime_holiday_pct}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('overtime_holiday_pct', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <Input label="Adicional Noturno (%)" type="number" value={form.night_shift_pct}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('night_shift_pct', e.target.value)} />
                        <Input label="Início Noturno" type="time" value={form.night_start}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('night_start', e.target.value)} />
                        <Input label="Fim Noturno" type="time" value={form.night_end}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('night_end', e.target.value)} />
                    </div>
                    <div className="flex items-center gap-4 rounded-lg border border-subtle bg-surface-50 p-3">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.uses_hour_bank}
                                onChange={e => set('uses_hour_bank', e.target.checked)}
                                className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                            />
                            Usar Banco de Horas
                        </label>
                        {form.uses_hour_bank && (
                            <Input label="Expiração (meses)" type="number" min="1" max="12" value={form.hour_bank_expiry_months}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('hour_bank_expiry_months', e.target.value)} />
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir Regra" size="sm">
                <p className="text-sm text-surface-600">
                    Tem certeza que deseja excluir a regra <strong>{deleteTarget?.name}</strong>?
                </p>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                    <Button
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
                        loading={deleteMut.isPending}
                    >
                        Excluir
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
