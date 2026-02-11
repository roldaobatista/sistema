import { QUOTE_STATUS } from '@/lib/constants';
import { FileText, Send, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';

export const QUOTE_STATUS_CONFIG: Record<string, { label: string; variant: any; icon: any }> = {
    [QUOTE_STATUS.DRAFT]: { label: 'Rascunho', variant: 'default', icon: FileText },
    [QUOTE_STATUS.SENT]: { label: 'Enviado', variant: 'info', icon: Send },
    [QUOTE_STATUS.APPROVED]: { label: 'Aprovado', variant: 'success', icon: CheckCircle },
    [QUOTE_STATUS.REJECTED]: { label: 'Rejeitado', variant: 'danger', icon: XCircle },
    [QUOTE_STATUS.EXPIRED]: { label: 'Expirado', variant: 'warning', icon: Clock },
    [QUOTE_STATUS.INVOICED]: { label: 'Faturado', variant: 'info', icon: DollarSign },
};
