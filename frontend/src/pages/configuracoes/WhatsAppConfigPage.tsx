import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/pageheader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { MessageCircle, Send, CheckCircle, Settings } from 'lucide-react';

export default function WhatsAppConfigPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ provider: 'evolution', api_url: '', api_key: '', instance_name: '', phone_number: '' });
  const [testPhone, setTestPhone] = useState('');

  const { data: config } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: () => api.get('/whatsapp/config').then(r => r.data),
  });

  useEffect(() => {
    if (config) {
      setForm({
        provider: config.provider || 'evolution',
        api_url: config.api_url || '',
        api_key: '', // nunca exibir chave existente
        instance_name: config.instance_name || '',
        phone_number: config.phone_number || '',
      });
    }
  }, [config]);

  const saveMut = useMutation({
    mutationFn: (data: any) => api.post('/whatsapp/config', data),
    onSuccess: () => { toast.success('Configuração salva'); qc.invalidateQueries({ queryKey: ['whatsapp-config'] }); },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  const testMut = useMutation({
    mutationFn: (phone: string) => api.post('/whatsapp/test', { phone }).then(r => r.data),
    onSuccess: (data) => data.success ? toast.success('Mensagem de teste enviada!') : toast.error('Falha no envio'),
    onError: () => toast.error('Erro ao enviar teste'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Integração WhatsApp" subtitle="Configure a API do WhatsApp para envio de notificações e mensagens" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Configuração da API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Provedor</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))}>
                <option value="evolution">Evolution API (self-hosted)</option>
                <option value="z-api">Z-API (SaaS)</option>
                <option value="meta">Meta Cloud API (oficial)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">URL da API</label>
              <Input value={form.api_url} onChange={e => setForm(p => ({ ...p, api_url: e.target.value }))}
                placeholder={form.provider === 'evolution' ? 'https://sua-evolution.com' : form.provider === 'z-api' ? 'https://api.z-api.io/instances/...' : 'https://graph.facebook.com/v18.0/PHONE_ID'} />
            </div>
            <div>
              <label className="text-sm font-medium">Chave da API</label>
              <Input type="password" value={form.api_key} onChange={e => setForm(p => ({ ...p, api_key: e.target.value }))}
                placeholder={config ? '••••••• (já configurada)' : 'Cole sua chave aqui'} />
            </div>
            {form.provider === 'evolution' && (
              <div>
                <label className="text-sm font-medium">Nome da Instância</label>
                <Input value={form.instance_name} onChange={e => setForm(p => ({ ...p, instance_name: e.target.value }))} placeholder="kalibrium" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Número do WhatsApp</label>
              <Input value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} placeholder="5566999999999" />
            </div>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending} className="w-full">
              {saveMut.isPending ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Teste de Conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {config ? (
              <>
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Configurado</p>
                    <p className="text-sm text-green-700">Provedor: {config.provider} | Ativo: {config.is_active ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Número para teste</label>
                  <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="5566999999999" />
                </div>
                <Button onClick={() => testMut.mutate(testPhone)} disabled={testMut.isPending || !testPhone} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  {testMut.isPending ? 'Enviando...' : 'Enviar Mensagem de Teste'}
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Configure a API ao lado para habilitar o teste.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
