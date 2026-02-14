<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório de Conciliação Bancária</title>
    <style>
        body { font-family: sans-serif; font-size: 12px; }
        .header { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .header h2 { margin: 0; color: #333; }
        .header p { margin: 5px 0 0; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        th { background-color: #f9fafb; font-weight: bold; color: #374151; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .credit { color: #059669; }
        .debit { color: #dc2626; }
        .status-matched { background-color: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .status-pending { background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .status-ignored { background-color: #f3f4f6; color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .summary { margin-top: 20px; width: 40%; float: right; }
        .summary table { border: none; }
        .summary td { border: none; padding: 4px; }
        .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Relatório de Conciliação Bancária</h2>
        <p>
            <strong>Arquivo:</strong> {{ $statement->filename }}<br>
            <strong>Conta:</strong> {{ $statement->bankAccount->name ?? 'N/A' }} ({{ $statement->bankAccount->bank_name ?? 'N/A' }})<br>
            <strong>Importado em:</strong> {{ $statement->imported_at->format('d/m/Y H:i') }}<br>
            <strong>Gerado por:</strong> {{ auth()->user()->name }} em {{ now()->format('d/m/Y H:i') }}
        </p>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 80px;">Data</th>
                <th>Descrição</th>
                <th style="width: 100px;">Valor</th>
                <th style="width: 80px;">Status</th>
                <th>Categoria / Vinculado a</th>
            </tr>
        </thead>
        <tbody>
            @foreach($entries as $entry)
            <tr>
                <td>{{ $entry->date->format('d/m/Y') }}</td>
                <td>{{ $entry->description }}</td>
                <td class="{{ $entry->type }}">
                    {{ $entry->type === 'debit' ? '-' : '+' }} R$ {{ number_format($entry->amount, 2, ',', '.') }}
                </td>
                <td>
                    <span class="status-{{ $entry->status }}">
                        {{ match($entry->status) { 'matched' => 'Conciliado', 'pending' => 'Pendente', 'ignored' => 'Ignorado', default => $entry->status } }}
                    </span>
                </td>
                <td>
                    @if($entry->category)
                        <span style="color: #666;">[{{ $entry->category }}]</span>
                    @endif
                    @if($entry->matched_type)
                        <br><small>{{ class_basename($entry->matched_type) }}: #{{ $entry->matched_id }}</small>
                    @endif
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="summary">
        <h4>Resumo</h4>
        <table>
            <tr>
                <td><strong>Total de Lançamentos:</strong></td>
                <td>{{ $statement->total_entries }}</td>
            </tr>
            <tr>
                <td><strong>Conciliados:</strong></td>
                <td>{{ $statement->matched_entries }} ({{ $statement->total_entries > 0 ? round(($statement->matched_entries / $statement->total_entries) * 100) : 0 }}%)</td>
            </tr>
            <tr>
                <td><strong>Entradas:</strong></td>
                <td class="credit">R$ {{ number_format($entries->where('type', 'credit')->sum('amount'), 2, ',', '.') }}</td>
            </tr>
            <tr>
                <td><strong>Saídas:</strong></td>
                <td class="debit">R$ {{ number_format($entries->where('type', 'debit')->sum('amount'), 2, ',', '.') }}</td>
            </tr>
        </table>
    </div>

    <div class="footer">
        Gerado pelo Sistema Kalibrium - Página <script type="text/php">if (isset($pdf)) { echo $pdf->get_page_number(); }</script>
    </div>
</body>
</html>
