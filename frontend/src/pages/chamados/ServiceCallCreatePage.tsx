import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ArrowLeft, Save, Wrench } from 'lucide-react'
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

export function ServiceCallCreatePage() {
    const navigate = useNavigate()
    const { hasPermission, hasRole } = useAuthStore()

    const canAssign = hasRole('super_admin') || hasPermission('service_calls.service_call.assign')
    const canViewEquipment = hasRole('super_admin') || hasPermission('equipments.equipment.view')

    const [customerSearch, setCustomerSearch] = useState('')
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
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
        equipment_ids: [] as number[],
    })

    const {
        data: customersRes,
        isLoading: customersLoading,
        isError: customersError,
    } = useQuery({
        queryKey: ['service-call-create-customers', customerSearch],
        queryFn: () =>
            api
                .get('/customers', {
                    params: {
                        search: customerSearch || undefined,
                        per_page: 50,
                    },
                })
                .then((r) => r.data),
    })

    const customers: Customer[] = customersRes?.data ?? []

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
        queryKey: ['service-call-create-equipments', form.customer_id],
        queryFn: () =>
            api
                .get('/equipments', {
                    params: {
                        customer_id: form.customer_id,
                        per_page: 100,
                    },
                })
                .then((r) => r.data),
        enabled: canViewEquipment && !!form.customer_id,
    })

    const equipments: Equipment[] = equipmentsRes?.data ?? []

    const selectedCustomer = useMemo(
        () => customers.find((customer) => String(customer.id) === form.customer_id),
        [customers, form.customer_id]
    )

    const firstError = (field: string) => fieldErrors[field]?.[0]

    const mutation = useMutation({
        mutationFn: () => {
            const payload: Record<string, any> = {
                customer_id: Number(form.customer_id),
                priority: form.priority,
                observations: form.observations || undefined,
                address: form.address || undefined,
                city: form.city || undefined,
                state: form.state || undefined,
                latitude: form.latitude ? Number(form.latitude) : undefined,
                longitude: form.longitude ? Number(form.longitude) : undefined,
                scheduled_date: form.scheduled_date || undefined,
                equipment_ids: form.equipment_ids.length > 0 ? form.equipment_ids : undefined,
            }

            if (canAssign) {
                payload.technician_id = form.technician_id ? Number(form.technician_id) : undefined
                payload.driver_id = form.driver_id ? Number(form.driver_id) : undefined
            }

            return api.post('/service-calls', payload)
        },
        onSuccess: (response) => {
            toast.success('Chamado criado com sucesso')
                navigate(`/chamados/${response.data.id}`)
        },
        onError: (error: AxiosError<{ message?: string; errors?: FieldErrors }>) => {
            const status = error.response?.status
            const responseErrors = error.response?.data?.errors ?? {}
            setFieldErrors(responseErrors)

            if (status === 422) {
                toast.error(error.response?.data?.message || 'Revise os campos obrigatorios')
                return
            }

            if (status === 403) {
                toast.error('Sem permissão para criar chamado')
                return
            }

            toast.error(error.response?.data?.message || 'Erro ao criar chamado')
        },
    })

    const handleSelectCustomer = (customerId: string) => {
        const customer = customers.find((item) => String(item.id) === customerId)

        setForm((previous) => ({
            ...previous,
            customer_id: customerId,
            city: customer?.address_city || previous.city,
            state: customer?.address_state || previous.state,
            address: customer
                ? [customer.address_street, customer.address_number, customer.address_neighborhood]
                      .filter(Boolean)
                      .join(', ')
                : previous.address,
            equipment_ids: [],
        }))
    }

    const toggleEquipment = (equipmentId: number) => {
        setForm((previous) => {
            const exists = previous.equipment_ids.includes(equipmentId)
            return {
                ...previous,
                equipment_ids: exists
                    ? previous.equipment_ids.filter((id) => id !== equipmentId)
                    : [...previous.equipment_ids, equipmentId],
            }
        })
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

    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-12">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate('/chamados')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold text-surface-900">Novo Chamado</h1>
                    <p className="text-sm text-surface-500">Preencha os dados para abrir um novo atendimento técnico.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-xl border border-default bg-surface-0 p-5 shadow-card lg:col-span-2">
                    <h2 className="text-sm font-semibold text-surface-900">Cliente e prioridade</h2>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-surface-500">Buscar cliente</label>
                            <input
                                type="text"
                                value={customerSearch}
                                onChange={(event) => setCustomerSearch(event.target.value)}
                                placeholder="Digite nome ou documento"
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-500">Prioridade</label>
                            <select
                                value={form.priority}
                                onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value }))}
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
                        <label className="mb-1 block text-xs font-medium text-surface-500">Cliente</label>
                        <select
                            value={form.customer_id}
                            onChange={(event) => handleSelectCustomer(event.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            disabled={customersLoading}
                        >
                            <option value="">Selecione</option>
                            {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                    {customer.document ? ` - ${customer.document}` : ''}
                                </option>
                            ))}
                        </select>
                        {firstError('customer_id') && (
                            <p className="mt-1 text-xs text-red-600">{firstError('customer_id')}</p>
                        )}
                        {selectedCustomer && (
                            <p className="mt-1 text-xs text-surface-500">
                                Cliente selecionado: {selectedCustomer.name}
                            </p>
                        )}
                        {customersError && (
                            <p className="mt-1 text-xs text-red-600">
                                Não foi possível carregar os clientes.
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-4 rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <h2 className="text-sm font-semibold text-surface-900">Local e horário</h2>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-surface-500">Data agendada</label>
                        <input
                            type="datetime-local"
                            value={form.scheduled_date}
                            onChange={(event) => setForm((previous) => ({ ...previous, scheduled_date: event.target.value }))}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                        />
                        {firstError('scheduled_date') && (
                            <p className="mt-1 text-xs text-red-600">{firstError('scheduled_date')}</p>
                        )}
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-surface-500">Endereco</label>
                        <input
                            type="text"
                            value={form.address}
                            onChange={(event) => setForm((previous) => ({ ...previous, address: event.target.value }))}
                            placeholder="Rua, número, bairro"
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-500">Cidade</label>
                            <input
                                type="text"
                                value={form.city}
                                onChange={(event) => setForm((previous) => ({ ...previous, city: event.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-500">UF</label>
                            <input
                                type="text"
                                value={form.state}
                                maxLength={2}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        state: event.target.value.toUpperCase(),
                                    }))
                                }
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm uppercase"
                            />
                            {firstError('state') && <p className="mt-1 text-xs text-red-600">{firstError('state')}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-500">Latitude</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={form.latitude}
                                onChange={(event) => setForm((previous) => ({ ...previous, latitude: event.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-500">Longitude</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={form.longitude}
                                onChange={(event) => setForm((previous) => ({ ...previous, longitude: event.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <h2 className="text-sm font-semibold text-surface-900">Equipe e observacoes</h2>

                    {canAssign ? (
                        <>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-surface-500">Técnico</label>
                                <select
                                    value={form.technician_id}
                                    onChange={(event) =>
                                        setForm((previous) => ({ ...previous, technician_id: event.target.value }))
                                    }
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                                >
                                    <option value="">Nao atribuir</option>
                                    {technicians.map((technician) => (
                                        <option key={technician.id} value={technician.id}>
                                            {technician.name}
                                        </option>
                                    ))}
                                </select>
                                {firstError('technician_id') && (
                                    <p className="mt-1 text-xs text-red-600">{firstError('technician_id')}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-surface-500">Motorista</label>
                                <select
                                    value={form.driver_id}
                                    onChange={(event) =>
                                        setForm((previous) => ({ ...previous, driver_id: event.target.value }))
                                    }
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                                >
                                    <option value="">Nao atribuir</option>
                                    {drivers.map((driver) => (
                                        <option key={driver.id} value={driver.id}>
                                            {driver.name}
                                        </option>
                                    ))}
                                </select>
                                {firstError('driver_id') && (
                                    <p className="mt-1 text-xs text-red-600">{firstError('driver_id')}</p>
                                )}
                            </div>
                            {assigneesError && (
                                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                    Não foi possível carregar técnicos e motoristas.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            Seu perfil nao possui permissão para atribuir técnico no cadastro.
                        </p>
                    )}

                    <div>
                        <label className="mb-1 block text-xs font-medium text-surface-500">Observacoes</label>
                        <textarea
                            value={form.observations}
                            onChange={(event) => setForm((previous) => ({ ...previous, observations: event.target.value }))}
                            rows={5}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                            placeholder="Descreva o atendimento solicitado..."
                        />
                    </div>
                </div>

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
                <Button variant="outline" onClick={() => navigate('/chamados')}>
                    Cancelar
                </Button>
                <Button loading={mutation.isPending} onClick={handleSubmit}>
                    <Save className="mr-1 h-4 w-4" /> Criar chamado
                </Button>
            </div>
        </div>
    )
}
