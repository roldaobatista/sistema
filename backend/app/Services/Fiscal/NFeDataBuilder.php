<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use App\Models\Tenant;

/**
 * Builds the complete JSON payload for NF-e emission via Focus NFe API.
 * Handles emitter data, recipient data, items with full tax fields,
 * totals, transport, and payment information.
 */
class NFeDataBuilder
{
    private Tenant $tenant;
    private FiscalNote $note;
    private array $items;
    private array $options;

    public function __construct(Tenant $tenant, FiscalNote $note, array $items, array $options = [])
    {
        $this->tenant = $tenant;
        $this->note = $note;
        $this->items = $items;
        $this->options = $options;
    }

    /**
     * Build the complete NF-e payload for Focus NFe.
     */
    public function build(): array
    {
        $payload = [
            'natureza_operacao' => $this->note->nature_of_operation ?? 'Venda de mercadoria',
            'forma_pagamento' => $this->options['forma_pagamento'] ?? '0', // 0=à vista, 1=a prazo
            'tipo_documento' => '1', // 1=saída
            'finalidade_emissao' => $this->options['finalidade_emissao'] ?? '1', // 1=normal
            'consumidor_final' => $this->isConsumerFinal() ? '1' : '0',
            'presenca_comprador' => $this->options['presenca_comprador'] ?? '1', // 1=presencial
        ];

        $payload = array_merge($payload, $this->buildEmitente());
        $payload = array_merge($payload, $this->buildDestinatario());
        $payload['items'] = $this->buildItems();
        $payload = array_merge($payload, $this->buildFormasPagamento());

        if (!empty($this->options['informacoes_complementares'])) {
            $payload['informacoes_adicionais_contribuinte'] = $this->options['informacoes_complementares'];
        }

        return $payload;
    }

    /**
     * Build emitter (tenant) data.
     */
    private function buildEmitente(): array
    {
        $cnpj = preg_replace('/\D/', '', $this->tenant->document ?? '');

        return [
            'cnpj_emitente' => $cnpj,
            'inscricao_estadual' => $this->tenant->state_registration ?? '',
            'regime_tributario' => $this->mapRegimeTributario(),
        ];
    }

    /**
     * Build recipient (customer) data.
     */
    private function buildDestinatario(): array
    {
        $customer = $this->note->customer;

        if (!$customer) {
            return [];
        }

        $doc = preg_replace('/\D/', '', $customer->document ?? $customer->cpf_cnpj ?? '');
        $isPJ = strlen($doc) === 14;

        $dest = [
            'nome_destinatario' => $customer->company_name ?? $customer->name,
        ];

        if ($isPJ) {
            $dest['cnpj_destinatario'] = $doc;
        } else {
            $dest['cpf_destinatario'] = $doc;
        }

        if ($isPJ && !empty($customer->state_registration)) {
            $ie = trim($customer->state_registration);
            $dest['inscricao_estadual_destinatario'] = ($ie === 'ISENTO' || strtolower($ie) === 'isento')
                ? 'ISENTO'
                : $ie;
            $dest['indicador_inscricao_estadual_destinatario'] = ($ie === 'ISENTO')
                ? '2' // isento
                : '1'; // contribuinte
        } else {
            $dest['indicador_inscricao_estadual_destinatario'] = '9'; // não contribuinte
        }

        $dest['email_destinatario'] = $customer->email ?? null;
        $dest['telefone_destinatario'] = preg_replace('/\D/', '', $customer->phone ?? '');

        // Address
        $dest['logradouro_destinatario'] = $customer->address ?? $customer->address_street ?? '';
        $dest['numero_destinatario'] = $customer->address_number ?? 'S/N';
        $dest['complemento_destinatario'] = $customer->address_complement ?? '';
        $dest['bairro_destinatario'] = $customer->neighborhood ?? $customer->address_neighborhood ?? '';
        $dest['municipio_destinatario'] = $customer->city ?? $customer->address_city ?? '';
        $dest['uf_destinatario'] = $customer->state ?? $customer->address_state ?? '';
        $dest['cep_destinatario'] = preg_replace('/\D/', '', $customer->zip_code ?? $customer->address_zip ?? '');
        $dest['pais_destinatario'] = 'Brasil';

        if (!empty($customer->city_code)) {
            $dest['codigo_municipio_destinatario'] = $customer->city_code;
        }

        return $dest;
    }

    /**
     * Build items with complete tax fields (ICMS, PIS, COFINS, IPI).
     */
    private function buildItems(): array
    {
        $isSimplesNacional = in_array($this->tenant->fiscal_regime, [1, 4]); // 1=SN, 4=MEI
        $defaultCfop = $this->note->cfop ?? $this->options['cfop'] ?? '5933';

        return collect($this->items)->map(function ($item, $idx) use ($isSimplesNacional, $defaultCfop) {
            $quantity = (float) ($item['quantity'] ?? 1);
            $unitPrice = (float) ($item['unit_price'] ?? 0);
            $totalValue = round($quantity * $unitPrice, 2);
            $discount = (float) ($item['discount'] ?? 0);

            $built = [
                'numero_item' => $idx + 1,
                'codigo_produto' => $item['code'] ?? (string) ($idx + 1),
                'descricao' => $item['description'],
                'quantidade_comercial' => number_format($quantity, 4, '.', ''),
                'quantidade_tributavel' => number_format($quantity, 4, '.', ''),
                'valor_unitario_comercial' => number_format($unitPrice, 10, '.', ''),
                'valor_unitario_tributavel' => number_format($unitPrice, 10, '.', ''),
                'valor_bruto' => number_format($totalValue, 2, '.', ''),
                'unidade_comercial' => $item['unit'] ?? 'UN',
                'unidade_tributavel' => $item['unit'] ?? 'UN',
                'codigo_ncm' => $item['ncm'] ?? '00000000',
                'cfop' => $item['cfop'] ?? $defaultCfop,
            ];

            if ($discount > 0) {
                $built['valor_desconto'] = number_format($discount, 2, '.', '');
            }

            // CEST (optional)
            if (!empty($item['cest'])) {
                $built['codigo_cest'] = $item['cest'];
            }

            // ICMS
            $built = array_merge($built, $this->buildIcms($item, $isSimplesNacional, $totalValue));

            // PIS
            $built = array_merge($built, $this->buildPis($item, $isSimplesNacional));

            // COFINS
            $built = array_merge($built, $this->buildCofins($item, $isSimplesNacional));

            // IPI (optional, for industrial products)
            if (!empty($item['ipi_cst']) || !empty($item['ipi_rate'])) {
                $built = array_merge($built, $this->buildIpi($item, $totalValue));
            }

            return $built;
        })->toArray();
    }

    /**
     * Build ICMS tax fields for an item.
     */
    private function buildIcms(array $item, bool $isSimplesNacional, float $totalValue): array
    {
        if ($isSimplesNacional) {
            $csosn = $item['csosn'] ?? '102';

            $icms = [
                'icms_origem' => $item['icms_origin'] ?? '0', // 0=nacional
                'icms_situacao_tributaria' => $csosn,
            ];

            // CSOSN 101: with credit allowance
            if ($csosn === '101') {
                $rate = (float) ($item['icms_credit_rate'] ?? 0);
                $icms['icms_aliquota_credito_simples_nacional'] = number_format($rate, 2, '.', '');
                $icms['icms_valor_credito_simples_nacional'] = number_format($totalValue * $rate / 100, 2, '.', '');
            }

            // CSOSN 500: previously collected via ST
            if ($csosn === '500') {
                $icms['icms_base_calculo_retido_st'] = number_format(
                    (float) ($item['icms_st_base'] ?? 0), 2, '.', ''
                );
                $icms['icms_valor_retido_st'] = number_format(
                    (float) ($item['icms_st_value'] ?? 0), 2, '.', ''
                );
            }

            // CSOSN 900: other - requires full calculation
            if ($csosn === '900') {
                $rate = (float) ($item['icms_rate'] ?? 0);
                if ($rate > 0) {
                    $icms['icms_base_calculo'] = number_format($totalValue, 2, '.', '');
                    $icms['icms_aliquota'] = number_format($rate, 2, '.', '');
                    $icms['icms_valor'] = number_format($totalValue * $rate / 100, 2, '.', '');
                }
            }

            return $icms;
        }

        // Non-SN: regular CST
        $cst = $item['icms_cst'] ?? '00';
        $rate = (float) ($item['icms_rate'] ?? 0);

        $icms = [
            'icms_origem' => $item['icms_origin'] ?? '0',
            'icms_situacao_tributaria' => $cst,
            'icms_modalidade_base_calculo' => '0', // 0=margem valor agregado
        ];

        if (in_array($cst, ['00', '10', '20', '70', '90']) && $rate > 0) {
            $icms['icms_base_calculo'] = number_format($totalValue, 2, '.', '');
            $icms['icms_aliquota'] = number_format($rate, 2, '.', '');
            $icms['icms_valor'] = number_format($totalValue * $rate / 100, 2, '.', '');
        }

        return $icms;
    }

    /**
     * Build PIS tax fields.
     */
    private function buildPis(array $item, bool $isSimplesNacional): array
    {
        if ($isSimplesNacional) {
            return [
                'pis_situacao_tributaria' => '99', // outras operações
                'pis_base_calculo' => '0.00',
                'pis_aliquota_porcentual' => '0.00',
                'pis_valor' => '0.00',
            ];
        }

        $cst = $item['pis_cst'] ?? '07'; // 07=isento
        $rate = (float) ($item['pis_rate'] ?? 0);
        $base = (float) ($item['quantity'] ?? 1) * (float) ($item['unit_price'] ?? 0);

        return [
            'pis_situacao_tributaria' => $cst,
            'pis_base_calculo' => number_format($base, 2, '.', ''),
            'pis_aliquota_porcentual' => number_format($rate, 2, '.', ''),
            'pis_valor' => number_format($base * $rate / 100, 2, '.', ''),
        ];
    }

    /**
     * Build COFINS tax fields.
     */
    private function buildCofins(array $item, bool $isSimplesNacional): array
    {
        if ($isSimplesNacional) {
            return [
                'cofins_situacao_tributaria' => '99',
                'cofins_base_calculo' => '0.00',
                'cofins_aliquota_porcentual' => '0.00',
                'cofins_valor' => '0.00',
            ];
        }

        $cst = $item['cofins_cst'] ?? '07'; // 07=isento
        $rate = (float) ($item['cofins_rate'] ?? 0);
        $base = (float) ($item['quantity'] ?? 1) * (float) ($item['unit_price'] ?? 0);

        return [
            'cofins_situacao_tributaria' => $cst,
            'cofins_base_calculo' => number_format($base, 2, '.', ''),
            'cofins_aliquota_porcentual' => number_format($rate, 2, '.', ''),
            'cofins_valor' => number_format($base * $rate / 100, 2, '.', ''),
        ];
    }

    /**
     * Build IPI tax fields (optional).
     */
    private function buildIpi(array $item, float $totalValue): array
    {
        $cst = $item['ipi_cst'] ?? '53'; // 53=saída não tributada
        $rate = (float) ($item['ipi_rate'] ?? 0);

        $ipi = [
            'ipi_situacao_tributaria' => $cst,
            'ipi_codigo_enquadramento' => $item['ipi_enquadramento'] ?? '999',
        ];

        if (in_array($cst, ['00', '49', '50', '99']) && $rate > 0) {
            $ipi['ipi_base_calculo'] = number_format($totalValue, 2, '.', '');
            $ipi['ipi_aliquota'] = number_format($rate, 2, '.', '');
            $ipi['ipi_valor'] = number_format($totalValue * $rate / 100, 2, '.', '');
        }

        return $ipi;
    }

    /**
     * Build payment information.
     */
    private function buildFormasPagamento(): array
    {
        $totalAmount = collect($this->items)->sum(function ($item) {
            $qty = (float) ($item['quantity'] ?? 1);
            $price = (float) ($item['unit_price'] ?? 0);
            $discount = (float) ($item['discount'] ?? 0);
            return round($qty * $price - $discount, 2);
        });

        $paymentMethod = $this->options['payment_method'] ?? '99'; // 99=outros

        return [
            'formas_pagamento' => [
                [
                    'forma_pagamento' => $paymentMethod,
                    'valor_pagamento' => number_format($totalAmount, 2, '.', ''),
                ],
            ],
        ];
    }

    /**
     * Determine if the customer is a final consumer (non-contributor).
     */
    private function isConsumerFinal(): bool
    {
        $customer = $this->note->customer;

        if (!$customer) {
            return true;
        }

        $doc = preg_replace('/\D/', '', $customer->document ?? $customer->cpf_cnpj ?? '');

        // CPF = always final consumer
        if (strlen($doc) === 11) {
            return true;
        }

        // PJ without state registration = final consumer
        $ie = $customer->state_registration ?? null;
        return empty($ie) || strtolower(trim($ie)) === 'isento';
    }

    /**
     * Map tenant fiscal_regime to NF-e regime tributário code.
     */
    private function mapRegimeTributario(): string
    {
        return match ($this->tenant->fiscal_regime) {
            1 => '1', // Simples Nacional
            4 => '1', // MEI (subset of SN)
            2 => '3', // Lucro Presumido → Regime Normal
            3 => '3', // Lucro Real → Regime Normal
            default => '1',
        };
    }
}
