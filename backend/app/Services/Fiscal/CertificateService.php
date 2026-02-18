<?php

namespace App\Services\Fiscal;

use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CertificateService
{
    /**
     * Upload and validate a PKCS#12 (.pfx/.p12) digital certificate.
     *
     * @return array{success: bool, message: string, expires_at?: string, subject?: string}
     */
    public function upload(Tenant $tenant, UploadedFile $file, string $password): array
    {
        $content = file_get_contents($file->getRealPath());

        if (!$content) {
            return ['success' => false, 'message' => 'Não foi possível ler o arquivo do certificado.'];
        }

        $certInfo = $this->extractInfo($content, $password);

        if (!$certInfo['success']) {
            return $certInfo;
        }

        $directory = "fiscal/{$tenant->id}/certificates";
        $filename = 'certificate_' . now()->format('Ymd_His') . '.pfx';
        $path = "{$directory}/{$filename}";

        Storage::disk('local')->put($path, $content);

        // Remove old certificate if exists
        if ($tenant->fiscal_certificate_path && Storage::disk('local')->exists($tenant->fiscal_certificate_path)) {
            Storage::disk('local')->delete($tenant->fiscal_certificate_path);
        }

        $tenant->update([
            'fiscal_certificate_path' => $path,
            'fiscal_certificate_password' => Crypt::encryptString($password),
            'fiscal_certificate_expires_at' => $certInfo['expires_at'],
        ]);

        return [
            'success' => true,
            'message' => 'Certificado enviado com sucesso.',
            'expires_at' => $certInfo['expires_at'],
            'subject' => $certInfo['subject'] ?? null,
            'issuer' => $certInfo['issuer'] ?? null,
        ];
    }

    /**
     * Extract info from a PKCS#12 certificate.
     */
    public function extractInfo(string $content, string $password): array
    {
        $certs = [];

        if (!function_exists('openssl_pkcs12_read')) {
            Log::warning('CertificateService: openssl_pkcs12_read not available');
            return [
                'success' => true,
                'message' => 'OpenSSL não disponível para validação. Certificado salvo sem verificação.',
                'expires_at' => null,
                'subject' => null,
            ];
        }

        $result = @openssl_pkcs12_read($content, $certs, $password);

        if (!$result) {
            return [
                'success' => false,
                'message' => 'Senha do certificado inválida ou arquivo corrompido.',
            ];
        }

        $certData = openssl_x509_parse($certs['cert']);

        if (!$certData) {
            return [
                'success' => false,
                'message' => 'Não foi possível ler os dados do certificado.',
            ];
        }

        $expiresAt = isset($certData['validTo_time_t'])
            ? date('Y-m-d', $certData['validTo_time_t'])
            : null;

        $subject = $certData['subject']['CN'] ?? $certData['subject']['O'] ?? null;
        $issuer = $certData['issuer']['CN'] ?? $certData['issuer']['O'] ?? null;

        return [
            'success' => true,
            'message' => 'Certificado válido.',
            'expires_at' => $expiresAt,
            'subject' => $subject,
            'issuer' => $issuer,
            'valid_from' => isset($certData['validFrom_time_t'])
                ? date('Y-m-d', $certData['validFrom_time_t'])
                : null,
        ];
    }

    /**
     * Check the status/validity of the current certificate.
     */
    public function status(Tenant $tenant): array
    {
        if (!$tenant->fiscal_certificate_path) {
            return [
                'has_certificate' => false,
                'message' => 'Nenhum certificado configurado.',
            ];
        }

        $exists = Storage::disk('local')->exists($tenant->fiscal_certificate_path);

        if (!$exists) {
            return [
                'has_certificate' => false,
                'message' => 'Arquivo do certificado não encontrado no servidor.',
            ];
        }

        $expiresAt = $tenant->fiscal_certificate_expires_at;
        $isExpired = $expiresAt && now()->greaterThan($expiresAt);
        $daysUntilExpiry = $expiresAt ? now()->diffInDays($expiresAt, false) : null;

        return [
            'has_certificate' => true,
            'expires_at' => $expiresAt?->format('Y-m-d'),
            'is_expired' => $isExpired,
            'days_until_expiry' => $daysUntilExpiry,
            'needs_renewal' => $daysUntilExpiry !== null && $daysUntilExpiry <= 30,
            'message' => $isExpired
                ? 'Certificado expirado! Faça o upload de um novo certificado.'
                : ($daysUntilExpiry <= 30
                    ? "Certificado expira em {$daysUntilExpiry} dias. Renovação recomendada."
                    : 'Certificado válido.'),
        ];
    }

    /**
     * Remove the current certificate.
     */
    public function remove(Tenant $tenant): bool
    {
        if ($tenant->fiscal_certificate_path && Storage::disk('local')->exists($tenant->fiscal_certificate_path)) {
            Storage::disk('local')->delete($tenant->fiscal_certificate_path);
        }

        $tenant->update([
            'fiscal_certificate_path' => null,
            'fiscal_certificate_password' => null,
            'fiscal_certificate_expires_at' => null,
        ]);

        return true;
    }
}
