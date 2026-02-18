<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use App\Models\Tenant;
use Illuminate\Support\Facades\Log;

/**
 * Advanced NF-e operations: devolução (#11), complementar (#12),
 * remessa/retorno (#13), MDF-e (#14), CT-e (#15).
 */
class FiscalAdvancedService
{
    public function __construct(
        private FiscalProvider $provider,
        private FiscalNumberingService $numbering,
    ) {}

    /**
     * #11 — Issue a return (devolução) NF-e referencing the original.
     */
    public function emitirDevolucao(FiscalNote $original, array $items, int $userId): array
    {
        if (! $original->isAuthorized()) {
            return ['success' => false, 'error' => 'Nota original não está autorizada'];
        }
        if (! $original->isNFe()) {
            return ['success' => false, 'error' => 'Devolução só é permitida para NF-e'];
        }

        $tenant = $original->tenant;
        $numbering = $this->numbering->nextNFeNumber($tenant);
        $reference = FiscalNote::generateReference('nfe', $tenant->id);

        $note = FiscalNote::create([
            'tenant_id' => $tenant->id,
            'type' => 'nfe_devolucao',
            'parent_note_id' => $original->id,
            'customer_id' => $original->customer_id,
            'number' => $numbering['number'],
            'series' => $numbering['series'],
            'reference' => $reference,
            'status' => FiscalNote::STATUS_PROCESSING,
            'provider' => 'focus_nfe',
            'total_amount' => collect($items)->sum(fn($i) => ($i['valor_unitario'] ?? 0) * ($i['quantidade'] ?? 1)),
            'items_data' => $items,
            'nature_of_operation' => 'Devolução de mercadoria',
            'cfop' => '5202',
            'issued_at' => now(),
            'created_by' => $userId,
        ]);

        return $this->emitAndUpdate($note, 'nfe', [
            'ref' => $reference,
            'items' => $items,
            'nfe_referenciada' => $original->access_key,
            'natureza_operacao' => 'Devolução de mercadoria',
            'finalidade_emissao' => '4', // 4 = devolução
        ]);
    }

    /**
     * #12 — Issue a complementary NF-e for value/tax adjustments.
     */
    public function emitirComplementar(FiscalNote $original, array $adjustments, int $userId): array
    {
        if (! $original->isAuthorized() || ! $original->isNFe()) {
            return ['success' => false, 'error' => 'Nota original inválida para complementar'];
        }

        $tenant = $original->tenant;
        $numbering = $this->numbering->nextNFeNumber($tenant);
        $reference = FiscalNote::generateReference('nfe', $tenant->id);

        $note = FiscalNote::create([
            'tenant_id' => $tenant->id,
            'type' => 'nfe_complementar',
            'parent_note_id' => $original->id,
            'customer_id' => $original->customer_id,
            'number' => $numbering['number'],
            'series' => $numbering['series'],
            'reference' => $reference,
            'status' => FiscalNote::STATUS_PROCESSING,
            'provider' => 'focus_nfe',
            'total_amount' => $adjustments['valor_complementar'] ?? 0,
            'items_data' => $adjustments['items'] ?? [],
            'nature_of_operation' => 'NF-e Complementar',
            'issued_at' => now(),
            'created_by' => $userId,
        ]);

        return $this->emitAndUpdate($note, 'nfe', [
            'ref' => $reference,
            'nfe_referenciada' => $original->access_key,
            'natureza_operacao' => 'NF-e Complementar',
            'finalidade_emissao' => '2', // 2 = complementar
            'items' => $adjustments['items'] ?? [],
        ]);
    }

    /**
     * #13 — Issue a remittance NF-e (loan/repair of equipment).
     */
    public function emitirRemessa(array $data, Tenant $tenant, int $userId): array
    {
        $numbering = $this->numbering->nextNFeNumber($tenant);
        $reference = FiscalNote::generateReference('nfe', $tenant->id);

        $note = FiscalNote::create([
            'tenant_id' => $tenant->id,
            'type' => 'nfe_remessa',
            'customer_id' => $data['customer_id'],
            'number' => $numbering['number'],
            'series' => $numbering['series'],
            'reference' => $reference,
            'status' => FiscalNote::STATUS_PROCESSING,
            'provider' => 'focus_nfe',
            'total_amount' => collect($data['items'])->sum(fn($i) => ($i['valor_unitario'] ?? 0) * ($i['quantidade'] ?? 1)),
            'items_data' => $data['items'],
            'nature_of_operation' => $data['natureza'] ?? 'Remessa para conserto',
            'cfop' => $data['cfop'] ?? '5915',
            'issued_at' => now(),
            'created_by' => $userId,
        ]);

        return $this->emitAndUpdate($note, 'nfe', [
            'ref' => $reference,
            'items' => $data['items'],
            'natureza_operacao' => $data['natureza'] ?? 'Remessa para conserto',
            'cfop' => $data['cfop'] ?? '5915',
        ]);
    }

    /**
     * #13b — Issue a return NF-e referencing the remittance.
     */
    public function emitirRetorno(FiscalNote $remessa, array $items, int $userId): array
    {
        if ($remessa->type !== 'nfe_remessa' || ! $remessa->isAuthorized()) {
            return ['success' => false, 'error' => 'Nota de remessa inválida'];
        }

        $tenant = $remessa->tenant;
        $numbering = $this->numbering->nextNFeNumber($tenant);
        $reference = FiscalNote::generateReference('nfe', $tenant->id);

        $note = FiscalNote::create([
            'tenant_id' => $tenant->id,
            'type' => 'nfe_retorno',
            'parent_note_id' => $remessa->id,
            'customer_id' => $remessa->customer_id,
            'number' => $numbering['number'],
            'series' => $numbering['series'],
            'reference' => $reference,
            'status' => FiscalNote::STATUS_PROCESSING,
            'provider' => 'focus_nfe',
            'total_amount' => collect($items)->sum(fn($i) => ($i['valor_unitario'] ?? 0) * ($i['quantidade'] ?? 1)),
            'items_data' => $items,
            'nature_of_operation' => 'Retorno de conserto',
            'cfop' => '5916',
            'issued_at' => now(),
            'created_by' => $userId,
        ]);

        return $this->emitAndUpdate($note, 'nfe', [
            'ref' => $reference,
            'items' => $items,
            'nfe_referenciada' => $remessa->access_key,
            'natureza_operacao' => 'Retorno de conserto',
            'cfop' => '5916',
        ]);
    }

    /**
     * #14 — Manifesto do Destinatário (MDFe).
     */
    public function manifestarDestinatario(string $chaveAcesso, string $tipoManifestacao, Tenant $tenant): array
    {
        $validTypes = ['ciencia', 'confirmacao', 'desconhecimento', 'nao_realizada'];
        if (! in_array($tipoManifestacao, $validTypes)) {
            return ['success' => false, 'error' => 'Tipo de manifestação inválido'];
        }

        try {
            // Map to Focus NFe API format
            $typeMap = [
                'ciencia' => '210210',
                'confirmacao' => '210200',
                'desconhecimento' => '210220',
                'nao_realizada' => '210240',
            ];

            $result = $this->provider->emitirNFe([
                'tipo' => 'manifestacao',
                'chave_nfe' => $chaveAcesso,
                'tipo_manifestacao' => $typeMap[$tipoManifestacao],
            ]);

            return [
                'success' => $result->success,
                'message' => $result->success ? 'Manifestação registrada' : $result->errorMessage,
                'protocol' => $result->protocolNumber,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * #15 — Issue a CT-e (Conhecimento de Transporte Eletrônico).
     */
    public function emitirCTe(array $data, Tenant $tenant, int $userId): array
    {
        $numbering = $this->numbering->nextNFeNumber($tenant);
        $reference = FiscalNote::generateReference('cte', $tenant->id);

        $note = FiscalNote::create([
            'tenant_id' => $tenant->id,
            'type' => 'cte',
            'customer_id' => $data['customer_id'],
            'number' => $numbering['number'],
            'series' => $numbering['series'],
            'reference' => $reference,
            'status' => FiscalNote::STATUS_PROCESSING,
            'provider' => 'focus_nfe',
            'total_amount' => $data['valor_total'] ?? 0,
            'items_data' => $data,
            'nature_of_operation' => 'Prestação de serviço de transporte',
            'issued_at' => now(),
            'created_by' => $userId,
        ]);

        return $this->emitAndUpdate($note, 'nfe', [
            'ref' => $reference,
            'tipo' => 'cte',
            ...$data,
        ]);
    }

    private function emitAndUpdate(FiscalNote $note, string $method, array $data): array
    {
        try {
            $result = $method === 'nfe'
                ? $this->provider->emitirNFe($data)
                : $this->provider->emitirNFSe($data);

            $note->update([
                'status' => $result->success ? FiscalNote::STATUS_AUTHORIZED : FiscalNote::STATUS_REJECTED,
                'provider_id' => $result->providerId,
                'access_key' => $result->accessKey,
                'error_message' => $result->errorMessage,
                'raw_response' => $result->rawResponse,
            ]);

            return ['success' => $result->success, 'note_id' => $note->id, 'note' => $note->fresh()];
        } catch (\Exception $e) {
            $note->update(['status' => FiscalNote::STATUS_REJECTED, 'error_message' => $e->getMessage()]);
            Log::error('FiscalAdvanced: emit failed', ['note_id' => $note->id, 'error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage(), 'note_id' => $note->id];
        }
    }
}
