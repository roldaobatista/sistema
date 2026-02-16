import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/pageheader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Save, FileCheck } from 'lucide-react';

interface Reading {
  reference_value: string;
  indication_increasing: string;
  indication_decreasing: string;
  k_factor: string;
  repetition: number;
  unit: string;
}

export default function CalibrationReadingsPage() {
  const { calibrationId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [readings, setReadings] = useState<Reading[]>([
    { reference_value: '', indication_increasing: '', indication_decreasing: '', k_factor: '2.00', repetition: 1, unit: 'kg' },
  ]);

  const { data: existingReadings } = useQuery({
    queryKey: ['calibration-readings', calibrationId],
    queryFn: () => api.get(`/calibration/${calibrationId}/readings`).then(r => r.data),
    enabled: !!calibrationId,
  });

  useState(() => {
    if (existingReadings?.length) {
      setReadings(existingReadings.map((r: any) => ({
        reference_value: String(r.reference_value),
        indication_increasing: String(r.indication_increasing ?? ''),
        indication_decreasing: String(r.indication_decreasing ?? ''),
        k_factor: String(r.k_factor),
        repetition: r.repetition,
        unit: r.unit,
      })));
    }
  });

  const saveMutation = useMutation({
    mutationFn: (data: { readings: Reading[] }) =>
      api.post(`/calibration/${calibrationId}/readings`, data).then(r => r.data),
    onSuccess: () => {
      toast.success('Leituras salvas com sucesso');
      qc.invalidateQueries({ queryKey: ['calibration-readings'] });
    },
    onError: () => toast.error('Erro ao salvar leituras'),
  });

  const generateCertMutation = useMutation({
    mutationFn: () => api.post(`/calibration/${calibrationId}/generate-certificate`).then(r => r.data),
    onSuccess: (data) => {
      toast.success(`Certificado ${data.certificate_number} gerado com sucesso!`);
      qc.invalidateQueries({ queryKey: ['calibration-readings'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao gerar certificado'),
  });

  const addReading = () => {
    setReadings(prev => [...prev, {
      reference_value: '', indication_increasing: '', indication_decreasing: '',
      k_factor: '2.00', repetition: 1, unit: 'kg',
    }]);
  };

  const removeReading = (index: number) => {
    setReadings(prev => prev.filter((_, i) => i !== index));
  };

  const updateReading = (index: number, field: keyof Reading, value: string | number) => {
    setReadings(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleSave = () => {
    const valid = readings.filter(r => r.reference_value);
    if (!valid.length) { toast.error('Adicione pelo menos uma leitura'); return; }
    saveMutation.mutate({ readings: valid });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leituras de Calibração"
        subtitle={`Calibração #${calibrationId} — Dados para certificado ISO 17025`}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Resultados da Calibração</CardTitle>
          <Button size="sm" variant="outline" onClick={addReading}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Leitura
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">#</th>
                  <th className="p-2">Valor Referência</th>
                  <th className="p-2">Indicação Crescente</th>
                  <th className="p-2">Indicação Decrescente</th>
                  <th className="p-2">Fator k</th>
                  <th className="p-2">Repetição</th>
                  <th className="p-2">Unid.</th>
                  <th className="p-2">Erro Calculado</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r, i) => {
                  const error = r.indication_increasing && r.reference_value
                    ? (parseFloat(r.indication_increasing) - parseFloat(r.reference_value)).toFixed(4)
                    : '—';
                  return (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2">
                        <Input type="number" step="0.0001" value={r.reference_value}
                          onChange={e => updateReading(i, 'reference_value', e.target.value)}
                          className="w-32" placeholder="0.0000" />
                      </td>
                      <td className="p-2">
                        <Input type="number" step="0.0001" value={r.indication_increasing}
                          onChange={e => updateReading(i, 'indication_increasing', e.target.value)}
                          className="w-32" placeholder="0.0000" />
                      </td>
                      <td className="p-2">
                        <Input type="number" step="0.0001" value={r.indication_decreasing}
                          onChange={e => updateReading(i, 'indication_decreasing', e.target.value)}
                          className="w-32" placeholder="0.0000" />
                      </td>
                      <td className="p-2">
                        <Input type="number" step="0.01" value={r.k_factor}
                          onChange={e => updateReading(i, 'k_factor', e.target.value)}
                          className="w-20" />
                      </td>
                      <td className="p-2">
                        <Input type="number" min={1} value={r.repetition}
                          onChange={e => updateReading(i, 'repetition', parseInt(e.target.value) || 1)}
                          className="w-16" />
                      </td>
                      <td className="p-2">
                        <select value={r.unit} onChange={e => updateReading(i, 'unit', e.target.value)}
                          className="border rounded px-2 py-1 text-sm">
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="mg">mg</option>
                        </select>
                      </td>
                      <td className="p-2 font-mono text-right">
                        <span className={parseFloat(error) !== 0 ? (Math.abs(parseFloat(error)) > 1 ? 'text-red-600' : 'text-yellow-600') : 'text-green-600'}>
                          {error}
                        </span>
                      </td>
                      <td className="p-2">
                        <Button size="icon" variant="ghost" onClick={() => removeReading(i)} disabled={readings.length <= 1}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-6 justify-end">
            <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Leituras'}
            </Button>
            <Button variant="default" onClick={() => generateCertMutation.mutate()} disabled={generateCertMutation.isPending}>
              <FileCheck className="h-4 w-4 mr-1" />
              {generateCertMutation.isPending ? 'Gerando...' : 'Gerar Certificado ISO'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
