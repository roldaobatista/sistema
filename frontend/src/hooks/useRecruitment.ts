import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Candidate {
    id: string
    job_posting_id: string
    name: string
    email: string
    phone?: string
    resume_path?: string
    stage: 'applied' | 'screening' | 'interview' | 'technical_test' | 'offer' | 'hired' | 'rejected'
    notes?: string
    rating?: number
    rejected_reason?: string
    created_at: string
}

export interface JobPosting {
    id: string
    title: string
    department_id?: string
    position_id?: string
    description: string
    requirements?: string
    salary_range_min?: number
    salary_range_max?: number
    status: 'open' | 'closed' | 'on_hold'
    opened_at?: string
    closed_at?: string
    department?: { name: string }
    position?: { name: string }
    candidates?: Candidate[]
}

export function useRecruitment() {
    const queryClient = useQueryClient()

    const jobs = useQuery({
        queryKey: ['hr-jobs'],
        queryFn: async () => {
            const response = await api.get('/hr/job-postings')
            return response.data.data as JobPosting[]
        }
    })

    const createJob = useMutation({
        mutationFn: async (data: Partial<JobPosting>) => {
            const response = await api.post('/hr/job-postings', data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-jobs'] })
        }
    })

    const updateJob = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<JobPosting> }) => {
            const response = await api.put(`/hr/job-postings/${id}`, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-jobs'] })
        }
    })

    const deleteJob = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/hr/job-postings/${id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hr-jobs'] })
        }
    })

    return {
        jobs: jobs.data,
        isLoading: jobs.isLoading,
        createJob,
        updateJob,
        deleteJob
    }
}
