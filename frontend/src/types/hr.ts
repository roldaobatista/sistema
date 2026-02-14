export interface Department {
    id: number
    name: string
    manager_id?: number
    parent_id?: number
    cost_center?: string
    manager?: { id: number; name: string; avatar?: string }
    parent?: Department
    children?: Department[]
    _count?: { users: number }
}

export interface Position {
    id: number
    name: string
    department_id: number
    level: 'junior' | 'pleno' | 'senior' | 'lead' | 'manager' | 'specialist'
    description?: string
    department?: Department
    _count?: { users: number }
}

export interface Skill {
    id: number
    name: string
    category: string
    description?: string
}

export interface UserSkill {
    id: number
    user_id: number
    skill_id: number
    current_level: number // 1-5
    assessed_at?: string
    skill?: Skill
    user?: { id: number; name: string; avatar?: string }
}

export interface PerformanceReview {
    id: number
    title: string
    user_id: number
    reviewer_id: number
    cycle: string
    status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'canceled'
    deadline?: string
    completed_at?: string
    overall_rating?: number
    user?: { id: number; name: string; avatar?: string; position?: { name: string } }
    reviewer?: { id: number; name: string; avatar?: string }
    type: '180' | '360' | 'leader' | 'peer'
    nine_box_potential?: 'low' | 'medium' | 'high'
    nine_box_performance?: 'low' | 'medium' | 'high'
    created_at?: string
    ratings?: Record<string, number>
    feedback_text?: string
    action_plan?: string
    overall_score?: number
    potential_score?: number
    score?: number
}

export interface ContinuousFeedback {
    id: number
    from_user_id: number
    to_user_id: number
    message: string
    type: 'praise' | 'guidance' | 'correction'
    visibility: 'public' | 'private' | 'manager_only'
    created_at: string
    from_user?: { id: number; name: string; avatar?: string }
    to_user?: { id: number; name: string; avatar?: string }
}
