import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Merge, AlertTriangle, ArrowRight, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

interface DuplicateGroup {
    key: string
    count: number
    customers: {
        id: number
        name: string
        document: string
        email: string
        created_at: string
    }[]
}

export function CustomerMergePage() {
  const { hasPermission } = useAuthStore()

    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [searchType, setSearchType] = useState<'name' | 'document' | 'email'>('name')

    // State for the merge process
    const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null)
    const [primaryId, setPrimaryId] = useState<number | null>(null)
    const [selectedDuplicates, setSelectedDuplicates] = useState<number[]>([])
    const [showConfirmMerge, setShowConfirmMerge] = useState(false)

    const { data: duplicates, isLoading, refetch } = useQuery({
        queryKey: ['customer-duplicates', searchType],
        queryFn: () => api.get('/customers/search-duplicates', { params: { type: searchType } }).then(res => res.data),
    })

    const mergeMutation = useMutation({
        mutationFn: (data: { primary_id: number, duplicate_ids: number[] }) =>
            api.post('/customers/merge', data),
        onSuccess: (res) => {
            toast.success(res.data.message)
                setSelectedGroup(null)
            setPrimaryId(null)
            setSelectedDuplicates([])
            setShowConfirmMerge(false)
            queryClient.invalidateQueries({ queryKey: ['customer-duplicates'] })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao realizar a fusão de clientes.')
                setShowConfirmMerge(false)
        }
    })

    const handleSelectGroup = (group: DuplicateGroup) => {
        setSelectedGroup(group)
        // Auto-select the oldest as primary by default
        const sorted = [...group.customers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        setPrimaryId(sorted[0].id)
        // Select all others as duplicates by default
        setSelectedDuplicates(sorted.slice(1).map(c => c.id))
    }

    const handleMerge = () => {
        if (!primaryId || selectedDuplicates.length === 0) return
        setShowConfirmMerge(true)
    }

    const confirmMerge = () => {
        if (!primaryId || selectedDuplicates.length === 0) return
        mergeMutation.mutate({
            primary_id: primaryId,
            duplicate_ids: selectedDuplicates
        })
    }

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Fusão de Clientes Duplicados</h1>
                <Button variant="outline" onClick={() => navigate('/cadastros/clientes')}>
                    Voltar para Clientes
                </Button>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border border-surface-200">
                <div className="flex items-center gap-4">
                    <span className="text-[13px] font-medium text-surface-700">Buscar duplicatas por:</span>
                    <div className="flex gap-2">
                        <Button
                            variant={searchType === 'name' ? 'primary' : 'outline'}
                            onClick={() => setSearchType('name')}
                            size="sm"
                        >
                            Nome
                        </Button>
                        <Button
                            variant={searchType === 'document' ? 'primary' : 'outline'}
                            onClick={() => setSearchType('document')}
                            size="sm"
                        >
                            CPF/CNPJ
                        </Button>
                        <Button
                            variant={searchType === 'email' ? 'primary' : 'outline'}
                            onClick={() => setSearchType('email')}
                            size="sm"
                        >
                            E-mail
                        </Button>
                    </div>
                    <Button variant="ghost" onClick={() => refetch()} className="ml-auto">
                        <Search className="h-4 w-4 mr-2" />
                        Atualizar Busca
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-8">Carregando duplicatas...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* List of Duplicate Groups */}
                    <div className="lg:col-span-1 space-y-4">
                        <h2 className="font-semibold text-lg text-surface-800">Grupos Encontrados ({duplicates?.length || 0})</h2>
                        <div className="space-y-3">
                            {duplicates?.map((group: DuplicateGroup, idx: number) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSelectGroup(group)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedGroup === group ? 'bg-brand-50 border-brand-500' : 'bg-white border-surface-200 hover:bg-surface-50'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-medium text-surface-900">{group.key || '(Vazio)'}</p>
                                            <p className="text-[13px] text-surface-500">{group.count} registros</p>
                                        </div>
                                        <ArrowRight className={`h-5 w-5 ${selectedGroup === group ? 'text-brand-600' : 'text-surface-300'}`} />
                                    </div>
                                </div>
                            ))}
                            {duplicates?.length === 0 && (
                                <p className="text-surface-500 text-sm">Nenhuma duplicata encontrada com este critério.</p>
                            )}
                        </div>
                    </div>

                    {/* Merge Area */}
                    <div className="lg:col-span-2">
                        {selectedGroup ? (
                            <div className="bg-white rounded-lg shadow border border-surface-200 p-6 space-y-5">
                                <div>
                                    <h2 className="text-[15px] font-semibold tabular-nums text-surface-900 flex items-center">
                                        <Merge className="h-5 w-5 mr-2 text-brand-600" />
                                        Configurar Fusão
                                    </h2>
                                    <p className="text-[13px] text-surface-500 mt-1">
                                        Selecione qual será o cliente <strong>Principal</strong> (que receberá os dados) e quais serão <strong>Mesclados</strong> (serão arquivados).
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {selectedGroup.customers.map((cust) => (
                                        <div key={cust.id} className={`flex items-center p-4 rounded-md border ${primaryId === cust.id ? 'border-emerald-500 bg-emerald-50' : selectedDuplicates.includes(cust.id) ? 'border-amber-300 bg-amber-50' : 'border-surface-200'}`}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-surface-900">{cust.name}</span>
                                                    <span className="text-xs text-surface-500">#{cust.id}</span>
                                                </div>
                                                <div className="text-[13px] text-surface-600 mt-1 space-x-3">
                                                    <span>{cust.document || 'Sem documento'}</span>
                                                    <span>•</span>
                                                    <span>{cust.email || 'Sem e-mail'}</span>
                                                </div>
                                                <div className="text-xs text-surface-400 mt-1">
                                                    Criado em: {new Date(cust.created_at).toLocaleDateString()}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant={primaryId === cust.id ? 'success' : 'outline'}
                                                    onClick={() => {
                                                        setPrimaryId(cust.id)
                                                        setSelectedDuplicates(selectedGroup.customers.filter(c => c.id !== cust.id).map(c => c.id))
                                                    }}
                                                >
                                                    {primaryId === cust.id ? <Check className="h-4 w-4 mr-1" /> : null}
                                                    {primaryId === cust.id ? 'Principal' : 'Definir Principal'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-blue-50 p-4 rounded-md flex items-start">
                                    <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                                    <div className="text-sm text-blue-800">
                                        <p className="font-medium">O que acontece na fusão?</p>
                                        <ul className="list-disc ml-4 mt-1 space-y-1">
                                            <li>Todos os contatos, OS, orçamentos, equipamentos e financeiro dos clientes duplicados serão movidos para o <strong>Principal</strong>.</li>
                                            <li>As anotações serão concatenadas no histórico do Principal.</li>
                                            <li>Os clientes duplicados serão movidos para a lixeira (Soft Delete).</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-subtle">
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        onClick={handleMerge}
                                        disabled={!primaryId || selectedDuplicates.length === 0}
                                        className="bg-brand-600 hover:bg-brand-700"
                                    >
                                        Confirmar e Mesclar Clientes
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-surface-400 p-12 border-2 border-dashed border-surface-200 rounded-lg">
                                <Merge className="h-12 w-12 mb-4 opacity-20" />
                                <p>Selecione um grupo de duplicatas ao lado para iniciar a fusão.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Merge Modal */}
            <Modal open={showConfirmMerge} onOpenChange={setShowConfirmMerge} size="sm" title="Confirmar Fusão">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-medium text-surface-900">Ação irreversível</h3>
                            <p className="text-sm text-surface-500">
                                Deseja realmente mesclar <strong>{selectedDuplicates.length}</strong> cliente(s) no cliente <strong>#{primaryId}</strong>?
                            </p>
                        </div>
                    </div>

                    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 border border-amber-100">
                        <p>Esta ação <strong>não pode ser desfeita</strong>. Todos os dados dos clientes duplicados serão transferidos para o cliente principal.</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowConfirmMerge(false)}>Cancelar</Button>
                        <Button
                            className="bg-brand-600 hover:bg-brand-700 text-white"
                            loading={mergeMutation.isPending}
                            onClick={confirmMerge}
                        >
                            Confirmar Fusão
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
