import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync';
import { PageHeader } from '@/components/ui/pageheader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, FileText, Check, Clock, Archive, AlertTriangle, Download, Upload } from 'lucide-react';

const categoryLabels: Record<string, string> = {
  procedure: 'Procedimento', instruction: 'Instrução de Trabalho', form: 'Formulário',
  record: 'Registro', policy: 'Política', manual: 'Manual',
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'secondary', icon: Clock },
  review: { label: 'Em Revisão', color: 'warning', icon: Clock },
  approved: { label: 'Aprovado', color: 'success', icon: Check },
  obsolete: { label: 'Obsoleto', color: 'destructive', icon: Archive },
};

export default function IsoDocumentsPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentOnly, setCurrentOnly] = useState(false);
  const [form, setForm] = useState({ document_code: '', title: '', category: 'procedure', version: '1.0', description: '', effective_date: '', review_date: '' });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['iso-documents', currentOnly],
    queryFn: () => api.get('/iso-documents', { params: { current_only: currentOnly ? 1 : undefined } }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/iso-documents', d),
    onSuccess: () => { toast.success('Documento criado'); setShowForm(false); qc.invalidateQueries({ queryKey: ['iso-documents'] }); broadcastQueryInvalidation(['iso-documents'], 'Documentos ISO'); },
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => api.post(`/iso-documents/${id}/approve`),
    onSuccess: () => { toast.success('Documento aprovado'); qc.invalidateQueries({ queryKey: ['iso-documents'] }); broadcastQueryInvalidation(['iso-documents'], 'Documentos ISO'); },
  });

  const uploadMut = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/iso-documents/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { toast.success('Arquivo anexado'); qc.invalidateQueries({ queryKey: ['iso-documents'] }); broadcastQueryInvalidation(['iso-documents'], 'Documentos ISO'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao anexar'),
  });

  const handleDownload = (doc: any) => {
    api.get(`/iso-documents/${doc.id}/download`, { responseType: 'blob' }).then((r) => {
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = (doc.file_path ? doc.file_path.split('/').pop() : doc.title) || 'documento';
      a.click();
      window.URL.revokeObjectURL(url);
    }).catch(() => toast.error('Erro ao baixar'));
  };

  const triggerUpload = (id: number) => {
    fileInputRef.current?.setAttribute('data-doc-id', String(id));
    fileInputRef.current?.click();
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.getAttribute('data-doc-id');
    const file = e.target.files?.[0];
    if (id && file) uploadMut.mutate({ id: Number(id), file });
    e.target.value = '';
    e.target.removeAttribute('data-doc-id');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Documentos da Qualidade" subtitle="Controle de documentos do sistema de gestão da qualidade">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={currentOnly} onChange={e => setCurrentOnly(e.target.checked)} className="rounded" />
            Apenas versão vigente
          </label>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo Documento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Código</label>
                  <Input value={form.document_code} onChange={e => setForm(p => ({ ...p, document_code: e.target.value }))} placeholder="Ex: PQ-001" />
                </div>
                <div>
                  <label className="text-sm font-medium">Versão</label>
                  <Input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="1.0" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Procedimento de Calibração de Balanças" />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm min-h-[80px]" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Vigência</label>
                  <Input type="date" value={form.effective_date} onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Próxima Revisão</label>
                  <Input type="date" value={form.review_date} onChange={e => setForm(p => ({ ...p, review_date: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Criar</Button>
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
              <p className="text-sm font-medium text-red-600">Erro ao carregar documentos</p>
              <p className="text-xs text-muted-foreground mt-1">Tente novamente mais tarde</p>
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum documento cadastrado</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Novo Documento" para criar o primeiro</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Código</th>
                  <th className="p-3">Título</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Versão</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Revisão</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((doc: any) => {
                  const st = statusConfig[doc.status] || statusConfig.draft;
                  return (
                    <tr key={doc.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-mono font-medium">{doc.document_code}</td>
                      <td className="p-3">{doc.title}</td>
                      <td className="p-3"><Badge variant="outline">{categoryLabels[doc.category] || doc.category}</Badge></td>
                      <td className="p-3">{doc.version}</td>
                      <td className="p-3"><Badge variant={st.color as any}>{st.label}</Badge></td>
                      <td className="p-3">{doc.review_date ? new Date(doc.review_date).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {doc.file_path && (
                            <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Baixar">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => triggerUpload(doc.id)} title="Anexar arquivo" disabled={uploadMut.isPending}>
                            <Upload className="h-4 w-4" />
                          </Button>
                          {doc.status === 'draft' && (
                            <Button size="sm" variant="outline" onClick={() => approveMut.mutate(doc.id)}>
                              <Check className="h-3 w-3 mr-1" /> Aprovar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.odt" onChange={onFileChange} />
    </div>
  );
}
