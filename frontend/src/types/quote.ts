export interface QuoteItem {
    id: number;
    tenant_id: number;
    quote_equipment_id: number;
    type: 'product' | 'service';
    product_id: number | null;
    service_id: number | null;
    custom_description: string | null;
    quantity: number;
    original_price: number;
    unit_price: number;
    discount_percentage: number;
    subtotal: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
    // Relations
    product?: { id: number; name: string };
    service?: { id: number; name: string };
}

export interface QuoteEquipment {
    id: number;
    tenant_id: number;
    quote_id: number;
    equipment_id: number | null;
    description: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
    // Relations
    equipment?: { id: number; name?: string; model?: string; brand?: string; serial_number?: string; tag?: string };
    items?: QuoteItem[];
    photos?: QuotePhoto[];
}

export interface QuotePhoto {
    id: number;
    tenant_id: number;
    quote_equipment_id: number | null;
    quote_item_id: number | null;
    path: string;
    caption: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface Quote {
    id: number;
    tenant_id: number;
    quote_number: string;
    revision: number;
    customer_id: number;
    seller_id: number;
    status: 'draft' | 'pending_internal_approval' | 'internally_approved' | 'sent' | 'approved' | 'rejected' | 'expired' | 'invoiced';
    source: 'prospeccao' | 'retorno' | 'contato_direto' | 'indicacao' | null;
    valid_until: string | null;
    discount_percentage: number;
    discount_amount: number;
    displacement_value: number;
    subtotal: number;
    total: number;
    observations: string | null;
    internal_notes: string | null;
    sent_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    rejection_reason: string | null;
    approval_url?: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    // Relations
    customer?: { id: number; name: string; document?: string; email?: string; phone?: string; contacts?: any[] };
    seller?: { id: number; name: string };
    equipments?: QuoteEquipment[];
}

export interface QuoteSummary {
    draft: number;
    pending_internal_approval: number;
    internally_approved: number;
    sent: number;
    approved: number;
    rejected: number;
    expired: number;
    invoiced: number;
    total_month: number;
    conversion_rate: number;
}
