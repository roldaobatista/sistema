<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório Customer 360 - {{ $customer['name'] }}</title>
    <style>
        body { font-family: sans-serif; font-size: 12px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
        .section { margin-bottom: 20px; }
        .section-title { background: #f3f4f6; padding: 5px 10px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; color: #1e40af; }
        .grid { display: flex; flex-wrap: wrap; }
        .col { width: 48%; display: inline-block; vertical-align: top; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        th { background: #f9fafb; font-weight: bold; }
        .metric-card { border: 1px solid #e5e7eb; padding: 10px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 18px; font-weight: bold; color: #3b82f6; }
        .metric-label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
        .badge { padding: 3px 8px; border-radius: 99px; font-size: 10px; font-weight: bold; }
        .badge-critical { background: #fee2e2; color: #dc2626; }
        .badge-healthy { background: #d1fae5; color: #059669; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Universo do Cliente: Visão 360º</h1>
        <p>{{ $customer['name'] }} | CNPJ: {{ $customer['document'] }}</p>
        <p>Relatório gerado em {{ date('d/m/Y H:i') }}</p>
    </div>

    <div class="section">
        <div class="section-title">Score de Saúde & Risco</div>
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; font-weight: bold;">{{ $metrics['health_score'] }}%</div>
            <p>Risco de Churn: <strong>{{ strtoupper($metrics['churn_risk']) }}</strong></p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Resumo Financeiro & Engajamento</div>
        <table style="width: 100%;">
            <tr>
                <td>
                    <div class="metric-label">LTV (Total Pago)</div>
                    <div class="metric-value">R$ {{ number_format($metrics['ltv'], 2, ',', '.') }}</div>
                </td>
                <td>
                    <div class="metric-label">Média de Ticket</div>
                    <div class="metric-value">R$ {{ number_format($metrics['average_ticket'], 2, ',', '.') }}</div>
                </td>
                <td>
                    <div class="metric-label">Conversão</div>
                    <div class="metric-value">{{ $metrics['conversion_rate'] }}%</div>
                </td>
                <td>
                    <div class="metric-label">Dias Inativo</div>
                    <div class="metric-value">{{ $metrics['last_contact_days'] }}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Equipamentos & Calibrações</div>
        <table>
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Equipamento</th>
                    <th>Próx. Calibração</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                @foreach($equipments as $eq)
                <tr>
                    <td>{{ $eq['code'] }}</td>
                    <td>{{ $eq['brand'] }} {{ $eq['model'] }}</td>
                    <td>{{ $eq['next_calibration_at'] ? date('d/m/Y', strtotime($eq['next_calibration_at'])) : '—' }}</td>
                    <td>{{ strtoupper($eq['calibration_status']) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Análise de Benchmarking</div>
        <p>Comparativo de faturamento anual versus média do segmento ({{ $customer['segment'] }}):</p>
        <table>
            @foreach($metrics['benchmarking'] as $bench)
            <tr>
                <td style="width: 70%;">{{ $bench['name'] }}</td>
                <td style="font-weight: bold;">R$ {{ number_format($bench['value'], 2, ',', '.') }}</td>
            </tr>
            @endforeach
        </table>
    </div>

    <div style="margin-top: 50px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px;">
        Este relatório é de uso confidencial. Gerado automaticamente pelo Kalibrium ERP.
    </div>
</body>
</html>
