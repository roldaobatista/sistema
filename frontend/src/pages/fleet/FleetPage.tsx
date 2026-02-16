import { useState } from 'react'
import {
    Gauge, Truck, Disc, Calendar, ClipboardList, Fuel,
    Shield, FileWarning, AlertTriangle, Calculator,
    Award, MapPin, Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'

// Abas
import { FleetDashboardTab } from './components/FleetDashboardTab'
import { VehiclesTab } from './components/VehiclesTab'
import { FleetTiresTab } from './components/FleetTiresTab'
import { FleetPoolTab } from './components/FleetPoolTab'
import { FleetInsuranceTab } from './components/FleetInsuranceTab'
import { FleetFuelTab } from './components/FleetFuelTab'
import { FleetInspectionsTab } from './components/FleetInspectionsTab'
import { FleetAccidentsTab } from './components/FleetAccidentsTab'
import { FuelComparisonTab } from './components/FuelComparisonTab'
import { DriverScoreTab } from './components/DriverScoreTab'
import { GpsLiveTab } from './components/GpsLiveTab'
import { TollDashboardTab } from './components/TollDashboardTab'
import { FleetFinesTab } from './components/FleetFinesTab'
import { useAuthStore } from '@/stores/auth-store'

const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Gauge size={14} /> },
    { id: 'vehicles', label: 'Veículos', icon: <Truck size={14} /> },
    { id: 'tires', label: 'Pneus', icon: <Disc size={14} /> },
    { id: 'fuel', label: 'Abastecimento', icon: <Fuel size={14} /> },
    { id: 'fuel-compare', label: 'Comparador', icon: <Calculator size={14} /> },
    { id: 'inspections', label: 'Inspeções', icon: <ClipboardList size={14} /> },
    { id: 'pool', label: 'Pool', icon: <Calendar size={14} /> },
    { id: 'insurance', label: 'Seguros', icon: <Shield size={14} /> },
    { id: 'fines', label: 'Multas', icon: <FileWarning size={14} /> },
    { id: 'accidents', label: 'Acidentes', icon: <AlertTriangle size={14} /> },
    { id: 'drivers', label: 'Motoristas', icon: <Award size={14} /> },
    { id: 'gps', label: 'GPS', icon: <MapPin size={14} /> },
    { id: 'tolls', label: 'Pedágios', icon: <Receipt size={14} /> },
] as const

type TabId = typeof tabs[number]['id']

const tabComponents: Record<TabId, React.FC> = {
    dashboard: FleetDashboardTab,
    vehicles: VehiclesTab,
    tires: FleetTiresTab,
    fuel: FleetFuelTab,
    'fuel-compare': FuelComparisonTab,
    inspections: FleetInspectionsTab,
    pool: FleetPoolTab,
    insurance: FleetInsuranceTab,
    fines: FleetFinesTab,
    accidents: FleetAccidentsTab,
    drivers: DriverScoreTab,
    gps: GpsLiveTab,
    tolls: TollDashboardTab,
}

export default function FleetPage() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['fleet'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [activeTab, setActiveTab] = useState<TabId>('dashboard')
    const ActiveComponent = tabComponents[activeTab]

    const { data: fleetSummary } = useQuery({
        queryKey: ['fleet-summary'],
        queryFn: () => api.get('/fleet/dashboard').then(r => r.data?.data),
        retry: 1,
    })

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestão de Frota"
                subtitle={`Controle inteligente de veículos, custos, motoristas e manutenção${fleetSummary?.total_vehicles ? ` • ${fleetSummary.total_vehicles} veículos` : ''}`}
            />

            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex bg-surface-100/50 p-1 rounded-2xl border border-default min-w-max">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap",
                                activeTab === tab.id
                                    ? "bg-surface-0 text-brand-700 shadow-sm border border-default"
                                    : "text-surface-500 hover:text-brand-600"
                            )}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-4">
                <ActiveComponent />
            </div>
        </div>
    )
}
