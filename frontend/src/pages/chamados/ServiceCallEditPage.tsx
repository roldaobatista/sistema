import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ArrowLeft, Save, Wrench, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

type FieldErrors = Record<string, string[]>

interface Customer {
    id: number
    name: string
    document?: string | null
    address_street?: string | null
    address_number?: string | null
    address_neighborhood?: string | null
    address_city?: string | null
    address_state?: string | null
}

interface Equipment {
    id: number
    code?: string | null
    tag?: string | null
    brand?: string | null
    model?: string | null
    serial_number?: string | null
}

interface Assignee {
    id: number
    name: string
    email?: string | null
}

export function ServiceCallEditPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()

    const canAssign = hasRole('super_admin') || hasPermission('service_calls.service_call.assign')
    const canViewEquipment = hasRole('super_admin') || hasPermission('equipments.equipment.view')

    const [customerSearch, setCustomerSearch] = useState('')
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
    const [initialized, setInitialized] = useState(false)
    const [form, setForm] = useState({
        customer_id: '',
        priority: 'normal',
        technician_id: '',
        driver_id: '',
        scheduled_date: '',
        address: '',
        city: '',
        state: '',
        latitude: '',
        longitude: '',
        observations: '',
        resolution_notes: '',
        equipment_ids: [] as number[],
    })

    const { data: serviceCall, isLoading: loadingCall, isError: callError } = useQuery({
        queryKey: ['service-call', id],
        queryFn: () => api.get(`/service-calls/${id}`).then((r) => r.data),
        enabled: !!id,
    })

    useEffect(() => {
        if (!serviceCall || initialized) return
        setForm({
            customer_id: serviceCall.customer_id ? String(serviceCall.customer_id) : '',
            priority: serviceCall.priority || 'normal',
            technician_id: serviceCall.technician_id ? String(serviceCall.technician_id) : '',
            driver_id: serviceCall.driver_id ? String(serviceCall.driver_id) : '',
            scheduled_date: serviceCall.scheduled_date
                ? new Date(new Date(serviceCall.scheduled_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                : '',
            address: serviceCall.address || '',
            city: serviceCall.city || '',
            state: serviceCall.state || '',
            latitude: serviceCall.latitude ? String(serviceCall.latitude) : '',
            longitude: serviceCall.longitude ? String(serviceCall.longitude) : '',
            observations: serviceCall.observations || '',
            resolution_notes: serviceCall.resolution_notes || '',
            equipment_ids: serviceCall.equipments?.map((e: any) => e.id) ?? [],
        })
        setInitialized(true)
    }, [serviceCall, initialized])

    const {
        data: customersRes,
        isLoading: customersLoading,
        isError: customersError,
    } = useQuery({
        queryKey: ['service-call-edit-customers', customerSearch],
        queryFn: () =>
            api.get('/customers', { params: { search: customerSearch || undefined, per_page: 50 } }).then((r) => r.data),
    })

    const { data: currentCustomer } = useQuery({
        queryKey: ['customer', serviceCall?.customer_id],
        queryFn: () => api.get(`/customers/${serviceCall!.customer_id}`).then((r) => r.data),
        enabled: !!serviceCall?.customer_id,
    })

    const customers: Customer[] = useMemo(() => {
        const list: Customer[] = customersRes?.data ?? []
        if (currentCustomer && !list.some((c) => String(c.id) === String(currentCustomer.id))) {
            return [currentCustomer as Customer, ...list]
        }
        return list
    }, [customersRes?.data, currentCustomer])

    const { data: assigneesRes, isError: assigneesError } = useQuery({
        queryKey: ['service-call-assignees'],
        queryFn: () => api.get('/service-calls-assignees').then((r) => r.data),
        enabled: canAssign,
    })
    const technicians: Assignee[] = assigneesRes?.technicians ?? []
    const drivers: Assignee[] = assigneesRes?.drivers ?? []

    const {
        data: equipmentsRes,
        isLoading: equipmentsLoading,
        isError: equipmentsError,
    } = useQuery({
        queryKey: ['service-call-edit-equipments', form.customer_id],
        queryFn: () =>
            api.get('/equipments', { params: { customer_id: form.customer_id, per_page: 100 } }).then((r) => r.data),
        enabled: canViewEquipment && !!form.customer_id,
    })
    const equipments: Equipment[] = equipmentsRes?.data ?? []

    const selectedCustomer = useMemo(
        () => customers.find((c) => String(c.id) === form.customer_id),
        [customers, form.customer_id],
    )

    const firstError = (field: string) => fieldErrors[field]?.[0]

    const mutation = useMutation({
        mutationFn: () => {
            const payload: Record<string, any> = {
                customer_id: Number(form.customer_id),
                priority: form.priority,
                observations: form.observations || null,
                resolution_notes: form.resolution_notes || null,
                address: form.address || null,
                city: form.city || null,
                state: form.state || null,
                latitude: form.latitude ? Number(form.latitude) : null,
                longitude: form.longitude ? Number(form.longitude) : null,
                scheduled_date: form.scheduled_date || null,
                equipment_ids: form.equipment_ids,
            }

            if (canAssign) {
                payload.technician_id = form.technician_id ? Number(form.technician_id) : null
                payload.driver_id = form.driver_id ? Number(form.driver_id) : null
            }

            return api.put(`/service-calls/${id}`, payload)
        },
        onSuccess: () => {
            toast.success('Chamado atualizado com sucesso')
            queryClient.invalidateQueries({ queryKey: ['service-call', id] })
            queryClient.invalidateQueries({ queryKey: ['service-calls'] })
            queryClient.invalidateQueries({ queryKey: ['service-calls-summary'] })
            navigate(`/chamados/${id}`)
        },
        onError: (error: AxiosError<{ message?: string; errors?: FieldErrors }>) => {
            const status = error.response?.status
            const responseErrors = error.response?.data?.errors ?? {}
            setFieldErrors(responseErrors)

            if (status === 422) {
                toast.error(error.response?.data?.message || 'Revise os campos obrigatórios')
                return
            }
            if (status === 403) {
                toast.error('Sem permissão para editar chamado')
                return
            }
            toast.error(error.response?.data?.message || 'Erro ao atualizar chamado')
        },
    })

    const handleSelectCustomer = (customerId: string) => {
        const customer = customers.find((item) => String(item.id) === customerId)
        setForm((prev) => ({
            ...prev,
            customer_id: customerId,
            city: customer?.address_city || prev.city,
            state: customer?.address_state || prev.state,
            address: customer
                ? [customer.address_street, customer.address_number, customer.address_neighborhood].filter(Boolean).join(', ')
                : prev.address,
            equipment_ids: customerId !== form.customer_id ? [] : prev.equipment_ids,
        }))
    }

    const toggleEquipment = (equipmentId: number) => {
        setForm((prev) => ({
            ...prev,
            equipment_ids: prev.equipment_ids.includes(equipmentId)
                ? prev.equipment_ids.filter((eqId) => eqId !== equipmentId)
                : [...prev.equipment_ids, equipmentId],
        }))
    }

    const handleSubmit = () => {
        setFieldErrors({})
        if (!form.customer_id) {
            setFieldErrors({ customer_id: ['Selecione um cliente'] })
            toast.error('Selecione um cliente')
            return
        }
        mutation.mutate()
    }

    if (loadingCall) {
        return (
            <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
                <div className="h-8 bg-surface-200 rounded w-64" />
                <div className="bg-surface-0 rounded-xl p-6 space-y-4">
                    <div className="h-6 bg-surface-200 rounded w-48" />
                    <div className="h-4 bg-surface-200 rounded w-full" />
                </div>
            </div>
        )
    }

    if (callError || !serviceCall) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-surface-500">
                <AlertCircle className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Chamado não encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/chamados')}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-12">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/chamados/${id}`)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold text-surface-900">
                        Editar Chamado {serviceCall.call_number}
                    </h1>
                    <p className="text-sm text-surface-500">Atualize os dados do chamado técnico.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-xl border border-default bg-surface-0 p-5 shadow-card lg:col-span-2">
                    <h2 className="text-sm font-semibold text-surface-900">Cliente e prioridade</h2>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="md:col-span-2">
                            <label htmlFor="customer-search" className="mb-1 block text-xs font-medium text-surface-500">Buscar cliente</label>
                            <input
                                id="customer-search"
                                type="text"
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                placeholder="Digite nome ou documento"
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="priority-select" className="mb-1 block text-xs font-medium text-surface-500">Prioridade</label>
                            <select
                                id="priority-select"
                                value={form.priority}
                                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            >
                                <option value="low">Baixa</option>
                                <option value="normal">Normal</option>
                                <option value="high">Alta</option>
                                <option value="urgent">Urgente</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="customer-select" className="mb-1 block text-xs font-medium text-surface-500">Cliente</label>
                        <select
                            id="customer-select"
                            value={form.customer_id}
                            onChange={(e) => handleSelectCustomer(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            disabled={customersLoading}
                        >
                            <option value="">Selecione</option>
                            {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name}{customer.document ? ` - ${customer.document}` : ''}
                                </option>
                            ))}
                        </select>
                        {firstError('customer_id') && <p className="mt-1 text-xs text-red-600">{firstError('customer_id')}</p>}
                        {selectedCustomer && <p className="mt-1 text-xs text-surface-500">Cliente selecionado: {selectedCustomer.name}</p>}
                        {customersError && <p className="mt-1 text-xs text-red-600">Não foi possível carregar os clientes.</p>}
                    </div>
                </div>

                <div className="space-y-4 rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <h2 className="text-sm font-semibold text-surface-900">Local e horário</h2>

                    <div>
                        <label htmlFor="scheduled-date" className="mb-1 block text-xs font-medium text-surface-500">Data agendada</label>
                        <input
                            id="scheduled-date"
                            type="datetime-local"
                            value={form.scheduled_date}
                            onChange={(e) => setForm((prev) => ({ ...prev, scheduled_date: e.target.value }))}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                        />
                        {firstError('scheduled_date') && <p className="mt-1 text-xs text-red-600">{firstError('scheduled_date')}</p>}
                    </div>

                    <div>
                        <label htmlFor="address-input" className="mb-1 block text-xs font-medium text-surface-500">Endereço</label>
                        <input
                            id="address-input"
                            type="text"
                            value={form.address}
                            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                            placeholder="Rua, número, bairro"
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="city-input" className="mb-1 block text-xs font-medium text-surface-500">Cidade</label>
                            <input
                                id="city-input"
                                type="text"
                                value={form.city}
                                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="state-input" className="mb-1 block text-xs font-medium text-surface-500">UF</label>
                            <input
                                id="state-input"
                                type="text"
                                value={form.state}
                                maxLength={2}
                                onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm uppercase"
                            />
                            {firstError('state') && <p className="mt-1 text-xs text-red-600">{firstError('state')}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="lat-input" className="mb-1 block text-xs font-medium text-surface-500">Latitude</label>
                            <input
                                id="lat-input"
                                type="number"
                                step="0.000001"
                                value={form.latitude}
                                onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="lng-input" className="mb-1 block text-xs font-medium text-surface-500">Longitude</label>
                            <input
                                id="lng-input"
                                type="number"
                                step="0.000001"
                                value={form.longitude}
                                onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <h2 className="text-sm font-semibold text-surface-900">Equipe e observações</h2>

                    {canAssign ? (
                        <>
                            <div>
                                <label htmlFor="technician-select" className="mb-1 block text-xs font-medium text-surface-500">Técnico</label>
                                <select
                                    id="technician-select"
                                    value={form.technician_id}
                                    onChange={(e) => setForm((prev) => ({ ...prev, technician_id: e.target.value }))}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                                >
                                    <option value="">Não atribuir</option>
                                    {technicians.map((tech) => (
                                        <option key={tech.id} value={tech.id}>{tech.name}</option>
                                    ))}
                                </select>
                                {firstError('technician_id') && <p className="mt-1 text-xs text-red-600">{firstError('technician_id')}</p>}
                            </div>

                            <div>
                                <label htmlFor="driver-select" className="mb-1 block text-xs font-medium text-surface-500">Motorista</label>
                                <select
                                    id="driver-select"
                                    value={form.driver_id}
                                    onChange={(e) => setForm((prev) => ({ ...prev, driver_id: e.target.value }))}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                                >
                                    <option value="">Não atribuir</option>
                                    {drivers.map((driver) => (
                                        <option key={driver.id} value={driver.id}>{driver.name}</option>
                                    ))}
                                </select>
                                {firstError('driver_id') && <p className="mt-1 text-xs text-red-600">{firstError('driver_id')}</p>}
                            </div>
                            {assigneesError && (
                                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                    Não foi possível carregar técnicos e motoristas.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            Seu perfil não possui permissão para atribuir técnico no cadastro.
                        </p>
                    )}

                    <div>
                        <label htmlFor="observations-textarea" className="mb-1 block text-xs font-medium text-surface-500">Observações</label>
                        <textarea
                            id="observations-textarea"
                            value={form.observations}
                            onChange={(e) => setForm((prev) => ({ ...prev, observations: e.target.value }))}
                            rows={4}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            placeholder="Descreva o atendimento solicitado..."
                        />
                    </div>

                    <div>
                        <label htmlFor="resolution-textarea" className="mb-1 block text-xs font-medium text-surface-500">Notas de resolução</label>
                        <textarea
                            id="resolution-textarea"
                            value={form.resolution_notes}
                            onChange={(e) => setForm((prev) => ({ ...prev, resolution_notes: e.target.value }))}
                            rows={3}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            placeholder="Notas de resolução (opcional)..."
                        />
                    </div>
                </div>

                {/* Equipamentos */}
                {canViewEquipment && (
                    <div className="space-y-3 rounded-xl border border-default bg-surface-0 p-5 shadow-card lg:col-span-2">
                        <h2 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                            <Wrench className="h-4 w-4" /> Equipamentos vinculados
                        </h2>

                        {!form.customer_id ? (
                            <p className="text-sm text-surface-500">Selecione um cliente para listar os equipamentos.</p>
                        ) : equipmentsLoading ? (
                            <p className="text-sm text-surface-500">Carregando equipamentos...</p>
                        ) : equipmentsError ? (
                            <p className="text-sm text-red-600">Não foi possível carregar os equipamentos.</p>
                        ) : equipments.length === 0 ? (
                            <p className="text-sm text-surface-500">Nenhum equipamento encontrado para este cliente.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                {equipments.map((equipment) => {
                                    const checked = form.equipment_ids.includes(equipment.id)
                                    return (
                                        <label
                                            key={equipment.id}
                                            className="flex items-center gap-3 rounded-lg border border-default px-3 py-2 text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleEquipment(equipment.id)}
                                            />
                                            <span>
                                                {equipment.tag || equipment.code || equipment.model || `Equipamento #${equipment.id}`}
                                                {equipment.serial_number ? ` (S/N: ${equipment.serial_number})` : ''}
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => navigate(`/chamados/${id}`)}>
                    Cancelar
                </Button>
                <Button loading={mutation.isPending} onClick={handleSubmit}>
                    <Save className="mr-1 h-4 w-4" /> Salvar alterações
                </Button>
            </div>
        </div>
    )
}
