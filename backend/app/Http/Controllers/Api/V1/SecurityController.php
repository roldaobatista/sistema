<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SecurityController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══ 1. TWO-FACTOR AUTH (2FA) ═════════════════════════════════════

    public function enable2fa(Request $request): JsonResponse
    {
        try {
            $user = auth()->user();
            $secret = Str::random(32);

            DB::table('user_2fa')->updateOrInsert(
                ['user_id' => $user->id],
                ['secret' => encrypt($secret), 'is_enabled' => false, 'created_at' => now()]
            );

            return response()->json([
                'message' => 'Escaneie o QR code no seu app autenticador',
                'secret' => $secret,
                'qr_url' => "otpauth://totp/Kalibrium:{$user->email}?secret={$secret}&issuer=KalibriumERP",
            ]);
        } catch (\Exception $e) {
            Log::error('2FA enable failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao ativar 2FA'], 500);
        }
    }

    public function verify2fa(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string|size:6']);

        try {
            DB::table('user_2fa')
                ->where('user_id', auth()->id())
                ->update(['is_enabled' => true, 'verified_at' => now()]);

            return response()->json(['message' => '2FA ativado com sucesso']);
        } catch (\Exception $e) {
            Log::error('2FA verification failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao verificar 2FA'], 500);
        }
    }

    // ═══ 2. SESSION MANAGEMENT ════════════════════════════════════════

    public function activeSessions(): JsonResponse
    {
        $sessions = DB::table('user_sessions')
            ->where('user_id', auth()->id())
            ->orderByDesc('last_activity')
            ->get(['id', 'ip_address', 'user_agent', 'last_activity', 'created_at']);

        return response()->json(['data' => $sessions]);
    }

    public function revokeSession(int $sessionId): JsonResponse
    {
        try {
            DB::table('user_sessions')
                ->where('id', $sessionId)
                ->where('user_id', auth()->id())
                ->delete();

            return response()->json(['message' => 'Sessão revogada']);
        } catch (\Exception $e) {
            Log::error('Session revocation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao revogar sessão'], 500);
        }
    }

    public function revokeAllSessions(): JsonResponse
    {
        try {
            $currentToken = auth()->user()->currentAccessToken()?->id ?? null;

            DB::table('user_sessions')
                ->where('user_id', auth()->id())
                ->when($currentToken, fn($q) => $q->where('token_id', '!=', $currentToken))
                ->delete();

            return response()->json(['message' => 'Todas sessões revogadas (exceto a atual)']);
        } catch (\Exception $e) {
            Log::error('Revoke all sessions failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao revogar sessões'], 500);
        }
    }

    // ═══ 3. DATA MASKING ══════════════════════════════════════════════

    public function dataMaskingRules(): JsonResponse
    {
        $rules = DB::table('data_masking_rules')
            ->where('tenant_id', $this->tenantId())
            ->orderBy('table_name')
            ->get();

        return response()->json(['data' => $rules]);
    }

    public function storeDataMaskingRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_name' => 'required|string|max:100',
            'column_name' => 'required|string|max:100',
            'masking_type' => 'required|in:full,partial,email,phone,cpf,cnpj',
            'roles_exempt' => 'nullable|array',
        ]);

        try {
            $id = DB::table('data_masking_rules')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'table_name' => $validated['table_name'],
                'column_name' => $validated['column_name'],
                'masking_type' => $validated['masking_type'],
                'roles_exempt' => json_encode($validated['roles_exempt'] ?? []),
                'is_active' => true,
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Regra de mascaramento criada', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Data masking rule creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar regra'], 500);
        }
    }

    // ═══ 4. IMMUTABLE BACKUPS ═════════════════════════════════════════

    public function backupHistory(): JsonResponse
    {
        $backups = DB::table('immutable_backups')
            ->where('tenant_id', $this->tenantId())
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($backups);
    }

    public function triggerBackup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|in:full,incremental,differential',
            'retention_days' => 'nullable|integer|min:7|max:365',
        ]);

        try {
            $id = DB::table('immutable_backups')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'type' => $validated['type'],
                'status' => 'queued',
                'retention_days' => $validated['retention_days'] ?? 30,
                'requested_by' => auth()->id(),
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Backup agendado', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Backup trigger failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao agendar backup'], 500);
        }
    }

    // ═══ 5. PASSWORD POLICY ═══════════════════════════════════════════

    public function passwordPolicy(): JsonResponse
    {
        $policy = DB::table('password_policies')
            ->where('tenant_id', $this->tenantId())
            ->first();

        return response()->json(['data' => $policy ?? [
            'min_length' => 8, 'require_uppercase' => true, 'require_lowercase' => true,
            'require_number' => true, 'require_special' => false, 'expiry_days' => 90,
            'max_attempts' => 5, 'lockout_minutes' => 15, 'history_count' => 3,
        ]]);
    }

    public function updatePasswordPolicy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'min_length' => 'required|integer|min:6|max:32',
            'require_uppercase' => 'boolean',
            'require_lowercase' => 'boolean',
            'require_number' => 'boolean',
            'require_special' => 'boolean',
            'expiry_days' => 'nullable|integer|min:0|max:365',
            'max_attempts' => 'integer|min:3|max:20',
            'lockout_minutes' => 'integer|min:1|max:1440',
            'history_count' => 'integer|min:0|max:10',
        ]);

        try {
            DB::table('password_policies')->updateOrInsert(
                ['tenant_id' => $this->tenantId()],
                array_merge($validated, ['updated_at' => now()])
            );

            return response()->json(['message' => 'Política de senhas atualizada']);
        } catch (\Exception $e) {
            Log::error('Password policy update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar política'], 500);
        }
    }

    // ═══ 6. GEO LOGIN ALERTS ═════════════════════════════════════════

    public function geoLoginAlerts(): JsonResponse
    {
        $alerts = DB::table('geo_login_alerts')
            ->where('tenant_id', $this->tenantId())
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($alerts);
    }

    // ═══ 7. PRIVACY CONSENT ══════════════════════════════════════════

    public function consentRecords(Request $request): JsonResponse
    {
        $data = DB::table('privacy_consents')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('user_id'), fn($q, $u) => $q->where('user_id', $u))
            ->orderByDesc('consented_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeConsent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'consent_type' => 'required|in:data_processing,marketing,analytics,cookies,third_party',
            'granted' => 'required|boolean',
        ]);

        try {
            DB::table('privacy_consents')->insert([
                'tenant_id' => $this->tenantId(),
                'user_id' => auth()->id(),
                'consent_type' => $validated['consent_type'],
                'granted' => $validated['granted'],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'consented_at' => now(),
            ]);

            return response()->json(['message' => 'Consentimento registrado']);
        } catch (\Exception $e) {
            Log::error('Consent storage failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar consentimento'], 500);
        }
    }

    // ═══ 8. DOCUMENT WATERMARK ═══════════════════════════════════════

    public function watermarkConfig(): JsonResponse
    {
        $config = DB::table('watermark_configs')
            ->where('tenant_id', $this->tenantId())
            ->first();

        return response()->json(['data' => $config ?? [
            'enabled' => false, 'text' => 'CONFIDENCIAL', 'opacity' => 30, 'position' => 'diagonal',
        ]]);
    }

    public function updateWatermarkConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => 'boolean',
            'text' => 'nullable|string|max:100',
            'opacity' => 'nullable|integer|min:5|max:80',
            'position' => 'nullable|in:diagonal,top,bottom,center',
            'include_user_info' => 'boolean',
            'include_timestamp' => 'boolean',
        ]);

        try {
            DB::table('watermark_configs')->updateOrInsert(
                ['tenant_id' => $this->tenantId()],
                array_merge($validated, ['updated_at' => now()])
            );

            return response()->json(['message' => 'Configuração de marca d\'água atualizada']);
        } catch (\Exception $e) {
            Log::error('Watermark config update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar marca d\'água'], 500);
        }
    }

    // ═══ 9. TIME-BASED ACCESS ═════════════════════════════════════════

    public function accessRestrictions(): JsonResponse
    {
        $rules = DB::table('access_time_restrictions')
            ->where('tenant_id', $this->tenantId())
            ->orderBy('role_name')
            ->get();

        return response()->json(['data' => $rules]);
    }

    public function storeAccessRestriction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role_name' => 'required|string|max:50',
            'allowed_days' => 'required|array|min:1',
            'allowed_days.*' => 'in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
        ]);

        try {
            $id = DB::table('access_time_restrictions')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'role_name' => $validated['role_name'],
                'allowed_days' => json_encode($validated['allowed_days']),
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'],
                'is_active' => true,
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Restrição de horário criada', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Access restriction creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar restrição'], 500);
        }
    }

    // ═══ 10. VULNERABILITY SCANNING ═══════════════════════════════════

    public function vulnerabilityScanResults(): JsonResponse
    {
        $scans = DB::table('vulnerability_scans')
            ->where('tenant_id', $this->tenantId())
            ->orderByDesc('scanned_at')
            ->paginate(20);

        return response()->json($scans);
    }

    public function triggerScan(Request $request): JsonResponse
    {
        try {
            $id = DB::table('vulnerability_scans')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'scan_type' => $request->input('type', 'full'),
                'status' => 'running',
                'scanned_at' => now(),
                'requested_by' => auth()->id(),
            ]);

            return response()->json(['message' => 'Varredura de segurança iniciada', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Vulnerability scan trigger failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao iniciar varredura'], 500);
        }
    }
}
