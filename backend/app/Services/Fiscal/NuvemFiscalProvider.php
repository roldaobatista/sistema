<?php

namespace App\Services\Fiscal;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * Nuvemfiscal.com.br API provider implementation.
 *
 * Uses OAuth2 client_credentials flow for authentication.
 * Supports NF-e (modelo 55) and NFS-e emission.
 *
 * @see https://dev.nuvemfiscal.com.br/docs
 */
class NuvemFiscalProvider implements FiscalProvider
{
    private string $baseUrl;
    private string $clientId;
    private string $clientSecret;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.nuvemfiscal.url', 'https://api.nuvemfiscal.com.br'), '/');
        $this->clientId = config('services.nuvemfiscal.client_id', '');
        $this->clientSecret = config('services.nuvemfiscal.client_secret', '');
    }

    public function emitirNFe(array $data): FiscalResult
    {
        try {
            $token = $this->getAccessToken();

            $response = Http::withToken($token)
                ->timeout(30)
                ->post("{$this->baseUrl}/nfe", $data);

            if ($response->successful()) {
                $body = $response->json();
                return FiscalResult::ok([
                    'provider_id' => $body['id'] ?? null,
                    'access_key' => $body['chave_acesso'] ?? null,
                    'number' => (string) ($body['numero'] ?? ''),
                    'series' => (string) ($body['serie'] ?? ''),
                    'status' => $this->mapStatus($body['status'] ?? ''),
                    'pdf_url' => $body['url_danfe'] ?? null,
                    'xml_url' => $body['url_xml'] ?? null,
                    'raw' => $body,
                ]);
            }

            $error = $response->json('mensagem') ?? $response->body();
            Log::error('NuvemFiscal NF-e emission failed', [
                'status' => $response->status(),
                'response' => $response->json(),
            ]);

            return FiscalResult::fail("Erro ao emitir NF-e: {$error}", $response->json());
        } catch (\Exception $e) {
            Log::error('NuvemFiscal NF-e exception', ['error' => $e->getMessage()]);
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function emitirNFSe(array $data): FiscalResult
    {
        try {
            $token = $this->getAccessToken();

            $response = Http::withToken($token)
                ->timeout(30)
                ->post("{$this->baseUrl}/nfse", $data);

            if ($response->successful()) {
                $body = $response->json();
                return FiscalResult::ok([
                    'provider_id' => $body['id'] ?? null,
                    'access_key' => $body['codigo_verificacao'] ?? $body['id'] ?? null,
                    'number' => (string) ($body['numero'] ?? ''),
                    'series' => '',
                    'status' => $this->mapStatus($body['status'] ?? ''),
                    'pdf_url' => $body['url_pdf'] ?? null,
                    'xml_url' => $body['url_xml'] ?? null,
                    'raw' => $body,
                ]);
            }

            $error = $response->json('mensagem') ?? $response->body();
            Log::error('NuvemFiscal NFS-e emission failed', [
                'status' => $response->status(),
                'response' => $response->json(),
            ]);

            return FiscalResult::fail("Erro ao emitir NFS-e: {$error}", $response->json());
        } catch (\Exception $e) {
            Log::error('NuvemFiscal NFS-e exception', ['error' => $e->getMessage()]);
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function consultarStatus(string $chaveAcesso): FiscalResult
    {
        try {
            $token = $this->getAccessToken();

            $response = Http::withToken($token)
                ->timeout(15)
                ->get("{$this->baseUrl}/nfe/{$chaveAcesso}");

            if ($response->successful()) {
                $body = $response->json();
                return FiscalResult::ok([
                    'provider_id' => $body['id'] ?? null,
                    'access_key' => $chaveAcesso,
                    'status' => $this->mapStatus($body['status'] ?? ''),
                    'raw' => $body,
                ]);
            }

            return FiscalResult::fail('Erro ao consultar: ' . $response->body());
        } catch (\Exception $e) {
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function cancelar(string $chaveAcesso, string $justificativa): FiscalResult
    {
        try {
            $token = $this->getAccessToken();

            $response = Http::withToken($token)
                ->timeout(30)
                ->post("{$this->baseUrl}/nfe/{$chaveAcesso}/cancelamento", [
                    'justificativa' => $justificativa,
                ]);

            if ($response->successful()) {
                return FiscalResult::ok([
                    'access_key' => $chaveAcesso,
                    'status' => 'cancelled',
                    'raw' => $response->json(),
                ]);
            }

            return FiscalResult::fail('Erro ao cancelar: ' . $response->body());
        } catch (\Exception $e) {
            return FiscalResult::fail("Exceção: {$e->getMessage()}");
        }
    }

    public function downloadPdf(string $chaveAcesso): string
    {
        $token = $this->getAccessToken();

        $response = Http::withToken($token)
            ->timeout(30)
            ->get("{$this->baseUrl}/nfe/{$chaveAcesso}/pdf");

        if ($response->successful()) {
            return base64_encode($response->body());
        }

        throw new \RuntimeException('Erro ao baixar PDF: ' . $response->status());
    }

    public function downloadXml(string $chaveAcesso): string
    {
        $token = $this->getAccessToken();

        $response = Http::withToken($token)
            ->timeout(30)
            ->get("{$this->baseUrl}/nfe/{$chaveAcesso}/xml");

        if ($response->successful()) {
            return $response->body();
        }

        throw new \RuntimeException('Erro ao baixar XML: ' . $response->status());
    }

    /**
     * Get OAuth2 access token, cached for 50 minutes.
     */
    private function getAccessToken(): string
    {
        return Cache::remember('nuvemfiscal_token', 3000, function () {
            $response = Http::asForm()->post("{$this->baseUrl}/oauth/token", [
                'grant_type' => 'client_credentials',
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'scope' => 'empresa nfe nfse cep',
            ]);

            if (!$response->successful()) {
                throw new \RuntimeException('NuvemFiscal OAuth failed: ' . $response->body());
            }

            return $response->json('access_token');
        });
    }

    private function mapStatus(string $providerStatus): string
    {
        return match (strtolower($providerStatus)) {
            'autorizada', 'autorizado', 'authorized' => 'authorized',
            'cancelada', 'cancelado', 'cancelled' => 'cancelled',
            'rejeitada', 'rejeitado', 'rejected' => 'rejected',
            'pendente', 'processando', 'pending' => 'pending',
            default => 'pending',
        };
    }
}
