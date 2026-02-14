import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Department, Position } from '@/types/hr'
import { toast } from 'sonner'

export function useOrganization() {
    const qc = useQueryClient()

    // Departments
    const { data: departments, isLoading: loadingDepts } = useQuery<Department[]>({
        queryKey: ['hr-departments'],
        queryFn: () => api.get('/hr/departments').then(r => r.data),
    })

    const { data: orgChart, isLoading: loadingChart } = useQuery<Department[]>({
        queryKey: ['hr-org-chart'],
        queryFn: () => api.get('/hr/org-chart').then(r => r.data),
    })

    const createDept = useMutation({
        mutationFn: (data: Partial<Department>) => api.post('/hr/departments', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-departments'] })
            qc.invalidateQueries({ queryKey: ['hr-org-chart'] })
            toast.success('Departamento criado com sucesso')
        },
        onError: () => toast.error('Erro ao criar departamento'),
    })

    const updateDept = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Department> }) =>
            api.put(`/hr/departments/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-departments'] })
            qc.invalidateQueries({ queryKey: ['hr-org-chart'] })
            toast.success('Departamento atualizado')
        },
        onError: () => toast.error('Erro ao atualizar departamento'),
    })

    const deleteDept = useMutation({
        mutationFn: (id: number) => api.delete(`/hr/departments/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-departments'] })
            qc.invalidateQueries({ queryKey: ['hr-org-chart'] })
            toast.success('Departamento removido')
        },
        onError: () => toast.error('Erro ao remover departamento'),
    })

    // Positions
    const { data: positions, isLoading: loadingPositions } = useQuery<Position[]>({
        queryKey: ['hr-positions'],
        queryFn: () => api.get('/hr/positions').then(r => r.data),
    })

    const createPosition = useMutation({
        mutationFn: (data: Partial<Position>) => api.post('/hr/positions', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-positions'] })
            toast.success('Cargo criado com sucesso')
        },
        onError: () => toast.error('Erro ao criar cargo'),
    })

    const updatePosition = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Position> }) =>
            api.put(`/hr/positions/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-positions'] })
            toast.success('Cargo atualizado')
        },
        onError: () => toast.error('Erro ao atualizar cargo'),
    })

    const deletePosition = useMutation({
        mutationFn: (id: number) => api.delete(`/hr/positions/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-positions'] })
            toast.success('Cargo removido')
        },
        onError: () => toast.error('Erro ao remover cargo'),
    })

    return {
        departments,
        orgChart,
        loadingDepts,
        loadingChart,
        createDept,
        updateDept,
        deleteDept,

        positions,
        loadingPositions,
        createPosition,
        updatePosition,
        deletePosition,
    }
}
