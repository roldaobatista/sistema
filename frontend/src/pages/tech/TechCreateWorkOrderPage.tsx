import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Plus, Loader2, CheckCircle2, Search, MapPin, User, Camera, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

interface Customer {
    id: number
    name: string
    document: string | null
    phone: string | null
    address_city: string | null
    address_state: string | null
}

interface ServiceItem {
    id: number
    name: string
    price: number | null
}

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Baixa', color: 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400' },
    { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'high', label: 'Alta', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
]

export default function TechCreateWorkOrderPage() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [submitting, setSubmitting] = useState(false)

    const [customerSearch, setCustomerSearch] = useState('')
    const [customers, setCustomers] = useState<Customer[]>([])
    const [searchingCustomers, setSearchingCustomers] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

    const [description, setDescription] = useState('')
    const [priority, setPriority] = useState('normal')
    const [scheduledDate, setScheduledDate] = useState('')
    const [scheduledTime, setScheduledTime] = useState('')
    const [notes, setNotes] = useState('')
    const [photos, setPhotos] = useState<string[]>([])

    useEffect(() => {
        if (customerSearch.length < 2) {
            setCustomers([])
            return
        }
        const timer = setTimeout(async () => {
            setSearchingCustomers(true)
            try {
                const { data } = await api.get('/customers', { params: { search: customerSearch, per_page: 10 } })
                setCustomers(data.data ?? data ?? [])
            } catch {
                // silently fail
            } finally {
                setSearchingCustomers(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [customerSearch])

    function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            setPhotos(prev => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
    }

    async function handleSubmit() {
        if (!selectedCustomer || !description) {
            toast.error('Preencha cliente e descrição')
            return
        }
        setSubmitting(true)
        try {
            const payload: Record<string, unknown> = {
                customer_id: selectedCustomer.id,
                description,
                priority,
                notes: notes || null,
                assigned_to: user?.id,
                status: 'pending',
            }
            if (scheduledDate) {
                payload.scheduled_date = scheduledTime
                    ? `${scheduledDate} ${scheduledTime}`
                    : scheduledDate
            }

            const { data } = await api.post('/work-orders', payload)
            toast.success('OS criada com sucesso!')
            navigate(`/tech/os/${data.data?.id ?? data.id}`)
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Erro ao criar OS')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Nova Ordem de Serviço</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Customer search */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <label className="text-xs text-surface-500 font-medium">Cliente *</label>

                    {selectedCustomer ? (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
                            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-800 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{selectedCustomer.name}</p>
                                {selectedCustomer.address_city && (
                                    <p className="text-xs text-surface-500 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {selectedCustomer.address_city}/{selectedCustomer.address_state}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
                                className="text-xs text-red-500 font-medium"
                            >
                                Trocar
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                <input
                                    type="text"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    placeholder="Buscar cliente por nome ou CNPJ..."
                                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                />
                                {searchingCustomers && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-500" />}
                            </div>
                            {customers.length > 0 && (
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {customers.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomers([]) }}
                                            className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 active:bg-surface-100 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-600">
                                                {c.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">{c.name}</p>
                                                <p className="text-xs text-surface-500">{c.document || c.phone || '—'}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Description */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <label className="text-xs text-surface-500 font-medium">Descrição do Serviço *</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descreva o serviço a ser realizado..."
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                    />
                </div>

                {/* Priority */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <label className="text-xs text-surface-500 font-medium">Prioridade</label>
                    <div className="flex gap-2">
                        {PRIORITY_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setPriority(opt.value)}
                                className={cn(
                                    'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                                    priority === opt.value
                                        ? cn(opt.color, 'ring-2 ring-brand-500/30')
                                        : 'bg-surface-100 dark:bg-surface-700 text-surface-500'
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Schedule */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <label className="text-xs text-surface-500 font-medium">Agendamento</label>
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                        />
                        <input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                        />
                    </div>
                </div>

                {/* Notes */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <label className="text-xs text-surface-500 font-medium">Observações</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Observações adicionais..."
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                    />
                </div>

                {/* Photos */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <label className="text-xs text-surface-500 font-medium">Fotos</label>
                    <div className="grid grid-cols-3 gap-2">
                        {photos.map((p, i) => (
                            <div key={i} className="relative aspect-square">
                                <img src={p} alt="" className="w-full h-full object-cover rounded-lg" />
                                <button
                                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <label className="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-surface-300 dark:border-surface-600 cursor-pointer active:bg-surface-50">
                            <Camera className="w-6 h-6 text-surface-400" />
                            <span className="text-[10px] text-surface-400 mt-1">Foto</span>
                            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedCustomer || !description}
                    className={cn(
                        'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-colors',
                        selectedCustomer && description
                            ? 'bg-brand-600 active:bg-brand-700'
                            : 'bg-surface-300 dark:bg-surface-700',
                        submitting && 'opacity-70',
                    )}
                >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Criar Ordem de Serviço
                </button>

                <div className="h-4" />
            </div>
        </div>
    )
}
