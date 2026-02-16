import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/pageheader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, ClipboardCheck, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';

const statusColors: Record<string, string> = {
  planned: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
};

const statusLabels: Record<string, string> = {
  planned: 'Planejada',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export default function QualityAuditsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'internal', scope: '', planned_date: '', auditor_id: '' });

  const { data: audits, isLoading, isError } = useQuery({
    queryKey: ['quality-audits'],
    queryFn: () => api.get('/quality-audits').then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/quality-audits', data).then(r => r.data),
    onSuccess: () => { toast.success('Auditoria criada'); setShowForm(false); qc.invalidateQueries({ queryKey: ['quality-audits'] }); },
    onError: () => toast.error('Erro ao criar auditoria'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Auditorias Internas ISO" subtitle="Cronograma e registro de auditorias do sistema de gestão da qualidade">
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nova Auditoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Auditoria</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Auditoria Interna ISO 17025 — Q1/2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="internal">Interna</option>
                    <option value="external">Externa</option>
                    <option value="supplier">Fornecedor</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Data Planejada</label>
                  <Input type="date" value={form.planned_date} onChange={e => setForm(p => ({ ...p, planned_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Escopo</label>
                <Input value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} placeholder="Ex: Processos de calibração — Seção 7.6 da ISO 17025" />
              </div>
              <div>
                <label className="text-sm font-medium">ID do Auditor</label>
                <Input type="number" value={form.auditor_id} onChange={e => setForm(p => ({ ...p, auditor_id: e.target.value }))} placeholder="ID do usuário auditor" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>
                  {createMut.isPending ? 'Criando...' : 'Criar Auditoria'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p className="text-muted-foreground">Carregando...</p> : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
              <p className="text-sm font-medium text-red-600">Erro ao carregar auditorias</p>
              <p className="text-xs text-muted-foreground mt-1">Tente novamente mais tarde</p>
            </div>
          ) : !audits?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma auditoria cadastrada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Nova Auditoria" para criar a primeira</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">Número</th>
                    <th className="p-3">Título</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Auditor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">NC</th>
                    <th className="p-3">Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {audits?.data?.map((audit: any) => (
                    <tr key={audit.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-mono">{audit.audit_number}</td>
                      <td className="p-3 font-medium">{audit.title}</td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {audit.type === 'internal' ? 'Interna' : audit.type === 'external' ? 'Externa' : 'Fornecedor'}
                        </Badge>
                      </td>
                      <td className="p-3">{new Date(audit.planned_date).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">{audit.auditor?.name ?? '—'}</td>
                      <td className="p-3"><Badge variant={statusColors[audit.status] as any}>{statusLabels[audit.status]}</Badge></td>
                      <td className="p-3">
                        {audit.non_conformities_found > 0 ? (
                          <span className="flex items-center gap-1 text-red-600"><XCircle className="h-4 w-4" /> {audit.non_conformities_found}</span>
                        ) : <span className="text-green-600"><CheckCircle className="h-4 w-4" /></span>}
                      </td>
                      <td className="p-3">{audit.observations_found || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
