<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Oportunidades INMETRO</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a2e; line-height: 1.4; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 24px 32px; }
        .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .header p { font-size: 11px; opacity: 0.8; }
        .meta { display: flex; justify-content: space-between; padding: 12px 32px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; }
        .meta .stat { text-align: center; }
        .meta .stat-value { font-size: 18px; font-weight: 700; }
        .meta .stat-label { font-size: 9px; text-transform: uppercase; color: #6c757d; }
        .meta .critical { color: #dc2626; }
        .meta .urgent { color: #f59e0b; }
        table { width: 100%; border-collapse: collapse; margin: 0 32px; }
        thead th { background: #f1f3f5; padding: 8px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #495057; border-bottom: 2px solid #dee2e6; }
        tbody td { padding: 7px 10px; border-bottom: 1px solid #f1f3f5; vertical-align: top; }
        tbody tr:nth-child(even) { background: #fafbfc; }
        .priority-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
        .priority-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .priority-urgente { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
        .priority-alta { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .priority-normal { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .priority-baixa { background: #f9fafb; color: #6b7280; border: 1px solid #e5e7eb; }
        .footer { position: fixed; bottom: 0; width: 100%; padding: 8px 32px; background: #f8f9fa; border-top: 1px solid #e9ecef; font-size: 9px; color: #6c757d; text-align: center; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Relatório de Oportunidades INMETRO</h1>
        <p>{{ $tenant->name }} — Gerado em {{ $generated_at }}</p>
    </div>

    <div class="meta">
        <div class="stat">
            <div class="stat-value">{{ $total_leads }}</div>
            <div class="stat-label">Total de Leads</div>
        </div>
        <div class="stat">
            <div class="stat-value critical">{{ $critical_count }}</div>
            <div class="stat-label">Críticos</div>
        </div>
        <div class="stat">
            <div class="stat-value urgent">{{ $urgent_count }}</div>
            <div class="stat-label">Urgentes</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 5%">#</th>
                <th style="width: 22%">Proprietário</th>
                <th style="width: 15%">Documento</th>
                <th style="width: 10%">Prioridade</th>
                <th style="width: 8%">Equip.</th>
                <th style="width: 18%">Cidade(s)</th>
                <th style="width: 12%">Receita Est.</th>
                <th style="width: 10%">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($leads as $index => $lead)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td><strong>{{ $lead['name'] }}</strong></td>
                <td>{{ $lead['document'] }}</td>
                <td>
                    @php
                        $cls = strtolower($lead['priority']);
                        $cls = str_replace('í', 'i', $cls);
                    @endphp
                    <span class="priority-badge priority-{{ $cls }}">{{ $lead['priority'] }}</span>
                </td>
                <td>{{ $lead['instruments'] }}</td>
                <td>{{ $lead['cities'] }}</td>
                <td>{{ $lead['estimated_revenue'] }}</td>
                <td>{{ ucfirst(str_replace('_', ' ', $lead['lead_status'])) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        Sistema — Inteligência INMETRO | {{ $tenant->name }} | {{ $generated_at }}
    </div>
</body>
</html>
