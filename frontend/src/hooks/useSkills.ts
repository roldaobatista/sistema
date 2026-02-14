import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Skill, UserSkill } from '@/types/hr'
import { toast } from 'sonner'

export function useSkills() {
    const qc = useQueryClient()

    const { data: skills, isLoading: loadingSkills } = useQuery<Skill[]>({
        queryKey: ['hr-skills'],
        queryFn: () => api.get('/hr/skills').then(r => r.data),
    })

    const { data: matrix, isLoading: loadingMatrix } = useQuery<any>({
        queryKey: ['hr-skills-matrix'],
        queryFn: () => api.get('/hr/skills-matrix').then(r => r.data),
    })

    const createSkill = useMutation({
        mutationFn: (data: Partial<Skill>) => api.post('/hr/skills', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-skills'] })
            toast.success('Competência criada')
        },
        onError: () => toast.error('Erro ao criar competência'),
    })

    const updateSkill = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Skill> }) =>
            api.put(`/hr/skills/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-skills'] })
            toast.success('Competência atualizada')
        },
        onError: () => toast.error('Erro ao atualizar competência'),
    })

    const deleteSkill = useMutation({
        mutationFn: (id: number) => api.delete(`/hr/skills/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-skills'] })
            toast.success('Competência removida')
        },
        onError: () => toast.error('Erro ao remover competência'),
    })

    const assessUser = useMutation({
        mutationFn: ({ userId, skills }: { userId: number; skills: { skill_id: number; level: number }[] }) =>
            api.post(`/hr/skills/assess/${userId}`, { skills }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hr-skills-matrix'] })
            toast.success('Avaliação registrada')
        },
        onError: () => toast.error('Erro ao registrar avaliação'),
    })

    return {
        skills,
        loadingSkills,
        matrix,
        loadingMatrix,
        createSkill,
        updateSkill,
        deleteSkill,
        assessUser,
    }
}
