<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use App\Models\Tenant;

/**
 * Builds the complete JSON payload for NFS-e emission via Focus NFe API.
 * Supports city-specific configurations:
 *   - Rondonópolis/MT (ABRASF 2.03)
 *   - Campo Grande/MS (DSF)
 *   - Generic (default ABRASF format)
 */
class NFSeDataBuilder
{
    private Tenant $tenant;
    private FiscalNote $note;
    private array $services;
    private array $options;

    public function __construct(Tenant $tenant, FiscalNote $note, array $services, array $options = [])
    {
        $this->tenant = $tenant;
        $this->note = $note;
        $this->services = $services;
        $this->options = $options;
    }

    /**
     * Build the complete NFS-e payload for Focus NFe.
     */
    public function build(): array
    {
        $city = $this->tenant->fiscal_nfse_city ?? 'generic';

        $payload = match ($city) {
            'rondonopolis' => $this->buildRondonopolis(),
            'campo_grande' => $this->buildCampoGrande(),
            default => $this->buildGeneric(),
        };

        // Common fields across all cities
        $payload['numero_rps'] = (string) $this->note->number;
        $payload['serie_rps'] = (string) ($this->note->series ?? 'RPS');
        $payload['tipo_rps'] = '1'; // 1=RPS

        if (!empty($this->options['data_emissao'])) {
            $payload['data_emissao'] = $this->options['data_emissao'];
        }

        return $payload;
    }

    /**
     * Rondonópolis/MT — ABRASF 2.03
     * Uses municipal NFS-e token, supports homologation environment.
     */
    private function buildRondonopolis(): array
    {
        $payload = $this->buildGeneric();

        // Rondonópolis specifics
        $payload['codigo_municipio_prestacao'] = '5107602'; // IBGE Rondonópolis
        $payload['municipio_prestacao_servico'] = 'Rondonópolis';
        $payload['uf_prestacao_servico'] = 'MT';

        // ABRASF 2.03 requires regime_especial_tributacao
        $payload['regime_especial_tributacao'] = $this->mapRegimeEspecial();

        // Optante Simples Nacional
        $payload['optante_simples_nacional'] = in_array($this->tenant->fiscal_regime, [1, 4]) ? '1' : '2';

        // Incentivador cultural (usually no)
        $payload['incentivador_cultural'] = '2'; // 2=Não

        // Nature of taxation (exigibilidade)
        $payload['natureza_tributacao'] = $this->options['natureza_tributacao'] ?? '1'; // 1=Exigível

        return $payload;
    }

    /**
     * Campo Grande/MS — DSF
     * No homologation environment available. Extra caution required.
     */
    private function buildCampoGrande(): array
    {
        $payload = $this->buildGeneric();

        // Campo Grande specifics
        $payload['codigo_municipio_prestacao'] = '5002704'; // IBGE Campo Grande
        $payload['municipio_prestacao_servico'] = 'Campo Grande';
        $payload['uf_prestacao_servico'] = 'MS';

        // DSF requires credentiamento via lote
        $payload['optante_simples_nacional'] = in_array($this->tenant->fiscal_regime, [1, 4]) ? '1' : '2';
        $payload['regime_especial_tributacao'] = $this->mapRegimeEspecial();

        // DSF-specific: situacao_tributaria
        $payload['status'] = $this->options['status'] ?? 'S'; // S=normal

        return $payload;
    }

    /**
     * Generic ABRASF format (works for most cities).
     */
    private function buildGeneric(): array
    {
        return [
            'prestador' => $this->buildPrestador(),
            'tomador' => $this->buildTomador(),
            'servico' => $this->buildServico(),
        ];
    }

    /**
     * Build service provider (prestador) data from tenant.
     */
    private function buildPrestador(): array
    {
        $cnpj = preg_replace('/\D/', '', $this->tenant->document ?? '');

        return [
            'cnpj' => $cnpj,
            'inscricao_municipal' => $this->tenant->city_registration ?? '',
            'razao_social' => $this->tenant->name,
            'nome_fantasia' => $this->tenant->trade_name ?? $this->tenant->name,
            'endereco' => [
                'logradouro' => $this->tenant->address_street ?? '',
                'numero' => $this->tenant->address_number ?? 'S/N',
                'complemento' => $this->tenant->address_complement ?? '',
                'bairro' => $this->tenant->address_neighborhood ?? '',
                'cidade' => $this->tenant->address_city ?? '',
                'uf' => $this->tenant->address_state ?? '',
                'cep' => preg_replace('/\D/', '', $this->tenant->address_zip ?? ''),
            ],
            'telefone' => preg_replace('/\D/', '', $this->tenant->phone ?? ''),
            'email' => $this->tenant->email ?? '',
        ];
    }

    /**
     * Build service taker (tomador) data from customer.
     */
    private function buildTomador(): array
    {
        $customer = $this->note->customer;

        if (!$customer) {
            return [];
        }

        $doc = preg_replace('/\D/', '', $customer->document ?? $customer->cpf_cnpj ?? '');
        $isPJ = strlen($doc) === 14;

        $tomador = [
            'razao_social' => $customer->company_name ?? $customer->name,
            'email' => $customer->email ?? null,
            'telefone' => preg_replace('/\D/', '', $customer->phone ?? ''),
        ];

        if ($isPJ) {
            $tomador['cnpj'] = $doc;
            if (!empty($customer->city_registration)) {
                $tomador['inscricao_municipal'] = $customer->city_registration;
            }
        } else {
            $tomador['cpf'] = $doc;
        }

        $tomador['endereco'] = [
            'logradouro' => $customer->address ?? $customer->address_street ?? '',
            'numero' => $customer->address_number ?? 'S/N',
            'complemento' => $customer->address_complement ?? '',
            'bairro' => $customer->neighborhood ?? $customer->address_neighborhood ?? '',
            'codigo_municipio' => $customer->city_code ?? null,
            'cidade' => $customer->city ?? $customer->address_city ?? '',
            'uf' => $customer->state ?? $customer->address_state ?? '',
            'cep' => preg_replace('/\D/', '', $customer->zip_code ?? $customer->address_zip ?? ''),
        ];

        return $tomador;
    }

    /**
     * Build service data with ISS details.
     */
    private function buildServico(): array
    {
        $totalAmount = collect($this->services)->sum(fn ($s) => (float) ($s['amount'] ?? 0));
        $totalDeductions = collect($this->services)->sum(fn ($s) => (float) ($s['deductions'] ?? 0));
        $totalDiscounts = collect($this->services)->sum(fn ($s) => (float) ($s['discount'] ?? 0));

        // Build discriminacao (service description)
        $descriptions = collect($this->services)->map(function ($s) {
            $desc = $s['description'];
            if (!empty($s['quantity']) && $s['quantity'] > 1) {
                $desc = "{$s['quantity']}x {$desc}";
            }
            if (!empty($s['amount'])) {
                $desc .= ' - R$ ' . number_format((float) $s['amount'], 2, ',', '.');
            }
            return $desc;
        })->implode("\n");

        $servico = [
            'discriminacao' => $descriptions,
            'valor_servicos' => number_format($totalAmount, 2, '.', ''),
            'valor_liquido_nfse' => number_format($totalAmount - $totalDeductions - $totalDiscounts, 2, '.', ''),
        ];

        // ISS
        $issRate = (float) ($this->services[0]['iss_rate'] ?? $this->options['iss_rate'] ?? 0);
        $issRetained = $this->services[0]['iss_retained'] ?? $this->options['iss_retained'] ?? false;

        $servico['iss_retido'] = $issRetained ? '1' : '2'; // 1=retido, 2=não retido
        $servico['aliquota'] = number_format($issRate / 100, 4, '.', '');

        $issValue = $totalAmount * $issRate / 100;
        $servico['valor_iss'] = number_format($issValue, 2, '.', '');
        $servico['base_calculo'] = number_format($totalAmount - $totalDeductions, 2, '.', '');

        if ($issRetained) {
            $servico['valor_iss_retido'] = number_format($issValue, 2, '.', '');
        }

        // ISS exigibilidade
        $servico['exigibilidade_iss'] = $this->options['exigibilidade_iss'] ?? '1'; // 1=Exigível

        // Código do serviço (LC 116)
        $serviceCode = $this->services[0]['service_code']
            ?? $this->services[0]['lc116_code']
            ?? $this->options['service_code']
            ?? null;

        if ($serviceCode) {
            $servico['item_lista_servico'] = $serviceCode;
        }

        // Código tributário municipal
        $municipalCode = $this->services[0]['municipal_service_code']
            ?? $this->options['municipal_service_code']
            ?? null;

        if ($municipalCode) {
            $servico['codigo_tributario_municipio'] = $municipalCode;
        }

        // CNAE related to the service
        $cnae = $this->services[0]['cnae_code']
            ?? $this->tenant->cnae_code
            ?? null;

        if ($cnae) {
            $servico['codigo_cnae'] = $cnae;
        }

        // Deductions
        if ($totalDeductions > 0) {
            $servico['valor_deducoes'] = number_format($totalDeductions, 2, '.', '');
        }

        // Discounts
        if ($totalDiscounts > 0) {
            $servico['desconto_incondicionado'] = number_format($totalDiscounts, 2, '.', '');
        }

        // Other taxes (PIS, COFINS, INSS, IR, CSLL)
        $this->addOtherTaxes($servico);

        // Additional info
        if (!empty($this->options['informacoes_complementares'])) {
            $servico['outras_informacoes'] = $this->options['informacoes_complementares'];
        }

        return $servico;
    }

    /**
     * Add federal tax retentions (PIS, COFINS, INSS, IR, CSLL).
     */
    private function addOtherTaxes(array &$servico): void
    {
        $totalAmount = (float) $servico['valor_servicos'];

        // PIS retention
        $pisRate = (float) ($this->options['pis_rate'] ?? 0);
        if ($pisRate > 0) {
            $servico['valor_pis'] = number_format($totalAmount * $pisRate / 100, 2, '.', '');
        }

        // COFINS retention
        $cofinsRate = (float) ($this->options['cofins_rate'] ?? 0);
        if ($cofinsRate > 0) {
            $servico['valor_cofins'] = number_format($totalAmount * $cofinsRate / 100, 2, '.', '');
        }

        // INSS retention
        $inssRate = (float) ($this->options['inss_rate'] ?? 0);
        if ($inssRate > 0) {
            $servico['valor_inss'] = number_format($totalAmount * $inssRate / 100, 2, '.', '');
        }

        // IR retention
        $irRate = (float) ($this->options['ir_rate'] ?? 0);
        if ($irRate > 0) {
            $servico['valor_ir'] = number_format($totalAmount * $irRate / 100, 2, '.', '');
        }

        // CSLL retention
        $csllRate = (float) ($this->options['csll_rate'] ?? 0);
        if ($csllRate > 0) {
            $servico['valor_csll'] = number_format($totalAmount * $csllRate / 100, 2, '.', '');
        }
    }

    /**
     * Map tenant fiscal regime to NFS-e regime especial tributação.
     * 1=Microempresa Municipal
     * 2=Estimativa
     * 3=Sociedade de Profissionais
     * 4=Cooperativa
     * 5=MEI
     * 6=ME/EPP Simples Nacional
     */
    private function mapRegimeEspecial(): string
    {
        return match ($this->tenant->fiscal_regime) {
            4 => '5',  // MEI
            1 => '6',  // Simples Nacional → ME/EPP
            default => '0',  // Nenhum
        };
    }
}
