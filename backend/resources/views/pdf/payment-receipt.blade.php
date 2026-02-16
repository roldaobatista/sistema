@extends('pdf.layout')

@section('title', "Recibo de Pagamento — {{ $receipt->receipt_number }}")

@section('content')
    {{-- Badge --}}
    <div class="doc-badge">
        <div class="doc-badge-left">
            <span class="doc-type" style="background: #7c3aed;">Recibo de Pagamento</span>
            <div class="doc-number">Nº {{ $receipt->receipt_number }}</div>
        </div>
        <div class="doc-badge-right">
            <div class="doc-date">
                <strong>Data:</strong> {{ $receipt->issued_at?->format('d/m/Y') ?? now()->format('d/m/Y') }}<br>
                <span class="status-badge" style="background: #d1fae5; color: #065f46;">QUITADO</span>
            </div>
        </div>
    </div>

    {{-- Valor Principal --}}
    <div style="text-align: center; background: #f0fdf4; border: 2px solid #059669; border-radius: 8px; padding: 20px; margin-bottom: 22px;">
        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 2px;">Valor Recebido</div>
        <div style="font-size: 32px; font-weight: 700; color: #059669; margin: 8px 0;">
            R$ {{ number_format($receipt->amount, 2, ',', '.') }}
        </div>
        <div style="font-size: 11px; color: #334155;">
            ({{ $receipt->amount_in_words ?? '' }})
        </div>
    </div>

    {{-- Info Grid --}}
    <div class="info-grid">
        <div class="info-col">
            <div class="info-box">
                <div class="info-box-title" style="color: #7c3aed;">Recebemos de</div>
                <div class="info-row"><span class="info-label">Nome</span><span class="info-value">{{ $customer->name ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">CPF/CNPJ</span><span class="info-value">{{ $customer->document ?? '—' }}</span></div>
                @if($customer->address ?? false)
                    <div class="info-row"><span class="info-label">Endereço</span><span class="info-value">{{ $customer->address }}</span></div>
                @endif
                @if($customer->phone ?? false)
                    <div class="info-row"><span class="info-label">Telefone</span><span class="info-value">{{ $customer->phone }}</span></div>
                @endif
            </div>
        </div>
        <div class="info-col">
            <div class="info-box">
                <div class="info-box-title" style="color: #7c3aed;">Detalhes do Pagamento</div>
                <div class="info-row"><span class="info-label">Método</span><span class="info-value">{{ ucfirst($receipt->payment_method ?? 'Não informado') }}</span></div>
                @if($receipt->bank_account)
                    <div class="info-row"><span class="info-label">Conta</span><span class="info-value">{{ $receipt->bank_account }}</span></div>
                @endif
                @if($receipt->transaction_id)
                    <div class="info-row"><span class="info-label">ID Transação</span><span class="info-value">{{ $receipt->transaction_id }}</span></div>
                @endif
                @if($receipt->payment_date)
                    <div class="info-row"><span class="info-label">Data Pagamento</span><span class="info-value">{{ $receipt->payment_date->format('d/m/Y') }}</span></div>
                @endif
            </div>
        </div>
    </div>

    {{-- Itens pagos --}}
    @if(isset($items) && count($items))
        <table class="data-table">
            <thead>
                <tr>
                    <th colspan="4" style="background: #7c3aed; color: #fff; text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;">
                        Títulos Pagos
                    </th>
                </tr>
                <tr>
                    <th>Referência</th>
                    <th>Descrição</th>
                    <th style="text-align: center">Vencimento</th>
                    <th style="text-align: right">Valor</th>
                </tr>
            </thead>
            <tbody>
                @foreach($items as $item)
                    <tr>
                        <td>{{ $item['reference'] ?? '—' }}</td>
                        <td>{{ $item['description'] ?? '—' }}</td>
                        <td style="text-align: center">{{ isset($item['due_date']) ? \Carbon\Carbon::parse($item['due_date'])->format('d/m/Y') : '—' }}</td>
                        <td style="text-align: right">R$ {{ number_format($item['amount'] ?? 0, 2, ',', '.') }}</td>
                    </tr>
                @endforeach
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3"><strong>Total</strong></td>
                    <td style="text-align: right"><strong>R$ {{ number_format($receipt->amount, 2, ',', '.') }}</strong></td>
                </tr>
            </tfoot>
        </table>
    @endif

    {{-- Descrição / Referente a --}}
    @if($receipt->description)
        <div class="notes-section" style="background: #faf5ff; border-color: #ddd6fe;">
            <div class="notes-title" style="color: #6b21a8;">Referente a</div>
            <div class="notes-text" style="color: #581c87;">{{ $receipt->description }}</div>
        </div>
    @endif

    {{-- Observações --}}
    @if($receipt->notes)
        <div class="notes-section">
            <div class="notes-title">Observações</div>
            <div class="notes-text">{{ $receipt->notes }}</div>
        </div>
    @endif

    {{-- Declaração Legal --}}
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin-top: 15px;">
        <div style="font-size: 9px; color: #334155; line-height: 1.7;">
            Declaramos para os devidos fins que recebemos a importância acima mencionada,
            referente aos serviços/produtos discriminados, dando plena e irrevogável quitação.
        </div>
    </div>

    {{-- Assinaturas --}}
    <div class="signatures">
        <div class="sig-col">
            <div class="sig-line">
                <div class="sig-name">{{ $tenant->name ?? 'Empresa' }}</div>
                <div class="sig-role">Emitente</div>
            </div>
        </div>
        <div class="sig-col">
            <div class="sig-line">
                <div class="sig-name">{{ $customer->name ?? 'Cliente' }}</div>
                <div class="sig-role">Pagador</div>
            </div>
        </div>
    </div>
@endsection
