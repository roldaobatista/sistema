import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Camera, Loader2, Package, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface TechSeal {
    id: number
    number: string
    type: 'seal' | 'seal_reparo'
}

export default function TechSealsPage() {
  const { hasPermission } = useAuthStore()

    const { id: woId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const qc = useQueryClient()

    const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null)
    const [selectedSealId, setSelectedSealId] = useState<number | null>(null)
    const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)

    // Buscar equipamentos da OS
    const { data: woRes } = useQuery({
        queryKey: ['tech-wo-detail', woId],
        queryFn: () => api.get(`/tech/os/${woId}`)
    })
    // No nosso sistema mobile offline, os dados podem vir de fontes diferentes,
    // mas para simplificar a prova de conceito, vamos assumir acesso à API online se estiver disponível,
    // ou fallback para o que temos na OS.
    const equipments = woRes?.data?.equipments || []

    // Buscar meus selos
    const { data: mySealsRes, isLoading: loadingSeals } = useQuery({
        queryKey: ['my-seals'],
        queryFn: () => api.get('/inventory/seals/my')
    })
    const mySeals: TechSeal[] = mySealsRes?.data ?? []

    const useMut = useMutation({
        mutationFn: (data: FormData) => api.post(`/inventory/seals/${selectedSealId}/use`, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
        onSuccess: () => {
            toast.success('Selo aplicado com sucesso!')
                qc.invalidateQueries({ queryKey: ['my-seals'] })
            navigate(`/tech/os/${woId}`)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao aplicar selo')
    })

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setCapturedPhoto(file)
            setPhotoPreview(URL.createObjectURL(file))
        }
    }

    const handleSubmit = () => {
        if (!selectedEquipmentId || !selectedSealId || !capturedPhoto) {
            toast.error('Preencha todos os campos e tire a foto.')
            return
        }

        const fd = new FormData()
        fd.append('work_order_id', woId!)
        fd.append('equipment_id', selectedEquipmentId.toString())
        fd.append('photo', capturedPhoto)

        useMut.mutate(fd)
    }

    return (
        <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-950">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate(`/tech/os/${woId}`)} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Aplicar Selo/Lacre</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Equipamento */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                        <Package className="w-4 h-4" /> Equipamento
                    </label>
                    <div className="grid gap-2">
                        {equipments.length === 0 ? (
                            <p className="text-sm text-surface-500 italic">Nenhum equipamento vinculado a esta OS.</p>
                        ) : equipments.map((eq: any) => (
                            <button
                                key={eq.id}
                                onClick={() => setSelectedEquipmentId(eq.id)}
                                className={cn(
                                    "p-4 rounded-xl border text-left transition-all",
                                    selectedEquipmentId === eq.id
                                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-500"
                                        : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900"
                                )}
                            >
                                <p className="text-sm font-semibold">{eq.brand} - {eq.model}</p>
                                <p className="text-xs text-surface-500">Série: {eq.serial_number || 'N/I'}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Seleção do Selo */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Selecionar Selo/Lacre
                    </label>
                    {loadingSeals ? (
                        <div className="flex items-center gap-2 text-sm text-surface-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando seus selos...</div>
                    ) : mySeals.length === 0 ? (
                        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/30 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            <p className="text-sm text-amber-700">Você não possui selos atribuídos. Solicite ao administrativo.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {mySeals.map(seal => (
                                <button
                                    key={seal.id}
                                    onClick={() => setSelectedSealId(seal.id)}
                                    className={cn(
                                        "p-3 rounded-lg border text-center transition-all",
                                        selectedSealId === seal.id
                                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-500 font-bold"
                                            : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900 text-sm"
                                    )}
                                >
                                    {seal.number}
                                    <span className="block text-[10px] opacity-60 font-normal">
                                        {seal.type === 'seal_reparo' ? 'Selo' : 'Lacre'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Foto Obrigatória */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                        <Camera className="w-4 h-4" /> Foto da Aplicação <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoChange}
                            className="hidden"
                            id="photo-input"
                        />
                        <label
                            htmlFor="photo-input"
                            className={cn(
                                "flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                                photoPreview
                                    ? "border-emerald-500"
                                    : "border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900"
                            )}
                        >
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <Camera className="w-10 h-10 text-surface-300 mb-2" />
                                    <p className="text-sm text-surface-500 font-medium">Bater Foto</p>
                                    <p className="text-[11px] text-surface-400">Obrigatório para prosseguir</p>
                                </>
                            )}
                        </label>
                        {photoPreview && (
                            <button
                                onClick={() => { setPhotoPreview(null); setCapturedPhoto(null) }}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-lg"
                                title="Remover foto"
                            >
                                <ArrowLeft className="w-4 h-4 rotate-45" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Ação */}
            <div className="p-4 bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 safe-area-bottom">
                <button
                    onClick={handleSubmit}
                    disabled={!selectedEquipmentId || !selectedSealId || !capturedPhoto || useMut.isPending}
                    className={cn(
                        "w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold text-white shadow-lg transition-all active:scale-95",
                        (!selectedEquipmentId || !selectedSealId || !capturedPhoto)
                            ? "bg-surface-300 dark:bg-surface-800"
                            : "bg-brand-600 hover:bg-brand-700 shadow-brand-500/20"
                    )}
                >
                    {useMut.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <CheckCircle2 className="w-5 h-5" /> Confirmar Aplicação
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
