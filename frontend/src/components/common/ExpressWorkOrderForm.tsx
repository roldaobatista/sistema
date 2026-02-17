import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { Rocket, Loader2 } from 'lucide-react';

interface ExpressWorkOrderFormProps {
    onSuccess?: (data: any) => void;
}

export const ExpressWorkOrderForm: React.FC<ExpressWorkOrderFormProps> = ({ onSuccess }) => {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        customer_name: '',
        description: '',
        priority: 'medium',
        service_id: '',
    });

    const mutation = useMutation({
        mutationFn: (data: any) => api.post('/operational/work-orders/express', data),
        onSuccess: (response) => {
            toast.success('OS Express criada com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['work-orders'] });
            onSuccess?.(response.data.data);
            setFormData({ customer_name: '', description: '', priority: 'medium', service_id: '' });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao criar OS Express');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-surface-0 rounded-xl border border-surface-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
                    <Rocket size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-surface-900">OS Express</h3>
                    <p className="text-xs text-surface-500">Criação rápida de serviço em campo</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="customer_name">Cliente</Label>
                    <Input
                        id="customer_name"
                        placeholder="Nome do cliente ou empresa"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">O que será feito?</Label>
                    <Textarea
                        id="description"
                        placeholder="Descreva brevemente o serviço..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                        className="min-h-[80px]"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <Select
                            value={formData.priority}
                            onValueChange={(val) => setFormData({ ...formData, priority: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Prioridade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Baixa</SelectItem>
                                <SelectItem value="medium">Média</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="critical">Crítica</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-end">
                        <Button
                            type="submit"
                            className="w-full gap-2"
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
                            Criar Agora
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
};
