import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, UserMinus, Briefcase, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useAuthStore } from '@/stores/auth-store'

export default function PeopleAnalyticsPage() {

    // MVP: Delete mutation
    const queryClient = useQueryClient()
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/people-analytics/${id}`),
        onSuccess: () => {
            toast.success('Removido com sucesso');
            queryClient.invalidateQueries({ queryKey: ['people-analytics'] }); setConfirmDeleteId(null)
        },
        onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover'); setConfirmDeleteId(null) },
    })
    const handleDelete = (id: number) => { setConfirmDeleteId(id) }
    const confirmDelete = () => { if (confirmDeleteId !== null) deleteMutation.mutate(confirmDeleteId) }
    const cancelDelete = () => { setConfirmDeleteId(null) }

    // MVP: Search
    const [searchTerm, setSearchTerm] = useState('')
    const { hasPermission } = useAuthStore()

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['hr-analytics'],
        queryFn: async () => {
            const response = await api.get('/hr/analytics/dashboard')
            return response.data
        }
    })

    if (isLoading) return <div className="p-8 text-center">Carregando analytics...</div>

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">People Analytics</h1>
                <p className="text-surface-500">Indicadores estratégicos de RH.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Headcount Total</CardTitle>
                        <Users className="h-4 w-4 text-surface-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.total_employees}</div>
                        <p className="text-xs text-surface-500">Colaboradores ativos</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Turnover (Simulado)</CardTitle>
                        <UserMinus className="h-4 w-4 text-surface-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.turnover_rate}%</div>
                        <p className="text-xs text-surface-500">Taxa de rotatividade mensal</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vagas Abertas</CardTitle>
                        <Briefcase className="h-4 w-4 text-surface-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.open_jobs}</div>
                        <p className="text-xs text-surface-500">Processos seletivos em andamento</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Candidatos</CardTitle>
                        <TrendingUp className="h-4 w-4 text-surface-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.total_candidates}</div>
                        <p className="text-xs text-surface-500">Total no banco de talentos</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Headcount por Departamento</CardTitle>
                        <CardDescription>Distribuição de colaboradores por área.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.headcount_by_department}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#adfa1d" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Diversidade (Simulado)</CardTitle>
                        <CardDescription>Distribuição por gênero.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.diversity}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.diversity.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
