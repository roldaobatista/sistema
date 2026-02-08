@extends('pdf.layout')

@section('title', "Certificado de Calibração — {{ $calibration->certificate_number ?? $calibration->id }}")

@section('content')
    {{-- Badge --}}
    <div class="doc-badge">
        <div class="doc-badge-left">
            <span class="doc-type" style="background: #059669;">Certificado de Calibração</span>
            <div class="doc-number">Nº {{ $calibration->certificate_number ?? 'CAL-' . str_pad($calibration->id, 6, '0', STR_PAD_LEFT) }}</div>
        </div>
        <div class="doc-badge-right">
            <div class="doc-date">
                <strong>Data da Calibração:</strong> {{ $calibration->calibration_date?->format('d/m/Y') }}<br>
                <strong>Próxima Calibração:</strong> {{ $calibration->next_due_date?->format('d/m/Y') ?? '—' }}<br>
                <span class="status-badge" style="background: {{ $calibration->result === 'aprovado' ? '#d1fae5' : '#fee2e2' }}; color: {{ $calibration->result === 'aprovado' ? '#065f46' : '#991b1b' }}">
                    {{ strtoupper($calibration->result) }}
                </span>
            </div>
        </div>
    </div>

    {{-- Equipamento --}}
    <div class="info-grid">
        <div class="info-col">
            <div class="info-box">
                <div class="info-box-title" style="color: #059669;">Equipamento Calibrado</div>
                <div class="info-row"><span class="info-label">Código</span><span class="info-value">{{ $equipment->code ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">Marca / Modelo</span><span class="info-value">{{ $equipment->brand }} {{ $equipment->model }}</span></div>
                <div class="info-row"><span class="info-label">Nº Série</span><span class="info-value">{{ $equipment->serial_number ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">Capacidade</span><span class="info-value">{{ $equipment->capacity ?? '—' }} {{ $equipment->capacity_unit ?? '' }}</span></div>
                <div class="info-row"><span class="info-label">Resolução</span><span class="info-value">{{ $equipment->resolution ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">Classe</span><span class="info-value">{{ $equipment->precision_class ?? '—' }}</span></div>
                @if($equipment->inmetro_number)
                    <div class="info-row"><span class="info-label">INMETRO</span><span class="info-value">{{ $equipment->inmetro_number }}</span></div>
                @endif
            </div>
        </div>
        <div class="info-col">
            <div class="info-box">
                <div class="info-box-title" style="color: #059669;">Proprietário / Localização</div>
                @if($equipment->customer)
                    <div class="info-row"><span class="info-label">Cliente</span><span class="info-value">{{ $equipment->customer->name }}</span></div>
                    <div class="info-row"><span class="info-label">CPF/CNPJ</span><span class="info-value">{{ $equipment->customer->document ?? '—' }}</span></div>
                @endif
                <div class="info-row"><span class="info-label">Localização</span><span class="info-value">{{ $equipment->location ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">Tag</span><span class="info-value">{{ $equipment->tag ?? '—' }}</span></div>
            </div>
        </div>
    </div>

    {{-- Dados da Calibração --}}
    <div class="info-grid">
        <div class="info-col">
            <div class="info-box">
                <div class="info-box-title" style="color: #059669;">Dados da Calibração</div>
                <div class="info-row"><span class="info-label">Tipo</span><span class="info-value">{{ ucfirst($calibration->calibration_type) }}</span></div>
                <div class="info-row"><span class="info-label">Laboratório</span><span class="info-value">{{ $calibration->laboratory ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">Incerteza</span><span class="info-value">{{ $calibration->uncertainty ?? '—' }}</span></div>
                @if($calibration->performed_by)
                    <div class="info-row"><span class="info-label">Executado por</span><span class="info-value">{{ $calibration->performer->name ?? '—' }}</span></div>
                @endif
                @if($calibration->approved_by)
                    <div class="info-row"><span class="info-label">Aprovado por</span><span class="info-value">{{ $calibration->approver->name ?? '—' }}</span></div>
                @endif
                @if($calibration->cost)
                    <div class="info-row"><span class="info-label">Custo</span><span class="info-value">R$ {{ number_format($calibration->cost, 2, ',', '.') }}</span></div>
                @endif
            </div>
        </div>
        <div class="info-col">
            <div class="info-box">
                <div class="info-box-title" style="color: #059669;">Resultado</div>
                <div style="text-align: center; padding: 10px 0;">
                    <div style="font-size: 40px; font-weight: 700; color: {{ $calibration->result === 'aprovado' ? '#059669' : '#dc2626' }};">
                        {{ $calibration->result === 'aprovado' ? '✓' : '✗' }}
                    </div>
                    <div style="font-size: 14px; font-weight: 700; color: {{ $calibration->result === 'aprovado' ? '#059669' : '#dc2626' }}; text-transform: uppercase; letter-spacing: 2px;">
                        {{ $calibration->result }}
                    </div>
                </div>
            </div>
        </div>
    </div>

    {{-- Erros Encontrados --}}
    @if($calibration->errors_found && count($calibration->errors_found))
        <table class="data-table">
            <thead>
                <tr>
                    <th>Ponto de Verificação</th>
                    <th style="text-align: center">Valor Nominal</th>
                    <th style="text-align: center">Valor Encontrado</th>
                    <th style="text-align: center">Erro</th>
                    <th style="text-align: right">Tolerância</th>
                </tr>
            </thead>
            <tbody>
                @foreach($calibration->errors_found as $error)
                    <tr>
                        <td>{{ $error['point'] ?? '—' }}</td>
                        <td style="text-align: center">{{ $error['nominal'] ?? '—' }}</td>
                        <td style="text-align: center">{{ $error['found'] ?? '—' }}</td>
                        <td style="text-align: center">{{ $error['error'] ?? '—' }}</td>
                        <td style="text-align: right">{{ $error['tolerance'] ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    {{-- Correções --}}
    @if($calibration->corrections_applied)
        <div class="notes-section" style="background: #f0fdf4; border-color: #bbf7d0;">
            <div class="notes-title" style="color: #166534;">Correções Aplicadas</div>
            <div class="notes-text" style="color: #15803d;">{{ $calibration->corrections_applied }}</div>
        </div>
    @endif

    {{-- Observações --}}
    @if($calibration->notes)
        <div class="notes-section">
            <div class="notes-title">Observações</div>
            <div class="notes-text">{{ $calibration->notes }}</div>
        </div>
    @endif

    {{-- Declaração --}}
    <div style="background: #f0fdf4; border: 2px solid #059669; border-radius: 6px; padding: 14px 16px; margin-top: 15px;">
        <div style="font-size: 8px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">Declaração</div>
        <div style="font-size: 9px; color: #334155; line-height: 1.7;">
            Declaramos que o equipamento acima identificado foi calibrado conforme os procedimentos internos da empresa,
            rastreáveis à Rede Brasileira de Calibração (RBC) e aos padrões do INMETRO.
            O resultado expresso refere-se exclusivamente às condições no momento da calibração.
        </div>
    </div>

    {{-- Assinaturas --}}
    <div class="signatures">
        <div class="sig-col">
            <div class="sig-line">
                <div class="sig-name">{{ $calibration->performer->name ?? 'Técnico Metrológico' }}</div>
                <div class="sig-role">Executou a Calibração</div>
            </div>
        </div>
        <div class="sig-col">
            <div class="sig-line">
                <div class="sig-name">{{ $calibration->approver->name ?? 'Responsável Técnico' }}</div>
                <div class="sig-role">Aprovou o Certificado</div>
            </div>
        </div>
    </div>
@endsection
