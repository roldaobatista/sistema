export interface Camera {
    id: number;
    name: string;
    stream_url: string;
    location?: string;
    type?: string;
    is_active: boolean;
    position: number;
    tenant_id?: number;
}

export interface Technician {
    id: number;
    name: string;
    status: 'working' | 'in_transit' | 'available' | 'offline';
    location_lat?: number;
    location_lng?: number;
    location_updated_at?: string;
    avatar_url?: string;
}

export interface TvCustomer {
    id: number;
    name: string;
    latitude?: number;
    longitude?: number;
}

export interface TvWorkOrderTechnician {
    id: number;
    name: string;
}

export interface TvWorkOrder {
    id: number;
    os_number?: string;
    status: string;
    started_at?: string;
    completed_at?: string;
    updated_at: string;
    customer?: TvCustomer;
    /** Backend may return assignee (relationship name) or technician (event payload) */
    technician?: TvWorkOrderTechnician;
    assignee?: TvWorkOrderTechnician;
    serviceCall?: { id: number; subject: string };
}

export interface TvServiceCall {
    id: number;
    status: string;
    priority?: string;
    subject?: string;
    created_at: string;
    customer?: TvCustomer;
    technician?: { id: number; name: string };
}

export interface TvKpis {
    chamados_hoje: number;
    chamados_ontem: number;
    os_hoje: number;
    os_ontem: number;
    os_em_execucao: number;
    os_finalizadas: number;
    os_finalizadas_ontem: number;
    tecnicos_online: number;
    tecnicos_em_campo: number;
    tecnicos_total: number;
    tempo_medio_resposta_min: number | null;
    tempo_medio_execucao_min: number | null;
}

export interface TvAlert {
    type: 'technician_offline' | 'unattended_call' | 'long_running_os' | 'camera_offline';
    severity: 'warning' | 'critical';
    message: string;
    entity_id: number;
    created_at: string;
}

export interface TvDashboardData {
    tenant_id: number;
    cameras: Camera[];
    operational: {
        technicians: Technician[];
        service_calls: TvServiceCall[];
        work_orders: TvWorkOrder[];
        latest_work_orders: TvWorkOrder[];
        kpis: TvKpis;
    };
}

export type TvLayout = '3x2' | '2x2' | '1+list' | 'map-full';

export interface TvSettings {
    layout: TvLayout;
    autoRotateCameras: boolean;
    rotationInterval: number;
    soundAlerts: boolean;
    showAlertPanel: boolean;
}
