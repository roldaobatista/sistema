import React, { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Zap, Plus, Trash2, Edit2, ToggleLeft, ToggleRight,
    UserCheck, Flag, Clock, Bell, Save, X,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'

const acaoLabels: Record<string, { label: string; icon: any; color: string }> = {
    auto_assign: { label: 'Auto-atribuir', icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
    set_priority: { label: 'Definir Prioridade', icon: Flag, color: 'text-amber-600 bg-amber-50' },
    set_due: { label: 'Definir Prazo', icon: Clock, color: 'text-emerald-600 bg-emerald-50' },
    notify: { label: 'Notificar', icon: Bell, color: 'text-indigo-600 bg-indigo-50' },
}

const emptyForm = {
    nome: '', descricao: '', ativo: true,
    evento_trigger: '', tipo_item: '', status_trigger: '', prioridade_minima: '',
    acao_tipo: 'auto_assign',
    acao_config: {} as Record<string, any>,
    responsavel_user_id: '' as any, role_alvo: '',
}

export function CentralRulesPage() {
  const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState({ ...emptyForm })

    const { data: rulesRes, isLoading } = useQuery({
        queryKey: ['central-rules'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/central/rules'),
    })
    const rules: any[] = rulesRes?.data?.data ?? []

    const { data: usersRes } = useQuery({
        queryKey: ['users-central-rules'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/users', { params: { per_page: 100 } }),
    })
    const users: any[] = usersRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: () => {
            const payload = {
                ...form,
                responsavel_user_id: form.responsavel_user_id || null,
                acao_config: Object.keys(form.acao_config).length > 0 ? form.acao_config : null,
            }
            return editingId
                ? api.patch(`/central/rules/${editingId}`, payload)
                : api.post('/central/rules', payload)
        },
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['central-rules'] })
            resetForm()
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/central/rules/${id}`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['central-rules'] })
        },
    })

    const toggleMut = useMutation({
        mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
            api.patch(`/central/rules/${id}`, { ativo }),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['central-rules'] })
        },
    })

    const resetForm = () => {
        setForm({ ...emptyForm })
        setEditingId(null)
        setShowForm(false)
    }

    const openEdit = (rule: any) => {
        setForm({
            nome: rule.nome ?? '',
            descricao: rule.descricao ?? '',
            ativo: rule.ativo ?? true,
            evento_trigger: rule.evento_trigger ?? '',
            tipo_item: rule.tipo_item ?? '',
            status_trigger: rule.status_trigger ?? '',
            prioridade_minima: rule.prioridade_minima ?? '',
            acao_tipo: rule.acao_tipo ?? 'auto_assign',
            acao_config: rule.acao_config ?? {},
            responsavel_user_id: rule.responsavel_user_id ?? '',
            role_alvo: rule.role_alvo ?? '',
        })
        setEditingId(rule.id)
        setShowForm(true)
    }

    const setF = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Regras de Automação</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Configure ações automáticas para itens da Central</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => { resetForm(); setShowForm(true) }}>
                    Nova Regra
                </Button>
            </div>

            {/* Rules list */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                </div>
            ) : rules.length === 0 ? (
                <div className="rounded-xl border border-default bg-surface-0 py-16 text-center">
                    <Zap className="mx-auto h-12 w-12 text-surface-300" />
                    <p className="mt-3 text-[13px] text-surface-500">Nenhuma regra de automação criada</p>
                    <p className="text-xs text-surface-400 mt-1">Clique em "Nova Regra" para começar</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {rules.map((rule: any) => {
                        const acao = acaoLabels[rule.acao_tipo] ?? acaoLabels.auto_assign
                        const AcaoIcon = acao.icon
                        return (
                            <div key={rule.id}
                                className={`rounded-xl border bg-white p-4 shadow-card transition-all hover:shadow-md ${rule.ativo ? 'border-surface-200' : 'border-surface-100 opacity-60'}`}>
                                <div className="flex items-center gap-4">
                                    {/* Toggle */}
                                    <button onClick={() => toggleMut.mutate({ id: rule.id, ativo: !rule.ativo })}
                                        className="text-surface-400 hover:text-brand-600 transition-colors" title={rule.ativo ? 'Desativar' : 'Ativar'}>
                                        {rule.ativo
                                            ? <ToggleRight className="h-6 w-6 text-brand-500" />
                                            : <ToggleLeft className="h-6 w-6" />}
                                    </button>

                                    {/* Action icon */}
                                    <div className={`rounded-lg p-2 ${acao.color}`}>
                                        <AcaoIcon className="h-4 w-4" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-surface-900">{rule.nome}</h3>
                                            <Badge variant={rule.ativo ? 'success' : 'default'}>
                                                {rule.ativo ? 'Ativa' : 'Inativa'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-surface-500 mt-0.5">
                                            {acao.label}
                                            {rule.tipo_item && <> â€¢ Tipo: <span className="font-medium">{rule.tipo_item}</span></>}
                                            {rule.prioridade_minima && <> â€¢ Prioridade mín: <span className="font-medium">{rule.prioridade_minima}</span></>}
                                            {rule.responsavel?.name && <> â†’ <span className="font-medium">{rule.responsavel.name}</span></>}
                                            {rule.role_alvo && <> â†’ Role: <span className="font-medium">{rule.role_alvo}</span></>}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => openEdit(rule)}
                                            className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => { if (window.confirm('Deseja realmente excluir este registro?')) deleteMut.mutate(rule.id) }}
                                            className="rounded p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* â”€â”€ Modal Criar/Editar â”€â”€ */}
            <Modal open={showForm} onOpenChange={(v) => { if (!v) resetForm() }}
                title={editingId ? 'Editar Regra' : 'Nova Regra de Automação'}>
                <div className="space-y-4">
                    <Input label="Nome da Regra" value={form.nome}
                        onChange={(e: any) => setF('nome', e.target.value)} placeholder="Ex: Auto-atribuir OS urgentes" />

                    <Input label="Descrição" value={form.descricao}
                        onChange={(e: any) => setF('descricao', e.target.value)} placeholder="Opcional" />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[13px] font-medium text-surface-700">Tipo de Ação</label>
                            <select value={form.acao_tipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setF('acao_tipo', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                <option value="auto_assign">Auto-atribuir</option>
                                <option value="set_priority">Definir Prioridade</option>
                                <option value="set_due">Definir Prazo</option>
                                <option value="notify">Notificar</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[13px] font-medium text-surface-700">Tipo de Item</label>
                            <select value={form.tipo_item} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setF('tipo_item', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                <option value="">Qualquer</option>
                                <option value="os">OS</option>
                                <option value="chamado">Chamado</option>
                                <option value="orcamento">Orçamento</option>
                                <option value="financeiro">Financeiro</option>
                                <option value="calibracao">Calibração</option>
                                <option value="tarefa">Tarefa</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[13px] font-medium text-surface-700">Prioridade Mínima</label>
                            <select value={form.prioridade_minima} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setF('prioridade_minima', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                <option value="">Sem filtro</option>
                                <option value="baixa">Baixa</option>
                                <option value="media">Média</option>
                                <option value="alta">Alta</option>
                                <option value="urgente">Urgente</option>
                            </select>
                        </div>
                        <Input label="Evento Trigger" value={form.evento_trigger}
                            onChange={(e: any) => setF('evento_trigger', e.target.value)} placeholder="Ex: WorkOrderCreated" />
                    </div>

                    {/* Ação-specific config */}
                    {form.acao_tipo === 'auto_assign' && (
                        <div className="grid grid-cols-2 gap-4 rounded-lg bg-blue-50/50 p-3">
                            <div>
                                <label className="text-[13px] font-medium text-surface-700">Atribuir para</label>
                                <select value={form.responsavel_user_id}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setF('responsavel_user_id', e.target.value || '')}
                                    className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                    <option value="">Por role (balanceado)</option>
                                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <Input label="Role Alvo" value={form.role_alvo}
                                onChange={(e: any) => setF('role_alvo', e.target.value)}
                                placeholder="Ex: tecnico" />
                        </div>
                    )}

                    {form.acao_tipo === 'set_priority' && (
                        <div className="rounded-lg bg-amber-50/30 p-3">
                            <label className="text-[13px] font-medium text-surface-700">Nova Prioridade</label>
                            <select value={form.acao_config?.prioridade ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setF('acao_config', { prioridade: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                <option value="baixa">Baixa</option>
                                <option value="media">Média</option>
                                <option value="alta">Alta</option>
                                <option value="urgente">Urgente</option>
                            </select>
                        </div>
                    )}

                    {form.acao_tipo === 'set_due' && (
                        <div className="rounded-lg bg-emerald-50/50 p-3">
                            <Input label="Prazo em Horas" type="number" value={form.acao_config?.horas ?? ''}
                                onChange={(e: any) => setF('acao_config', { horas: parseInt(e.target.value) || '' })}
                                placeholder="Ex: 24" />
                        </div>
                    )}

                    {/* Save */}
                    <div className="flex justify-end gap-2 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={resetForm} icon={<X className="h-4 w-4" />}>Cancelar</Button>
                        <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}
                            icon={<Save className="h-4 w-4" />} disabled={!form.nome.trim()}>
                            {editingId ? 'Salvar' : 'Criar Regra'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
