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

    {{-- Condições Ambientais (ISO 17025) --}}
    @if($calibration->temperature || $calibration->humidity || $calibration->pressure)
        <div class="info-box" style="margin-top: 12px;">
            <div class="info-box-title" style="color: #059669;">Condições Ambientais</div>
            <div style="display: flex; gap: 0;">
                @if($calibration->temperature)
                    <div style="flex: 1; text-align: center; padding: 8px; border-right: 1px solid #e2e8f0;">
                        <div style="font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Temperatura</div>
                        <div style="font-size: 18px; font-weight: 700; color: #0f172a;">{{ number_format($calibration->temperature, 1, ',', '.') }} °C</div>
                    </div>
                @endif
                @if($calibration->humidity)
                    <div style="flex: 1; text-align: center; padding: 8px; border-right: 1px solid #e2e8f0;">
                        <div style="font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Umidade Relativa</div>
                        <div style="font-size: 18px; font-weight: 700; color: #0f172a;">{{ number_format($calibration->humidity, 1, ',', '.') }} %</div>
                    </div>
                @endif
                @if($calibration->pressure)
                    <div style="flex: 1; text-align: center; padding: 8px;">
                        <div style="font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Pressão Atmosférica</div>
                        <div style="font-size: 18px; font-weight: 700; color: #0f172a;">{{ number_format($calibration->pressure, 1, ',', '.') }} hPa</div>
                    </div>
                @endif
            </div>
        </div>
    @endif

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

    {{-- Padrões Utilizados - Pesos Padrão (ISO 17025) --}}
    @if(isset($standardWeights) && $standardWeights->count())
        <table class="data-table">
            <thead>
                <tr>
                    <th colspan="6" style="background: #059669; color: #fff; text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;">
                        Padrões de Medição Utilizados
                    </th>
                </tr>
                <tr>
                    <th>Código</th>
                    <th style="text-align: center">Valor Nominal</th>
                    <th style="text-align: center">Classe</th>
                    <th>Nº Certificado</th>
                    <th style="text-align: center">Validade</th>
                    <th>Laboratório</th>
                </tr>
            </thead>
            <tbody>
                @foreach($standardWeights as $weight)
                    <tr>
                        <td>{{ $weight->code }}</td>
                        <td style="text-align: center">{{ number_format($weight->nominal_value, 4, ',', '.') }} {{ $weight->unit }}</td>
                        <td style="text-align: center">{{ $weight->precision_class ?? '—' }}</td>
                        <td>{{ $weight->certificate_number ?? '—' }}</td>
                        <td style="text-align: center">
                            @if($weight->certificate_expiry)
                                {{ $weight->certificate_expiry->format('d/m/Y') }}
                                @if($weight->certificate_expiry->isPast())
                                    <span style="color: #dc2626; font-size: 7px;">(VENCIDO)</span>
                                @endif
                            @else
                                —
                            @endif
                        </td>
                        <td>{{ $weight->laboratory ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    {{-- Erros Encontrados --}}
    @if($calibration->errors_found && count($calibration->errors_found))
        <table class="data-table">
            <thead>
                <tr>
                    <th colspan="5" style="background: #0284c7; color: #fff; text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;">
                        Resultados das Medições
                    </th>
                </tr>
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

    {{-- Ensaio de Excentricidade (ISO 17025 - Anexo) --}}
    @if($calibration->eccentricity_data && is_array($calibration->eccentricity_data) && count($calibration->eccentricity_data))
        @php
            $eccData = $calibration->eccentricity_data;
            $eccPoints = $eccData['points'] ?? $eccData;
            $eccLoad = $eccData['test_load'] ?? null;
            $eccUnit = $eccData['unit'] ?? 'kg';
            $eccNotes = $eccData['notes'] ?? null;
        @endphp
        <table class="data-table" style="margin-top: 12px;">
            <thead>
                <tr>
                    <th colspan="4" style="background: #7c3aed; color: #fff; text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;">
                        Ensaio de Excentricidade
                        @if($eccLoad)
                            — Carga de Teste: {{ $eccLoad }} {{ $eccUnit }}
                        @endif
                    </th>
                </tr>
                <tr>
                    <th>Posição</th>
                    <th style="text-align: center">Carga Aplicada ({{ $eccUnit }})</th>
                    <th style="text-align: center">Indicação</th>
                    <th style="text-align: center">Erro</th>
                </tr>
            </thead>
            <tbody>
                @foreach($eccPoints as $point)
                    <tr>
                        <td>{{ $point['position'] ?? $point['label'] ?? '—' }}</td>
                        <td style="text-align: center">{{ $point['load'] ?? $eccLoad ?? '—' }}</td>
                        <td style="text-align: center">{{ $point['indication'] ?? $point['reading'] ?? '—' }}</td>
                        <td style="text-align: center">
                            @php $eccError = $point['error'] ?? null; @endphp
                            @if($eccError !== null)
                                <span style="color: {{ abs((float) $eccError) > 0 ? '#dc2626' : '#059669' }}">{{ $eccError }}</span>
                            @else
                                —
                            @endif
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
        @if($eccNotes)
            <div style="font-size: 8px; color: #64748b; margin-top: 4px; font-style: italic;">
                Obs. Excentricidade: {{ $eccNotes }}
            </div>
        @endif
    @endif

    {{-- Observações --}}
    @if($calibration->notes)
        <div class="notes-section">
            <div class="notes-title">Observações</div>
            <div class="notes-text">{{ $calibration->notes }}</div>
        </div>
    @endif

    {{-- Rastreabilidade (ISO 17025) --}}
    <div style="background: #f0fdf4; border: 2px solid #059669; border-radius: 6px; padding: 14px 16px; margin-top: 15px;">
        <div style="font-size: 8px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">Declaração de Rastreabilidade</div>
        <div style="font-size: 9px; color: #334155; line-height: 1.7;">
            Declaramos que o equipamento acima identificado foi calibrado conforme os procedimentos internos da empresa,
            rastreáveis à Rede Brasileira de Calibração (RBC) e aos padrões do INMETRO.
            @if(isset($standardWeights) && $standardWeights->count())
                Os padrões de medição utilizados nesta calibração possuem certificados de calibração válidos,
                emitidos por laboratórios acreditados, conforme relacionados na tabela "Padrões de Medição Utilizados".
            @endif
            O resultado expresso refere-se exclusivamente às condições no momento da calibração.
            Este certificado atende aos requisitos da norma ABNT NBR ISO/IEC 17025.
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
        @if(isset($workOrder) && $workOrder && $workOrder->signature_path)
            <div class="sig-col">
                <div class="sig-line">
                    @if(file_exists(public_path($workOrder->signature_path)))
                        <img src="{{ public_path($workOrder->signature_path) }}" style="max-height: 50px; max-width: 150px; margin-bottom: 4px;" alt="Assinatura do cliente">
                    @endif
                    <div class="sig-name">{{ $workOrder->signature_signer ?? $equipment->customer->name ?? 'Cliente' }}</div>
                    <div class="sig-role">
                        Assinatura do Cliente
                        @if($workOrder->signature_at)
                            <br><span style="font-size: 7px; color: #94a3b8;">{{ $workOrder->signature_at->format('d/m/Y H:i') }}</span>
                        @endif
                    </div>
                </div>
            </div>
        @endif
    </div>
@endsection
