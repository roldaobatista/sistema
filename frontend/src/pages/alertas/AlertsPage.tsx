import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/pageheader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { Bell, Check, Eye, X, RefreshCw, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const severityConfig: Record<string, { label: string; color: string; icon: any }> = {
  critical: { label: 'Crítico', color: 'destructive', icon: AlertCircle },
  high: { label: 'Alto', color: 'warning', icon: AlertTriangle },
  medium: { label: 'Médio', color: 'secondary', icon: Info },
  low: { label: 'Baixo', color: 'outline', icon: Info },
};

const typeLabels: Record<string, string> = {
  unbilled_wo: 'OS sem faturamento',
  expiring_contract: 'Contrato vencendo',
  expiring_calibration: 'Calibração vencendo',
  weight_cert_expiring: 'Peso padrão vencendo',
  quote_expiring: 'Orçamento vencendo',
  overdue_receivable: 'Conta em atraso',
  tool_cal_expiring: 'Ferramenta sem calibração',
  expense_pending: 'Despesa pendente',
  sla_breach: 'SLA estourado',
  low_stock: 'Estoque baixo',
};

export default function AlertsPage() {
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['alert-summary'],
    queryFn: () => api.get('/alerts/summary').then(r => r.data),
  });

  const { data: alerts, isLoading, isError } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get('/alerts', { params: { status: 'active', per_page: 50 } }).then(r => r.data),
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: number) => api.post(`/alerts/${id}/acknowledge`),
    onSuccess: () => { toast.success('Alerta reconhecido'); qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['alert-summary'] }); },
  });

  const resolveMut = useMutation({
    mutationFn: (id: number) => api.post(`/alerts/${id}/resolve`),
    onSuccess: () => { toast.success('Alerta resolvido'); qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['alert-summary'] }); },
  });

  const dismissMut = useMutation({
    mutationFn: (id: number) => api.post(`/alerts/${id}/dismiss`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['alert-summary'] }); },
  });

  const runEngineMut = useMutation({
    mutationFn: () => api.post('/alerts/run-engine'),
    onSuccess: (res) => {
      const total = Object.values(res.data.results as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
      toast.success(`Verificação concluída: ${total} novos alertas`);
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alert-summary'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Central de Alertas" subtitle="Monitoramento automático de eventos críticos do sistema" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100"><AlertCircle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold">{summary?.critical ?? 0}</p>
                <p className="text-sm text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
              <div>
                <p className="text-2xl font-bold">{summary?.high ?? 0}</p>
                <p className="text-sm text-muted-foreground">Prioridade Alta</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Bell className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{summary?.total_active ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-center">
            <Button onClick={() => runEngineMut.mutate()} disabled={runEngineMut.isPending} className="w-full">
              <RefreshCw className={`h-4 w-4 mr-2 ${runEngineMut.isPending ? 'animate-spin' : ''}`} />
              {runEngineMut.isPending ? 'Verificando...' : 'Executar Verificação'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : isError ? (
            <div className="text-center py-12 text-red-500">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-red-600">Erro ao carregar alertas</p>
              <p className="text-xs text-muted-foreground mt-1">Tente novamente mais tarde</p>
            </div>
          ) : !alerts?.data?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum alerta ativo. Sistema operando normalmente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.data.map((alert: any) => {
                const sev = severityConfig[alert.severity] || severityConfig.medium;
                const Icon = sev.icon;
                return (
                  <div key={alert.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="mt-0.5">
                      <Icon className={`h-5 w-5 ${alert.severity === 'critical' ? 'text-red-600' : alert.severity === 'high' ? 'text-yellow-600' : 'text-blue-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{alert.title}</span>
                        <Badge variant={sev.color as any}>{sev.label}</Badge>
                        <Badge variant="outline">{typeLabels[alert.alert_type] || alert.alert_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" title="Reconhecer" onClick={() => acknowledgeMut.mutate(alert.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Resolver" onClick={() => resolveMut.mutate(alert.id)}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Descartar" onClick={() => dismissMut.mutate(alert.id)}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
