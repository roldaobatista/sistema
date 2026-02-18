<?php

namespace App\Services\Fiscal;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Focus NFe API provider implementation.
 *
 * REST/JSON API with token authentication.
 * Handles NF-e (model 55) and NFS-e emission via Focus NFe platform.
 *
 * @see https://focusnfe.com.br/doc/
 */
class FocusNFeProvider implements FiscalProvider
{
    private string $baseUrl;
    private string $token;

    public function __construct()
    {
        $environment = config('services.focusnfe.environment', 'homologation');
        $this->token = (string) config('services.focusnfe.token', '');

        $this->baseUrl = $environment === 'production'
            ? rtrim((string) config('services.focusnfe.url_production', 'https://api.focusnfe.com.br'), '/')
            : rtrim((string) config('services.focusnfe.url_homologation', 'https://homologacao.focusnfe.com.br'), '/');
    }

    public function emitirNFe(array $data): FiscalResult
    {
        try {
            $ref = $data['ref'] ?? uniqid('nfe_');

            $response = $this->request()
                ->post("{$this->baseUrl}/v2/nfe?ref={$ref}", $data);

            if ($response->successful()) {
                $body = $response->json();

                return $this->handleNFeResponse($body, $ref);
            }

            return $this->handleError('NF-e', $response);
        } catch (\Exception $e) {
            Log::error('FocusNFe NF-e exception', ['error' => $e->getMessage()]);
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function emitirNFSe(array $data): FiscalResult
    {
        try {
            $ref = $data['ref'] ?? uniqid('nfse_');

            $response = $this->request()
                ->post("{$this->baseUrl}/v2/nfse?ref={$ref}", $data);

            if ($response->successful()) {
                $body = $response->json();

                return FiscalResult::ok([
                    'provider_id' => $body['id'] ?? $ref,
                    'reference' => $ref,
                    'status' => $this->mapStatus($body['status'] ?? ''),
                    'raw' => $body,
                ]);
            }

            return $this->handleError('NFS-e', $response);
        } catch (\Exception $e) {
            Log::error('FocusNFe NFS-e exception', ['error' => $e->getMessage()]);
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function consultarStatus(string $referencia): FiscalResult
    {
        try {
            $response = $this->request()
                ->get("{$this->baseUrl}/v2/nfe/{$referencia}");

            if ($response->successful()) {
                $body = $response->json();

                return FiscalResult::ok([
                    'reference' => $referencia,
                    'access_key' => $body['chave_nfe'] ?? null,
                    'number' => (string) ($body['numero'] ?? ''),
                    'series' => (string) ($body['serie'] ?? ''),
                    'status' => $this->mapStatus($body['status'] ?? ''),
                    'protocol_number' => $body['protocolo'] ?? null,
                    'pdf_url' => $body['caminho_danfe'] ?? null,
                    'xml_url' => $body['caminho_xml_nota_fiscal'] ?? null,
                    'raw' => $body,
                ]);
            }

            return FiscalResult::fail('Erro ao consultar: ' . $response->body());
        } catch (\Exception $e) {
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function cancelar(string $referencia, string $justificativa): FiscalResult
    {
        try {
            $response = $this->request()
                ->delete("{$this->baseUrl}/v2/nfe/{$referencia}", [
                    'justificativa' => $justificativa,
                ]);

            if ($response->successful()) {
                $body = $response->json();

                return FiscalResult::ok([
                    'reference' => $referencia,
                    'status' => 'cancelled',
                    'event_type' => 'cancellation',
                    'protocol_number' => $body['protocolo'] ?? null,
                    'raw' => $body,
                ]);
            }

            return $this->handleError('Cancelamento', $response);
        } catch (\Exception $e) {
            Log::error('FocusNFe cancel exception', ['error' => $e->getMessage()]);
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function inutilizar(array $data): FiscalResult
    {
        try {
            $response = $this->request()
                ->post("{$this->baseUrl}/v2/nfe/inutilizacao", [
                    'cnpj' => $data['cnpj'],
                    'serie' => $data['serie'],
                    'numero_inicial' => $data['numero_inicial'],
                    'numero_final' => $data['numero_final'],
                    'justificativa' => $data['justificativa'],
                    'modelo' => $data['modelo'] ?? '55',
                ]);

            if ($response->successful()) {
                $body = $response->json();

                return FiscalResult::ok([
                    'status' => $this->mapStatus($body['status'] ?? ''),
                    'event_type' => 'inutilization',
                    'protocol_number' => $body['protocolo'] ?? null,
                    'raw' => $body,
                ]);
            }

            return $this->handleError('Inutilização', $response);
        } catch (\Exception $e) {
            Log::error('FocusNFe inutilização exception', ['error' => $e->getMessage()]);
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function cartaCorrecao(string $referencia, string $correcao): FiscalResult
    {
        try {
            $response = $this->request()
                ->post("{$this->baseUrl}/v2/nfe/{$referencia}/carta_correcao", [
                    'correcao' => $correcao,
                ]);

            if ($response->successful()) {
                $body = $response->json();

                return FiscalResult::ok([
                    'reference' => $referencia,
                    'status' => 'authorized',
                    'event_type' => 'correction',
                    'correction_text' => $correcao,
                    'protocol_number' => $body['protocolo'] ?? null,
                    'raw' => $body,
                ]);
            }

            return $this->handleError('Carta de Correção', $response);
        } catch (\Exception $e) {
            Log::error('FocusNFe CC-e exception', ['error' => $e->getMessage()]);
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function consultarStatusServico(string $uf): FiscalResult
    {
        try {
            $response = $this->request()
                ->get("{$this->baseUrl}/v2/nfe/sefaz_status", [
                    'uf' => $uf,
                ]);

            if ($response->successful()) {
                $body = $response->json();

                return FiscalResult::ok([
                    'status' => $body['status_sefaz'] ?? 'unknown',
                    'raw' => $body,
                ]);
            }

            return FiscalResult::fail('Erro ao consultar status SEFAZ');
        } catch (\Exception $e) {
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function downloadPdf(string $referencia): string
    {
        $response = $this->request()
            ->withHeaders(['Accept' => 'application/pdf'])
            ->get("{$this->baseUrl}/v2/nfe/{$referencia}.pdf");

        if ($response->successful()) {
            return $response->body();
        }

        throw new \RuntimeException('Erro ao baixar PDF: ' . $response->status());
    }

    public function downloadXml(string $referencia): string
    {
        $response = $this->request()
            ->withHeaders(['Accept' => 'application/xml'])
            ->get("{$this->baseUrl}/v2/nfe/{$referencia}.xml");

        if ($response->successful()) {
            return $response->body();
        }

        throw new \RuntimeException('Erro ao baixar XML: ' . $response->status());
    }

    // ─── NFS-e specific ─────────────────────────────────

    public function consultarNFSe(string $referencia): FiscalResult
    {
        try {
            $response = $this->request()
                ->get("{$this->baseUrl}/v2/nfse/{$referencia}");

            if ($response->successful()) {
                $body = $response->json();

                return FiscalResult::ok([
                    'reference' => $referencia,
                    'number' => (string) ($body['numero'] ?? ''),
                    'verification_code' => $body['codigo_verificacao'] ?? null,
                    'status' => $this->mapStatus($body['status'] ?? ''),
                    'pdf_url' => $body['caminho_pdf'] ?? null,
                    'xml_url' => $body['caminho_xml'] ?? null,
                    'raw' => $body,
                ]);
            }

            return FiscalResult::fail('Erro ao consultar NFS-e: ' . $response->body());
        } catch (\Exception $e) {
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function cancelarNFSe(string $referencia, string $justificativa): FiscalResult
    {
        try {
            $response = $this->request()
                ->delete("{$this->baseUrl}/v2/nfse/{$referencia}", [
                    'justificativa' => $justificativa,
                ]);

            if ($response->successful()) {
                $body = $response->json();

                return FiscalResult::ok([
                    'reference' => $referencia,
                    'status' => 'cancelled',
                    'event_type' => 'cancellation',
                    'raw' => $body,
                ]);
            }

            return $this->handleError('Cancelamento NFS-e', $response);
        } catch (\Exception $e) {
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    // ─── Private helpers ─────────────────────────────────

    private function request(): \Illuminate\Http\Client\PendingRequest
    {
        return Http::withBasicAuth($this->token, '')
            ->timeout(30)
            ->acceptJson();
    }

    private function handleNFeResponse(array $body, string $ref): FiscalResult
    {
        $status = $this->mapStatus($body['status'] ?? '');

        if ($status === 'processing') {
            return FiscalResult::ok([
                'provider_id' => $ref,
                'reference' => $ref,
                'status' => 'processing',
                'raw' => $body,
            ]);
        }

        return FiscalResult::ok([
            'provider_id' => $ref,
            'reference' => $ref,
            'access_key' => $body['chave_nfe'] ?? null,
            'number' => (string) ($body['numero'] ?? ''),
            'series' => (string) ($body['serie'] ?? ''),
            'status' => $status,
            'protocol_number' => $body['protocolo'] ?? null,
            'pdf_url' => $body['caminho_danfe'] ?? null,
            'xml_url' => $body['caminho_xml_nota_fiscal'] ?? null,
            'raw' => $body,
        ]);
    }

    private function handleError(string $context, \Illuminate\Http\Client\Response $response): FiscalResult
    {
        $body = $response->json();
        $message = $body['mensagem'] ?? ($body['erros'][0]['mensagem'] ?? $response->body());

        Log::error("FocusNFe {$context} failed", [
            'status' => $response->status(),
            'response' => $body,
        ]);

        return FiscalResult::fail("Erro {$context}: {$message}", $body);
    }

    private function mapStatus(string $providerStatus): string
    {
        return match (strtolower($providerStatus)) {
            'autorizado', 'autorizada', 'authorized' => 'authorized',
            'cancelado', 'cancelada', 'cancelled' => 'cancelled',
            'erro_autorizacao', 'rejeitado', 'rejeitada', 'rejected' => 'rejected',
            'processando_autorizacao', 'processing' => 'processing',
            default => 'pending',
        };
    }
}
