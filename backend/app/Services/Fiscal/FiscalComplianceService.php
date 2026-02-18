<?php

namespace App\Services\Fiscal;

use App\Models\FiscalAuditLog;
use App\Models\FiscalNote;
use App\Models\Tenant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Compliance & security: certificate expiry (#16), audit (#17),
 * CNPJ validation (#18), public portal (#19), regime blocking (#20).
 */
class FiscalComplianceService
{
    /**
     * #16 — Check certificate expiry and return alert level.
     */
    public function checkCertificateExpiry(Tenant $tenant): array
    {
        $expiresAt = $tenant->fiscal_certificate_expires_at;
        if (! $expiresAt) {
            return ['status' => 'none', 'message' => 'Nenhum certificado cadastrado'];
        }

        $daysLeft = now()->diffInDays($expiresAt, false);

        if ($daysLeft <= 0) {
            return ['status' => 'expired', 'days_left' => 0, 'message' => 'Certificado VENCIDO!', 'alert' => 'critical'];
        }
        if ($daysLeft <= 7) {
            return ['status' => 'expiring', 'days_left' => $daysLeft, 'message' => "Certificado vence em {$daysLeft} dias!", 'alert' => 'critical'];
        }
        if ($daysLeft <= 15) {
            return ['status' => 'expiring', 'days_left' => $daysLeft, 'message' => "Certificado vence em {$daysLeft} dias", 'alert' => 'warning'];
        }
        if ($daysLeft <= 30) {
            return ['status' => 'expiring', 'days_left' => $daysLeft, 'message' => "Certificado vence em {$daysLeft} dias", 'alert' => 'info'];
        }

        return ['status' => 'valid', 'days_left' => $daysLeft, 'message' => "Certificado válido por {$daysLeft} dias", 'alert' => 'ok'];
    }

    /**
     * #18 — Validate CNPJ/CPF against Receita Federal (via public API).
     */
    public function validateDocument(string $document): array
    {
        $clean = preg_replace('/\D/', '', $document);
        $type = strlen($clean) === 14 ? 'cnpj' : (strlen($clean) === 11 ? 'cpf' : null);

        if (! $type) {
            return ['valid' => false, 'error' => 'Documento inválido: deve ter 11 (CPF) ou 14 (CNPJ) dígitos'];
        }

        // Structural validation
        if ($type === 'cnpj' && ! $this->isValidCnpj($clean)) {
            return ['valid' => false, 'type' => 'cnpj', 'error' => 'CNPJ inválido (dígitos verificadores)'];
        }
        if ($type === 'cpf' && ! $this->isValidCpf($clean)) {
            return ['valid' => false, 'type' => 'cpf', 'error' => 'CPF inválido (dígitos verificadores)'];
        }

        // Try public API for CNPJ
        if ($type === 'cnpj') {
            try {
                $response = Http::timeout(5)->get("https://brasilapi.com.br/api/cnpj/v1/{$clean}");
                if ($response->ok()) {
                    $data = $response->json();
                    return [
                        'valid' => true,
                        'type' => 'cnpj',
                        'document' => $clean,
                        'razao_social' => $data['razao_social'] ?? null,
                        'nome_fantasia' => $data['nome_fantasia'] ?? null,
                        'situacao' => $data['descricao_situacao_cadastral'] ?? null,
                        'uf' => $data['uf'] ?? null,
                        'municipio' => $data['municipio'] ?? null,
                    ];
                }
            } catch (\Exception $e) {
                Log::warning('FiscalCompliance: CNPJ API failed', ['error' => $e->getMessage()]);
            }
        }

        return ['valid' => true, 'type' => $type, 'document' => $clean, 'source' => 'structural_only'];
    }

    /**
     * #19 — Public portal lookup by access key.
     */
    public function consultaPublica(string $chaveAcesso): ?FiscalNote
    {
        $clean = preg_replace('/\D/', '', $chaveAcesso);
        if (strlen($clean) !== 44) {
            return null;
        }

        return FiscalNote::where('access_key', $clean)
            ->where('status', FiscalNote::STATUS_AUTHORIZED)
            ->first();
    }

    /**
     * #20 — Check if an emission type is compatible with tenant's tax regime.
     */
    public function blockIncompatibleEmission(Tenant $tenant, string $noteType): array
    {
        $regime = $tenant->fiscal_regime ?? 'simples_nacional';

        $blocked = [];

        // MEI cannot issue NF-e for products (only NFS-e for services)
        if ($regime === 'mei' && $noteType === 'nfe') {
            $blocked[] = 'MEI não pode emitir NF-e de produto. Use NFS-e para serviços.';
        }

        // CT-e requires specific regime
        if ($noteType === 'cte' && ! in_array($regime, ['lucro_presumido', 'lucro_real'])) {
            $blocked[] = 'CT-e requer regime de Lucro Presumido ou Real.';
        }

        return [
            'allowed' => empty($blocked),
            'regime' => $regime,
            'blocks' => $blocked,
        ];
    }

    /**
     * #17 — Full audit log for a note.
     */
    public function getAuditLog(int $noteId, int $tenantId): \Illuminate\Database\Eloquent\Collection
    {
        return FiscalAuditLog::where('fiscal_note_id', $noteId)
            ->where('tenant_id', $tenantId)
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * #17 — Audit report for a period.
     */
    public function auditReport(int $tenantId, ?string $from = null, ?string $to = null): array
    {
        $query = FiscalAuditLog::where('tenant_id', $tenantId);

        if ($from) $query->where('created_at', '>=', $from);
        if ($to) $query->where('created_at', '<=', $to);

        $logs = $query->orderByDesc('created_at')->limit(500)->get();

        return [
            'total' => $logs->count(),
            'by_action' => $logs->groupBy('action')->map->count(),
            'by_user' => $logs->groupBy('user_name')->map->count(),
            'logs' => $logs,
        ];
    }

    private function isValidCnpj(string $cnpj): bool
    {
        if (preg_match('/^(\d)\1{13}$/', $cnpj)) return false;
        $weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
        $weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
        $sum = 0;
        for ($i = 0; $i < 12; $i++) $sum += $cnpj[$i] * $weights1[$i];
        $d1 = $sum % 11 < 2 ? 0 : 11 - ($sum % 11);
        if ($cnpj[12] != $d1) return false;
        $sum = 0;
        for ($i = 0; $i < 13; $i++) $sum += $cnpj[$i] * $weights2[$i];
        $d2 = $sum % 11 < 2 ? 0 : 11 - ($sum % 11);
        return $cnpj[13] == $d2;
    }

    private function isValidCpf(string $cpf): bool
    {
        if (preg_match('/^(\d)\1{10}$/', $cpf)) return false;
        $sum = 0;
        for ($i = 0; $i < 9; $i++) $sum += $cpf[$i] * (10 - $i);
        $d1 = $sum % 11 < 2 ? 0 : 11 - ($sum % 11);
        if ($cpf[9] != $d1) return false;
        $sum = 0;
        for ($i = 0; $i < 10; $i++) $sum += $cpf[$i] * (11 - $i);
        $d2 = $sum % 11 < 2 ? 0 : 11 - ($sum % 11);
        return $cpf[10] == $d2;
    }
}
