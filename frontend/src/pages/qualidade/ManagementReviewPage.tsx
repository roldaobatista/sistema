import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/pageheader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Calendar, Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function ManagementReviewPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [form, setForm] = useState({
    meeting_date: '',
    title: '',
    participants: '',
    agenda: '',
    decisions: '',
    summary: '',
  });
  const [actionForm, setActionForm] = useState({ description: '', responsible_id: '', due_date: '' });

  const { data: usersRes } = useQuery({
    queryKey: ['users-mgmt'],
    queryFn: () => api.get('/users', { params: { per_page: 200 } }),
  });
  const users = usersRes?.data?.data ?? [];

  const { data: reviewsData, isLoading, isError } = useQuery({
    queryKey: ['management-reviews'],
    queryFn: () => api.get('/management-reviews').then(r => r.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['management-reviews-dashboard'],
    queryFn: () => api.get('/management-reviews/dashboard').then(r => r.data?.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['management-review-detail', detailId],
    queryFn: () => api.get(`/management-reviews/${detailId}`).then(r => r.data?.data),
    enabled: !!detailId,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/management-reviews', d),
    onSuccess: () => { toast.success('Revisão registrada'); setShowForm(false); setForm({ meeting_date: '', title: '', participants: '', agenda: '', decisions: '', summary: '' }); qc.invalidateQueries({ queryKey: ['management-reviews'] }); qc.invalidateQueries({ queryKey: ['management-reviews-dashboard'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao criar'),
  });

  const addActionMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/management-reviews/${id}/actions`, data),
    onSuccess: () => { setActionForm({ description: '', responsible_id: '', due_date: '' }); qc.invalidateQueries({ queryKey: ['management-review-detail', detailId] }); qc.invalidateQueries({ queryKey: ['management-reviews-dashboard'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao adicionar ação'),
  });

  const updateActionMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/management-reviews/actions/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['management-review-detail', detailId] }); qc.invalidateQueries({ queryKey: ['management-reviews-dashboard'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao atualizar'),
  });

  const reviews = reviewsData?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Revisão pela direção" subtitle="Registro de reuniões de análise crítica e ações decorrentes">
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nova Revisão</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Revisão pela Direção</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data da reunião *</label>
                  <Input type="date" value={form.meeting_date} onChange={e => setForm(p => ({ ...p, meeting_date: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Título *</label>
                  <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Revisão Q1/2026" className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Participantes</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm mt-1 min-h-[60px]" value={form.participants} onChange={e => setForm(p => ({ ...p, participants: e.target.value }))} placeholder="Nomes ou cargos" />
              </div>
              <div>
                <label className="text-sm font-medium">Pauta</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm mt-1 min-h-[80px]" value={form.agenda} onChange={e => setForm(p => ({ ...p, agenda: e.target.value }))} placeholder="Itens da pauta" />
              </div>
              <div>
                <label className="text-sm font-medium">Decisões</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm mt-1 min-h-[80px]" value={form.decisions} onChange={e => setForm(p => ({ ...p, decisions: e.target.value }))} placeholder="Decisões tomadas" />
              </div>
              <div>
                <label className="text-sm font-medium">Resumo</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm mt-1 min-h-[60px]" value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.meeting_date || !form.title}>
                  {createMut.isPending ? 'Salvando...' : 'Registrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {dashboard && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2"><Clock className="h-6 w-6 text-amber-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-surface-900">{dashboard.pending_actions}</p>
                  <p className="text-xs text-muted-foreground">Ações pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p className="text-muted-foreground">Carregando...</p> : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
              <p className="text-sm font-medium text-red-600">Erro ao carregar</p>
            </div>
          ) : !reviews.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma revisão registrada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Nova Revisão" para registrar a primeira</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">Data</th>
                    <th className="p-3">Título</th>
                    <th className="p-3">Participantes</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">{new Date(r.meeting_date).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 font-medium">{r.title}</td>
                      <td className="p-3 max-w-[200px] truncate text-muted-foreground">{r.participants || '—'}</td>
                      <td className="p-3">
                        <Button size="sm" variant="outline" onClick={() => setDetailId(r.id)}>Ver detalhe</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhe da Revisão</DialogTitle></DialogHeader>
          {!detail ? <p className="text-muted-foreground">Carregando...</p> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Data:</span> {new Date(detail.meeting_date).toLocaleDateString('pt-BR')}</div>
                <div><span className="text-muted-foreground">Título:</span> {detail.title}</div>
              </div>
              {detail.participants && <div><span className="text-muted-foreground text-sm">Participantes:</span><p className="text-sm mt-0.5 whitespace-pre-wrap">{detail.participants}</p></div>}
              {detail.agenda && <div><span className="text-muted-foreground text-sm">Pauta:</span><p className="text-sm mt-0.5 whitespace-pre-wrap">{detail.agenda}</p></div>}
              {detail.decisions && <div><span className="text-muted-foreground text-sm">Decisões:</span><p className="text-sm mt-0.5 whitespace-pre-wrap">{detail.decisions}</p></div>}
              {detail.summary && <div><span className="text-muted-foreground text-sm">Resumo:</span><p className="text-sm mt-0.5 whitespace-pre-wrap">{detail.summary}</p></div>}
              <div>
                <h4 className="text-sm font-semibold mb-2">Ações</h4>
                <div className="space-y-2 mb-4">
                  {detail.actions?.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 border rounded p-2 bg-muted/30">
                      <span className="text-sm flex-1">{a.description}</span>
                      <div className="flex items-center gap-2">
                        {a.responsible && <Badge variant="outline">{a.responsible.name}</Badge>}
                        {a.due_date && <span className="text-xs text-muted-foreground">{new Date(a.due_date).toLocaleDateString('pt-BR')}</span>}
                        <select className="border rounded px-2 py-0.5 text-xs" value={a.status} onChange={e => updateActionMut.mutate({ id: a.id, data: { status: e.target.value } })}>
                          <option value="pending">Pendente</option>
                          <option value="in_progress">Em andamento</option>
                          <option value="completed">Concluída</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Input className="flex-1 min-w-[180px]" placeholder="Nova ação" value={actionForm.description} onChange={e => setActionForm(p => ({ ...p, description: e.target.value }))} />
                  <select className="border rounded px-2 py-2 text-sm w-[140px]" value={actionForm.responsible_id} onChange={e => setActionForm(p => ({ ...p, responsible_id: e.target.value }))}>
                    <option value="">Responsável</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <Input type="date" className="w-[130px]" value={actionForm.due_date} onChange={e => setActionForm(p => ({ ...p, due_date: e.target.value }))} />
                  <Button size="sm" onClick={() => detailId && actionForm.description && addActionMut.mutate({ id: detailId, data: { description: actionForm.description, responsible_id: actionForm.responsible_id || undefined, due_date: actionForm.due_date || undefined } })} disabled={!actionForm.description || addActionMut.isPending}>Adicionar</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
