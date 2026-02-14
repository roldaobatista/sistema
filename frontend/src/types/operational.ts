export interface Technician {
    id: number
    name: string
    avatar?: string
}

export interface Customer {
    id?: number
    name: string
    latitude?: number | null
    longitude?: number | null
}

export interface WorkOrder {
    id: number
    number: string
    business_number?: string | null
    os_number?: string | null
    status?: string
    customer?: { name: string }
}

export interface ScheduleItem {
    id: number | string
    source: 'schedule' | 'crm' | 'service_call'
    title: string
    start: string
    end: string
    status: string
    technician: Technician
    customer: Customer | null
    work_order: WorkOrder | null
    notes: string | null
    address: string | null
    crm_type?: string
}
