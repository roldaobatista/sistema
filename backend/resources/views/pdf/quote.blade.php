@extends('pdf.layout')

@section('title', "Orçamento {$quote->quote_number}")

@section('content')
    {{-- Badge --}}
    <div class="doc-badge">
        <div class="doc-badge-left">
            <span class="doc-type">Proposta Comercial</span>
            <div class="doc-number">{{ $quote->quote_number }}</div>
        </div>
        <div class="doc-badge-right">
            <div class="doc-date">
                <strong>Emissão:</strong> {{ $quote->created_at->format('d/m/Y') }}<br>
                <strong>Validade:</strong> {{ $quote->valid_until?->format('d/m/Y') ?? '—' }}<br>
                <span class="status-badge status-{{ $quote->status }}">
                    {{ \App\Models\Quote::STATUSES[$quote->status]['label'] ?? $quote->status }}
                </span>
            </div>
        </div>
    </div>

    {{-- Mensagem inicial --}}
    <div style="background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin-bottom: 22px;">
        <p style="font-size: 11px; color: #1e293b; line-height: 1.7; margin: 0;">
            Prezado(a) <strong>{{ $quote->customer->name ?? 'Cliente' }}</strong>,<br>
            Temos o prazer de apresentar nossa proposta comercial para os serviços e/ou produtos abaixo discriminados.
            Agradecemos a confiança depositada em nossa empresa.
        </p>
    </div>

    {{-- Cliente & Vendedor --}}
    <div class="info-grid">
        <div class="info-col">
            <div class="info-box">
                <div class="info-box-title">Cliente</div>
                <div class="info-row"><span class="info-label">Razão Social</span><span class="info-value">{{ $quote->customer->name ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">CPF/CNPJ</span><span class="info-value">{{ $quote->customer->document ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">Telefone</span><span class="info-value">{{ $quote->customer->phone ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">E-mail</span><span class="info-value">{{ $quote->customer->email ?? '—' }}</span></div>
                @if($quote->customer->address_city ?? false)
                    <div class="info-row"><span class="info-label">Endereço</span><span class="info-value">
                        {{ collect([$quote->customer->address_street, $quote->customer->address_number, $quote->customer->address_neighborhood, $quote->customer->address_city, $quote->customer->address_state])->filter()->join(', ') }}
                    </span></div>
                @endif
            </div>
        </div>
        <div class="info-col">
            <div class="info-box">
                <div class="info-box-title">Vendedor</div>
                <div class="info-row"><span class="info-label">Nome</span><span class="info-value">{{ $quote->seller->name ?? '—' }}</span></div>
                @if($quote->seller->email ?? false)
                    <div class="info-row"><span class="info-label">E-mail</span><span class="info-value">{{ $quote->seller->email }}</span></div>
                @endif
                @if($quote->seller->phone ?? false)
                    <div class="info-row"><span class="info-label">Telefone</span><span class="info-value">{{ $quote->seller->phone }}</span></div>
                @endif
            </div>
        </div>
    </div>

    {{-- Equipamentos e Itens --}}
    @foreach($quote->equipments as $eqIndex => $quoteEquipment)
        <div style="margin-bottom: 18px;">
            <div style="background: #1e40af; color: #fff; padding: 8px 14px; border-radius: 4px 4px 0 0; font-size: 10px; font-weight: 700;">
                @if($quoteEquipment->equipment)
                    Equipamento {{ $eqIndex + 1 }}: {{ $quoteEquipment->equipment->brand ?? '' }} {{ $quoteEquipment->equipment->model ?? '' }}
                    @if($quoteEquipment->equipment->serial_number) — S/N: {{ $quoteEquipment->equipment->serial_number }} @endif
                @else
                    Equipamento {{ $eqIndex + 1 }}
                @endif
            </div>
            <table class="data-table" style="margin-bottom: 0;">
                <thead>
                    <tr>
                        <th style="width: 35px; border-radius: 0">#</th>
                        <th style="border-radius: 0">Descrição</th>
                        <th style="width: 50px; border-radius: 0">Tipo</th>
                        <th style="width: 40px; text-align: center; border-radius: 0">Qtd</th>
                        <th style="width: 80px; text-align: right; border-radius: 0">Unit.</th>
                        <th style="width: 85px; text-align: right; border-radius: 0">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($quoteEquipment->items as $j => $item)
                        <tr>
                            <td>{{ $j + 1 }}</td>
                            <td><strong>{{ $item->description }}</strong></td>
                            <td>{{ $item->type === 'product' ? 'Peça' : 'Serviço' }}</td>
                            <td style="text-align: center">{{ number_format($item->quantity, 2, ',', '.') }}</td>
                            <td style="text-align: right">R$ {{ number_format($item->unit_price, 2, ',', '.') }}</td>
                            <td style="text-align: right"><strong>R$ {{ number_format($item->subtotal, 2, ',', '.') }}</strong></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endforeach

    {{-- Totais --}}
    <div class="clearfix">
        <div class="totals-box" style="width: 280px;">
            <div class="totals-row"><span class="totals-label">Subtotal</span><span class="totals-value">R$ {{ number_format($quote->subtotal ?? 0, 2, ',', '.') }}</span></div>
            @if($quote->discount_percentage > 0)
                <div class="totals-row"><span class="totals-label">Desconto ({{ number_format($quote->discount_percentage, 1, ',', '.') }}%)</span><span class="totals-value" style="color: #dc2626">- R$ {{ number_format($quote->discount_amount ?? 0, 2, ',', '.') }}</span></div>
            @elseif($quote->discount_amount > 0)
                <div class="totals-row"><span class="totals-label">Desconto</span><span class="totals-value" style="color: #dc2626">- R$ {{ number_format($quote->discount_amount, 2, ',', '.') }}</span></div>
            @endif
            <div class="totals-row total-final"><span class="totals-label">VALOR TOTAL</span><span class="totals-value">R$ {{ number_format($quote->total ?? 0, 2, ',', '.') }}</span></div>
        </div>
    </div>

    {{-- Observações --}}
    @if($quote->observations)
        <div class="notes-section" style="margin-top: 10px;">
            <div class="notes-title">Observações</div>
            <div class="notes-text">{{ $quote->observations }}</div>
        </div>
    @endif

    {{-- Condições --}}
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin-top: 10px;">
        <div style="font-size: 8px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
            Condições Gerais
        </div>
        <div style="font-size: 9px; color: #64748b; line-height: 1.8;">
            • A validade desta proposta é de {{ $quote->valid_until ? max(0, now()->diffInDays($quote->valid_until, false)) : 30 }} dias a contar da data de emissão.<br>
            • Os preços incluem todos os materiais e mão de obra necessários para a execução dos serviços.<br>
            • Garantia de 90 dias para serviços e peças, exceto desgaste natural.<br>
            • Prazo de execução a combinar após aprovação.<br>
            • Forma de pagamento: a combinar.
        </div>
    </div>

    {{-- Aprovação --}}
    <div style="margin-top: 30px; padding: 16px; border: 2px solid #2563eb; border-radius: 6px; text-align: center;">
        <div style="font-size: 10px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Aceite da Proposta</div>
        <p style="font-size: 9px; color: #64748b; margin-bottom: 12px;">
            Declaro que li e concordo com os termos desta proposta comercial.
        </p>
        <div class="signatures" style="margin-top: 25px;">
            <div class="sig-col">
                <div class="sig-line">
                    <div class="sig-name">{{ $quote->customer->name ?? 'Cliente' }}</div>
                    <div class="sig-role">Cliente — Data: ____/____/________</div>
                </div>
            </div>
            <div class="sig-col">
                <div class="sig-line">
                    <div class="sig-name">{{ $quote->seller->name ?? 'Vendedor' }}</div>
                    <div class="sig-role">Representante Comercial</div>
                </div>
            </div>
        </div>
    </div>
@endsection
