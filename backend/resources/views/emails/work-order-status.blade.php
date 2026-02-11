@component('mail::message')
# {{ match($statusType) { 'created' => 'Ordem de Serviço Criada', 'completed' => 'Serviço Concluído', 'awaiting_approval' => 'Aguardando Sua Aprovação', default => 'Atualização da OS' } }}

Olá, **{{ $customerName }}**!

@if($statusType === 'created')
Uma nova Ordem de Serviço foi registrada para você.
@elseif($statusType === 'completed')
A sua Ordem de Serviço foi concluída com sucesso.
@elseif($statusType === 'awaiting_approval')
A sua Ordem de Serviço está aguardando a sua aprovação para prosseguir.
@endif

**Detalhes:**
- **OS:** {{ $wo->business_number }}
- **Valor Total:** R$ {{ number_format((float) $wo->total, 2, ',', '.') }}

Obrigado pela confiança!

{{ config('app.name') }}
@endcomponent

