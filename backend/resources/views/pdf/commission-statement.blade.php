<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1f2937; }
        h1 { margin: 0 0 8px; font-size: 18px; }
        .meta { margin-bottom: 16px; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 6px 8px; }
        th { background: #f3f4f6; text-align: left; font-size: 11px; }
        td.num, th.num { text-align: right; }
        .footer { margin-top: 12px; font-size: 12px; color: #111827; }
    </style>
</head>
<body>
    <h1>Extrato de Comissões</h1>
    <div class="meta">
        <div><strong>Usuário:</strong> {{ $userName }}</div>
        <div><strong>Período:</strong> {{ $period }}</div>
        <div><strong>Gerado em:</strong> {{ $generatedAt->format('d/m/Y H:i') }}</div>
        <div><strong>Status fechamento:</strong> {{ $settlementStatus ?? 'não fechado' }}</div>
        @if($paidAt)
            <div><strong>Pago em:</strong> {{ \Illuminate\Support\Carbon::parse($paidAt)->format('d/m/Y') }}</div>
        @endif
    </div>

    <table>
        <thead>
            <tr>
                <th>Data</th>
                <th>OS</th>
                <th>Regra</th>
                <th>Tipo</th>
                <th class="num">Base</th>
                <th class="num">Comissão</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($events as $event)
                <tr>
                    <td>{{ optional($event->created_at)->format('d/m/Y') }}</td>
                    <td>{{ $event->workOrder?->os_number ?? $event->workOrder?->number ?? '-' }}</td>
                    <td>{{ $event->rule?->name ?? '-' }}</td>
                    <td>{{ $event->rule?->calculation_type ?? '-' }}</td>
                    <td class="num">R$ {{ number_format((float) $event->base_amount, 2, ',', '.') }}</td>
                    <td class="num">R$ {{ number_format((float) $event->commission_amount, 2, ',', '.') }}</td>
                    <td>{{ $event->status }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        <strong>Quantidade de eventos:</strong> {{ $eventsCount }}<br>
        <strong>Total:</strong> R$ {{ number_format((float) $totalAmount, 2, ',', '.') }}
    </div>
</body>
</html>


