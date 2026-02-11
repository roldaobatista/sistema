@component('mail::message')
# Orcamento Pronto

Ola, **{{ $customerName }}**!

O seu orcamento **#{{ $quote->quote_number }}** esta pronto para analise.

**Valor Total:** R$ {{ $total }}

@component('mail::button', ['url' => $approvalUrl])
Ver Orçamento
@endcomponent

Ficamos a disposicao para esclarecer quaisquer duvidas.

Obrigado pela confianca!

{{ config('app.name') }}
@endcomponent
