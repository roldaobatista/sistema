import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/pageheader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Check, X, HandCoins } from 'lucide-react';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'warning' },
  approved: { label: 'Aprovada', color: 'success' },
  rejected: { label: 'Rejeitada', color: 'destructive' },
  completed: { label: 'Concluída', color: 'secondary' },
};

export default function DebtRenegotiationPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_id: '', receivable_ids: '' as string, negotiated_total: '',
    discount_amount: '0', interest_amount: '0', fine_amount: '0',
    new_installments: '1', first_due_date: '', notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['renegotiations'],
    queryFn: () => api.get('/renegotiations').then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/renegotiations', {
      ...d,
      receivable_ids: d.receivable_ids.split(',').map((s: string) => parseInt(s.trim())).filter(Boolean),
      negotiated_total: parseFloat(d.negotiated_total),
      discount_amount: parseFloat(d.discount_amount) || 0,
      interest_amount: parseFloat(d.interest_amount) || 0,
      fine_amount: parseFloat(d.fine_amount) || 0,
      new_installments: parseInt(d.new_installments),
      customer_id: parseInt(d.customer_id),
    }),
    onSuccess: () => { toast.success('Renegociação criada'); setShowForm(false); qc.invalidateQueries({ queryKey: ['renegotiations'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar'),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => api.post(`/renegotiations/${id}/approve`),
    onSuccess: () => { toast.success('Renegociação aprovada! Novas parcelas geradas.'); qc.invalidateQueries({ queryKey: ['renegotiations'] }); },
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => api.post(`/renegotiations/${id}/reject`),
    onSuccess: () => { toast.info('Renegociação rejeitada.'); qc.invalidateQueries({ queryKey: ['renegotiations'] }); },
  });

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6">
      <PageHeader title="Renegociação de Dívidas" subtitle="Gerencie renegociações de parcelas em atraso">
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova Renegociação</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Renegociação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">ID do Cliente</label>
                  <Input type="number" value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">IDs das Parcelas (vírgula)</label>
                  <Input value={form.receivable_ids} onChange={e => setForm(p => ({ ...p, receivable_ids: e.target.value }))} placeholder="1,2,3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Valor Negociado (R$)</label>
                  <Input type="number" step="0.01" value={form.negotiated_total} onChange={e => setForm(p => ({ ...p, negotiated_total: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Nº de Parcelas</label>
                  <Input type="number" min="1" value={form.new_installments} onChange={e => setForm(p => ({ ...p, new_installments: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Desconto</label>
                  <Input type="number" step="0.01" value={form.discount_amount} onChange={e => setForm(p => ({ ...p, discount_amount: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Juros</label>
                  <Input type="number" step="0.01" value={form.interest_amount} onChange={e => setForm(p => ({ ...p, interest_amount: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Multa</label>
                  <Input type="number" step="0.01" value={form.fine_amount} onChange={e => setForm(p => ({ ...p, fine_amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">1º Vencimento</label>
                <Input type="date" value={form.first_due_date} onChange={e => setForm(p => ({ ...p, first_due_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Observações</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Criar Renegociação</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p className="text-muted-foreground">Carregando...</p> : !data?.data?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <HandCoins className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma renegociação registrada.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">#</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Valor Original</th>
                  <th className="p-3">Valor Negociado</th>
                  <th className="p-3">Parcelas</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Criado em</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r: any) => {
                  const st = statusLabels[r.status] || statusLabels.pending;
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">{r.id}</td>
                      <td className="p-3 font-medium">{r.customer?.name ?? '—'}</td>
                      <td className="p-3">{fmt(r.original_total)}</td>
                      <td className="p-3 font-medium">{fmt(r.negotiated_total)}</td>
                      <td className="p-3">{r.new_installments}x</td>
                      <td className="p-3"><Badge variant={st.color as any}>{st.label}</Badge></td>
                      <td className="p-3">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        {r.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => approveMut.mutate(r.id)}>
                              <Check className="h-3 w-3 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => rejectMut.mutate(r.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
