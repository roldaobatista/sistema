<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RemainingModulesController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // FROTA — 3 features restantes
    // ═══════════════════════════════════════════════════════════════════

    // 1. Toll Integration (Pedágio)
    public function tollTransactions(Request $request): JsonResponse
    {
        $data = DB::table('toll_transactions')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('vehicle_id'), fn($q, $v) => $q->where('vehicle_id', $v))
            ->orderByDesc('transaction_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeTollTransaction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vehicle_id' => 'required|exists:vehicles,id',
            'toll_name' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:tag,manual,invoice',
            'transaction_at' => 'required|date',
            'route' => 'nullable|string|max:255',
        ]);

        try {
            $id = DB::table('toll_transactions')->insertGetId(array_merge($validated, [
                'tenant_id' => $this->tenantId(),
                'created_at' => now(),
            ]));

            return response()->json(['message' => 'Pedágio registrado', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Toll transaction creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar pedágio'], 500);
        }
    }

    // 2. GPS Real-Time
    public function gpsTracking(Request $request): JsonResponse
    {
        $vehicles = DB::table('vehicle_gps_positions')
            ->where('tenant_id', $this->tenantId())
            ->whereIn('vehicle_id', function ($q) {
                $q->select('id')->from('vehicles')->where('tenant_id', $this->tenantId())->where('is_active', true);
            })
            ->orderByDesc('recorded_at')
            ->get()
            ->unique('vehicle_id')
            ->values();

        return response()->json(['data' => $vehicles]);
    }

    public function storeGpsPosition(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vehicle_id' => 'required|exists:vehicles,id',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'speed_kmh' => 'nullable|numeric|min:0',
            'heading' => 'nullable|numeric|min:0|max:360',
        ]);

        try {
            DB::table('vehicle_gps_positions')->insert(array_merge($validated, [
                'tenant_id' => $this->tenantId(),
                'recorded_at' => now(),
            ]));

            return response()->json(['message' => 'Posição GPS registrada'], 201);
        } catch (\Exception $e) {
            Log::error('GPS position store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar posição GPS'], 500);
        }
    }

    // 3. Route Analysis
    public function routeAnalysis(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $vehicleId = $request->input('vehicle_id');
        $dateFrom = $request->input('date_from', now()->subDays(7)->toDateString());

        $data = DB::table('vehicle_gps_positions')
            ->where('tenant_id', $tenantId)
            ->when($vehicleId, fn($q, $v) => $q->where('vehicle_id', $v))
            ->where('recorded_at', '>=', $dateFrom)
            ->select(
                'vehicle_id',
                DB::raw('COUNT(*) as points'),
                DB::raw('MIN(recorded_at) as start_time'),
                DB::raw('MAX(recorded_at) as end_time'),
                DB::raw('AVG(speed_kmh) as avg_speed'),
                DB::raw('MAX(speed_kmh) as max_speed')
            )
            ->groupBy('vehicle_id')
            ->get();

        return response()->json(['data' => $data]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // RH — 4 features restantes
    // ═══════════════════════════════════════════════════════════════════

    // 1. Employee Portal
    public function employeePortal(): JsonResponse
    {
        $userId = auth()->id();

        $data = [
            'personal_info' => DB::table('users')->where('id', $userId)->first(['name', 'email', 'phone', 'created_at']),
            'leave_balance' => DB::table('leave_balances')->where('user_id', $userId)->first(),
            'recent_payslips' => DB::table('payslips')->where('user_id', $userId)->orderByDesc('period')->limit(3)->get(),
            'pending_trainings' => DB::table('training_enrollments')
                ->where('user_id', $userId)->where('status', 'pending')
                ->count(),
            'next_review' => DB::table('performance_reviews')
                ->where('reviewee_id', $userId)->where('status', 'scheduled')
                ->first(['scheduled_at', 'type']),
        ];

        return response()->json(['data' => $data]);
    }

    // 2. EPI Management
    public function epiList(Request $request): JsonResponse
    {
        $data = DB::table('epi_records')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('user_id'), fn($q, $u) => $q->where('user_id', $u))
            ->orderByDesc('delivered_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeEpi(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'epi_type' => 'required|string|max:100',
            'ca_number' => 'nullable|string|max:20',
            'delivered_at' => 'required|date',
            'expiry_date' => 'nullable|date',
            'quantity' => 'integer|min:1',
        ]);

        try {
            $id = DB::table('epi_records')->insertGetId(array_merge($validated, [
                'tenant_id' => $this->tenantId(),
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            return response()->json(['message' => 'EPI registrado', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('EPI record creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar EPI'], 500);
        }
    }

    // 3. Productivity Gamification
    public function productivityGamification(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $month = $request->input('month', now()->month);

        $leaderboard = DB::table('work_orders')
            ->where('work_orders.tenant_id', $tenantId)
            ->where('work_orders.status', 'completed')
            ->whereMonth('work_orders.completed_at', $month)
            ->join('users', 'work_orders.technician_id', '=', 'users.id')
            ->select(
                'users.id',
                'users.name',
                DB::raw('COUNT(*) as os_completed'),
                DB::raw('AVG(DATEDIFF(work_orders.completed_at, work_orders.started_at)) as avg_resolution_days')
            )
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('os_completed')
            ->get()
            ->map(function ($tech, $index) {
                $tech->rank = $index + 1;
                $tech->badge = match (true) {
                    $tech->os_completed >= 20 => '🏆 Lenda',
                    $tech->os_completed >= 15 => '⭐ Estrela',
                    $tech->os_completed >= 10 => '🔥 Produtivo',
                    $tech->os_completed >= 5 => '💪 Comprometido',
                    default => '📊 Iniciante',
                };
                $tech->points = $tech->os_completed * 100;
                return $tech;
            });

        return response()->json(['data' => $leaderboard]);
    }

    // 4. Interactive Org Chart
    public function orgChart(): JsonResponse
    {
        $tenantId = $this->tenantId();

        $users = DB::table('users')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->select('id', 'name', 'email', 'position', 'department', 'manager_id')
            ->orderBy('name')
            ->get();

        $tree = $this->buildOrgTree($users, null);

        return response()->json(['data' => $tree]);
    }

    private function buildOrgTree($users, $managerId): array
    {
        return $users->where('manager_id', $managerId)->map(function ($user) use ($users) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'position' => $user->position ?? 'N/A',
                'department' => $user->department ?? 'N/A',
                'children' => $this->buildOrgTree($users, $user->id),
            ];
        })->values()->toArray();
    }

    // ═══════════════════════════════════════════════════════════════════
    // FINANCEIRO — 5 features restantes
    // ═══════════════════════════════════════════════════════════════════

    // 1. Boleto Generation
    public function generateBoleto(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'receivable_id' => 'required|exists:accounts_receivable,id',
        ]);

        try {
            $receivable = DB::table('accounts_receivable')->find($validated['receivable_id']);

            if (!$receivable) {
                return response()->json(['message' => 'Conta a receber não encontrada'], 404);
            }

            $boletoData = [
                'bank_code' => '001',
                'amount' => $receivable->amount,
                'due_date' => $receivable->due_date,
                'our_number' => str_pad($receivable->id, 10, '0', STR_PAD_LEFT),
                'barcode' => '00190.00009 '  . str_pad($receivable->id, 5, '0', STR_PAD_LEFT) . '.00000 00000.000000 0 ' . number_format($receivable->amount * 100, 0, '', ''),
                'payer' => $receivable->customer_name ?? 'Cliente',
                'status' => 'generated',
            ];

            return response()->json(['data' => $boletoData, 'message' => 'Boleto gerado']);
        } catch (\Exception $e) {
            Log::error('Boleto generation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar boleto'], 500);
        }
    }

    // 2. NFS-e Emission
    public function emitNfse(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'service_description' => 'required|string',
            'amount' => 'required|numeric|min:0.01',
            'iss_rate' => 'nullable|numeric|min:0|max:10',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('nfse_emissions')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'work_order_id' => $validated['work_order_id'],
                'service_description' => $validated['service_description'],
                'amount' => $validated['amount'],
                'iss_rate' => $validated['iss_rate'] ?? 5.0,
                'iss_amount' => round($validated['amount'] * (($validated['iss_rate'] ?? 5.0) / 100), 2),
                'status' => 'pending',
                'created_by' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'NFS-e em processamento', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('NFS-e emission failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao emitir NFS-e'], 500);
        }
    }

    // 3. Payment Gateway
    public function paymentGatewayConfig(): JsonResponse
    {
        $config = DB::table('payment_gateway_configs')
            ->where('tenant_id', $this->tenantId())
            ->first();

        return response()->json(['data' => $config ?? ['gateway' => 'none', 'methods' => ['boleto', 'pix', 'credit_card']]]);
    }

    public function processOnlinePayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'receivable_id' => 'required|exists:accounts_receivable,id',
            'method' => 'required|in:pix,credit_card,boleto',
        ]);

        try {
            $id = DB::table('online_payments')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'receivable_id' => $validated['receivable_id'],
                'method' => $validated['method'],
                'status' => 'processing',
                'created_at' => now(),
            ]);

            $paymentInfo = match ($validated['method']) {
                'pix' => ['pix_key' => 'kalibrium@pix.com', 'qr_code' => 'PIX_QR_' . $id],
                'credit_card' => ['checkout_url' => config('app.url') . '/checkout/' . $id],
                'boleto' => ['boleto_url' => config('app.url') . '/boleto/' . $id],
            };

            return response()->json(['message' => 'Pagamento iniciado', 'id' => $id, 'data' => $paymentInfo], 201);
        } catch (\Exception $e) {
            Log::error('Online payment processing failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao processar pagamento'], 500);
        }
    }

    // 4. Financial Portal (same as PortalCliente financial history but admin view)
    public function financialPortalOverview(): JsonResponse
    {
        $tenantId = $this->tenantId();

        $overview = [
            'total_receivable' => DB::table('accounts_receivable')->where('tenant_id', $tenantId)->where('status', 'pending')->sum('amount'),
            'total_overdue' => DB::table('accounts_receivable')->where('tenant_id', $tenantId)->where('status', 'pending')->where('due_date', '<', now())->sum('amount'),
            'total_received_month' => DB::table('accounts_receivable')->where('tenant_id', $tenantId)->where('status', 'paid')->whereMonth('paid_at', now()->month)->sum('amount'),
            'avg_days_to_receive' => DB::table('accounts_receivable')->where('tenant_id', $tenantId)->where('status', 'paid')->avg(DB::raw('DATEDIFF(paid_at, due_date)')),
            'customers_overdue' => DB::table('accounts_receivable')->where('tenant_id', $tenantId)->where('status', 'pending')->where('due_date', '<', now())->distinct('customer_id')->count('customer_id'),
        ];

        return response()->json(['data' => $overview]);
    }

    // 5. Customer Financial Block
    public function toggleCustomerBlock(Request $request, int $customerId): JsonResponse
    {
        $validated = $request->validate([
            'blocked' => 'required|boolean',
            'reason' => 'nullable|string|max:255',
        ]);

        try {
            DB::table('customers')
                ->where('id', $customerId)
                ->where('tenant_id', $this->tenantId())
                ->update([
                    'financial_blocked' => $validated['blocked'],
                    'block_reason' => $validated['reason'] ?? null,
                    'blocked_at' => $validated['blocked'] ? now() : null,
                    'updated_at' => now(),
                ]);

            $action = $validated['blocked'] ? 'bloqueado' : 'desbloqueado';
            return response()->json(['message' => "Cliente {$action} financeiramente"]);
        } catch (\Exception $e) {
            Log::error('Customer block toggle failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao alterar bloqueio'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // MOBILE — 15 features
    // ═══════════════════════════════════════════════════════════════════

    // 1. Dark Mode Config
    public function userPreferences(): JsonResponse
    {
        $prefs = DB::table('user_preferences')
            ->where('user_id', auth()->id())
            ->first();

        return response()->json(['data' => $prefs ?? ['dark_mode' => false, 'language' => 'pt_BR', 'notifications' => true]]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dark_mode' => 'nullable|boolean',
            'language' => 'nullable|in:pt_BR,en_US,es_ES',
            'notifications' => 'nullable|boolean',
            'data_saver' => 'nullable|boolean',
            'offline_sync' => 'nullable|boolean',
        ]);

        try {
            DB::table('user_preferences')->updateOrInsert(
                ['user_id' => auth()->id()],
                array_merge($validated, ['updated_at' => now()])
            );

            return response()->json(['message' => 'Preferências atualizadas']);
        } catch (\Exception $e) {
            Log::error('Preferences update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar preferências'], 500);
        }
    }

    // 2. Background Sync Queue
    public function syncQueue(): JsonResponse
    {
        $queue = DB::table('sync_queue')
            ->where('user_id', auth()->id())
            ->where('status', '!=', 'completed')
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $queue]);
    }

    public function addToSyncQueue(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entity_type' => 'required|string|max:50',
            'entity_id' => 'nullable|integer',
            'action' => 'required|in:create,update,delete',
            'payload' => 'required|array',
        ]);

        try {
            $id = DB::table('sync_queue')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'user_id' => auth()->id(),
                'entity_type' => $validated['entity_type'],
                'entity_id' => $validated['entity_id'] ?? null,
                'action' => $validated['action'],
                'payload' => json_encode($validated['payload']),
                'status' => 'pending',
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Adicionado à fila de sincronização', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Sync queue add failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao adicionar à fila'], 500);
        }
    }

    // 3. Interactive Notifications
    public function interactiveNotifications(): JsonResponse
    {
        $notifications = DB::table('mobile_notifications')
            ->where('user_id', auth()->id())
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $notifications]);
    }

    public function respondToNotification(Request $request, int $notificationId): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|in:approve,reject,snooze,acknowledge',
        ]);

        try {
            DB::table('mobile_notifications')
                ->where('id', $notificationId)
                ->where('user_id', auth()->id())
                ->update([
                    'response_action' => $validated['action'],
                    'responded_at' => now(),
                ]);

            return response()->json(['message' => 'Ação registrada']);
        } catch (\Exception $e) {
            Log::error('Notification response failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar ação'], 500);
        }
    }

    // 4. Barcode Scanner
    public function barcodeLookup(Request $request): JsonResponse
    {
        $code = $request->input('code');

        $product = DB::table('products')
            ->where('tenant_id', $this->tenantId())
            ->where(function ($q) use ($code) {
                $q->where('barcode', $code)->orWhere('sku', $code)->orWhere('serial_number', $code);
            })
            ->first();

        if (!$product) {
            return response()->json(['message' => 'Produto não encontrado', 'code' => $code], 404);
        }

        return response()->json(['data' => $product]);
    }

    // 5. Vector Signature
    public function storeSignature(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'signature_data' => 'required|string',
            'signer_name' => 'required|string|max:255',
            'signer_role' => 'nullable|in:customer,technician,manager',
        ]);

        try {
            $id = DB::table('digital_signatures')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'work_order_id' => $validated['work_order_id'],
                'signature_data' => $validated['signature_data'],
                'signer_name' => $validated['signer_name'],
                'signer_role' => $validated['signer_role'] ?? 'customer',
                'signed_at' => now(),
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Assinatura registrada', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Signature storage failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar assinatura'], 500);
        }
    }

    // 6. Bluetooth Printing
    public function printJobs(): JsonResponse
    {
        $jobs = DB::table('print_jobs')
            ->where('user_id', auth()->id())
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        return response()->json(['data' => $jobs]);
    }

    public function createPrintJob(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'document_type' => 'required|in:certificate,label,receipt,report',
            'document_id' => 'required|integer',
            'printer_type' => 'required|in:bluetooth,wifi,usb',
            'copies' => 'integer|min:1|max:10',
        ]);

        try {
            $id = DB::table('print_jobs')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'user_id' => auth()->id(),
                'document_type' => $validated['document_type'],
                'document_id' => $validated['document_id'],
                'printer_type' => $validated['printer_type'],
                'copies' => $validated['copies'] ?? 1,
                'status' => 'queued',
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Job de impressão criado', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Print job creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar job de impressão'], 500);
        }
    }

    // 7. Voice-to-Text Reports
    public function storeVoiceReport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'transcription' => 'required|string',
            'duration_seconds' => 'nullable|integer',
            'language' => 'nullable|in:pt_BR,en_US,es_ES',
        ]);

        try {
            $id = DB::table('voice_reports')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'user_id' => auth()->id(),
                'work_order_id' => $validated['work_order_id'],
                'transcription' => $validated['transcription'],
                'duration_seconds' => $validated['duration_seconds'] ?? null,
                'language' => $validated['language'] ?? 'pt_BR',
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Relatório por voz registrado', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Voice report storage failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar relatório'], 500);
        }
    }

    // 8. Biometric Login Config
    public function biometricConfig(): JsonResponse
    {
        $config = DB::table('biometric_configs')
            ->where('user_id', auth()->id())
            ->first();

        return response()->json(['data' => $config ?? ['enabled' => false, 'type' => null]]);
    }

    public function updateBiometricConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'type' => 'nullable|in:fingerprint,face_id,iris',
            'device_id' => 'nullable|string|max:255',
        ]);

        try {
            DB::table('biometric_configs')->updateOrInsert(
                ['user_id' => auth()->id()],
                array_merge($validated, ['updated_at' => now()])
            );

            return response()->json(['message' => 'Configuração biométrica atualizada']);
        } catch (\Exception $e) {
            Log::error('Biometric config update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar configuração biométrica'], 500);
        }
    }

    // 9. Photo Annotation
    public function storePhotoAnnotation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'image_path' => 'required|string',
            'annotations' => 'required|array',
            'annotations.*.x' => 'required|numeric',
            'annotations.*.y' => 'required|numeric',
            'annotations.*.text' => 'required|string|max:200',
            'annotations.*.color' => 'nullable|string|max:7',
        ]);

        try {
            $id = DB::table('photo_annotations')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'work_order_id' => $validated['work_order_id'],
                'user_id' => auth()->id(),
                'image_path' => $validated['image_path'],
                'annotations' => json_encode($validated['annotations']),
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Anotação salva', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Photo annotation storage failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao salvar anotação'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // INOVAÇÃO — 5 features
    // ═══════════════════════════════════════════════════════════════════

    // 1. Custom Themes
    public function themeConfig(): JsonResponse
    {
        $theme = DB::table('custom_themes')
            ->where('tenant_id', $this->tenantId())
            ->first();

        return response()->json(['data' => $theme ?? [
            'primary_color' => '#3B82F6', 'secondary_color' => '#10B981', 'accent_color' => '#F59E0B',
            'dark_mode' => false, 'sidebar_style' => 'default', 'font_family' => 'Inter',
        ]]);
    }

    public function updateThemeConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'primary_color' => 'nullable|string|max:7',
            'secondary_color' => 'nullable|string|max:7',
            'accent_color' => 'nullable|string|max:7',
            'dark_mode' => 'nullable|boolean',
            'sidebar_style' => 'nullable|in:default,compact,minimal',
            'font_family' => 'nullable|string|max:50',
            'logo_url' => 'nullable|string',
        ]);

        try {
            DB::table('custom_themes')->updateOrInsert(
                ['tenant_id' => $this->tenantId()],
                array_merge($validated, ['updated_at' => now()])
            );

            return response()->json(['message' => 'Tema atualizado']);
        } catch (\Exception $e) {
            Log::error('Theme config update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar tema'], 500);
        }
    }

    // 2. Referral System
    public function referralProgram(): JsonResponse
    {
        $tenantId = $this->tenantId();

        $referrals = DB::table('referral_codes')
            ->where('tenant_id', $tenantId)
            ->where('referrer_id', auth()->id())
            ->get();

        return response()->json(['data' => $referrals]);
    }

    public function generateReferralCode(): JsonResponse
    {
        try {
            DB::beginTransaction();

            $code = strtoupper(Str::random(8));
            $userId = auth()->id();

            $existing = DB::table('referral_codes')
                ->where('user_id', $userId)
                ->where('tenant_id', $this->tenantId())
                ->first();

            if ($existing) {
                DB::commit();
                return response()->json(['code' => $existing->code, 'message' => 'Código já existente']);
            }

            DB::table('referral_codes')->insert([
                'tenant_id' => $this->tenantId(),
                'user_id' => $userId,
                'code' => $code,
                'reward_type' => 'discount_percent',
                'reward_value' => 10,
                'uses_count' => 0,
                'created_at' => now(),
            ]);

            DB::commit();
            return response()->json(['code' => $code, 'message' => 'Código de indicação gerado'], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Referral code generation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar código de indicação'], 500);
        }
    }

    // 3. ROI Calculator
    public function roiCalculator(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'monthly_os_count' => 'required|integer|min:1',
            'avg_os_value' => 'required|numeric|min:1',
            'current_monthly_cost' => 'required|numeric|min:0',
            'system_monthly_cost' => 'required|numeric|min:0',
            'time_saved_percent' => 'nullable|numeric|min:0|max:100',
        ]);

        $monthlyRevenue = $validated['monthly_os_count'] * $validated['avg_os_value'];
        $timeSaved = $validated['time_saved_percent'] ?? 30;
        $additionalCapacity = $validated['monthly_os_count'] * ($timeSaved / 100);
        $additionalRevenue = $additionalCapacity * $validated['avg_os_value'];
        $monthlySavings = $validated['current_monthly_cost'] - $validated['system_monthly_cost'] + $additionalRevenue;
        $annualRoi = ($monthlySavings * 12) / max($validated['system_monthly_cost'] * 12, 1) * 100;
        $paybackMonths = $validated['system_monthly_cost'] > 0 ? ceil($validated['system_monthly_cost'] / max($monthlySavings, 1)) : 0;

        return response()->json([
            'data' => [
                'current_monthly_revenue' => $monthlyRevenue,
                'additional_os_capacity' => round($additionalCapacity),
                'additional_monthly_revenue' => round($additionalRevenue, 2),
                'monthly_savings' => round($monthlySavings, 2),
                'annual_roi_percent' => round($annualRoi, 1),
                'payback_months' => $paybackMonths,
                'time_saved_percent' => $timeSaved,
            ],
        ]);
    }

    // 4. Presentation Mode
    public function presentationData(): JsonResponse
    {
        $tenantId = $this->tenantId();

        $data = [
            'company' => DB::table('tenants')->where('id', $tenantId)->first(['name', 'document', 'logo_url']),
            'kpis' => [
                'total_customers' => DB::table('customers')->where('tenant_id', $tenantId)->count(),
                'total_os_year' => DB::table('work_orders')->where('tenant_id', $tenantId)->whereYear('created_at', now()->year)->count(),
                'revenue_year' => DB::table('accounts_receivable')->where('tenant_id', $tenantId)->where('status', 'paid')->whereYear('paid_at', now()->year)->sum('amount'),
                'nps_score' => DB::table('nps_surveys')->where('tenant_id', $tenantId)->avg('score'),
                'certificates_issued' => DB::table('calibration_certificates')->where('tenant_id', $tenantId)->whereYear('issued_at', now()->year)->count(),
            ],
            'monthly_trend' => DB::table('work_orders')
                ->where('tenant_id', $tenantId)
                ->whereYear('created_at', now()->year)
                ->select(DB::raw('MONTH(created_at) as month'), DB::raw('COUNT(*) as total'))
                ->groupByRaw('MONTH(created_at)')
                ->get(),
        ];

        return response()->json(['data' => $data]);
    }

    // 5. Easter Eggs
    public function easterEgg(string $code): JsonResponse
    {
        $eggs = [
            'konami' => '🎮 ↑↑↓↓←→←→BA - Você encontrou o Konami Code! +1000 pontos de experiência!',
            'matrix' => '💊 Red pill or blue pill? Você escolheu ver a verdade do código...',
            'rocket' => '🚀 To infinity and beyond! O Kalibrium está pronto para o espaço!',
            'coffee' => '☕ Error 418: I\'m a teapot... mas fazemos café também!',
            'calibrium' => '⚖️ Precisão é a nossa paixão! Obrigado por fazer parte da nossa história.',
        ];

        $message = $eggs[$code] ?? '🔍 Hmm... não encontrei nada aqui. Continue explorando!';

        return response()->json(['message' => $message, 'found' => isset($eggs[$code])]);
    }

    // ═══ MOBILE BACKEND ENDPOINTS (FASE 3) ═══════════════════════════

    // 1. Câmera Térmica — armazenar leituras térmicas de campo
    public function storeThermalReading(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|integer',
            'equipment_id' => 'nullable|integer',
            'temperature' => 'required|numeric',
            'unit' => 'required|in:celsius,fahrenheit',
            'image_path' => 'nullable|string',
            'notes' => 'nullable|string|max:500',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('thermal_readings')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'work_order_id' => $validated['work_order_id'],
                'equipment_id' => $validated['equipment_id'] ?? null,
                'temperature' => $validated['temperature'],
                'unit' => $validated['unit'],
                'image_path' => $validated['image_path'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
                'measured_by' => auth()->id(),
                'measured_at' => now(),
                'created_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Leitura térmica registrada', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Thermal reading failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar leitura térmica'], 500);
        }
    }

    // 2. Kiosk Config — configuração de modo quiosque
    public function kioskConfig(): JsonResponse
    {
        $config = DB::table('kiosk_configs')
            ->where('tenant_id', $this->tenantId())
            ->first();

        return response()->json([
            'data' => $config ?? [
                'enabled' => false,
                'allowed_pages' => ['dashboard', 'work-orders'],
                'idle_timeout_seconds' => 300,
                'auto_logout' => true,
                'show_header' => false,
            ],
        ]);
    }

    public function updateKioskConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'allowed_pages' => 'nullable|array',
            'allowed_pages.*' => 'string|max:50',
            'idle_timeout_seconds' => 'nullable|integer|min:30|max:3600',
            'auto_logout' => 'boolean',
            'show_header' => 'boolean',
            'pin_code' => 'nullable|string|min:4|max:8',
        ]);

        try {
            DB::table('kiosk_configs')->updateOrInsert(
                ['tenant_id' => $this->tenantId()],
                [
                    'enabled' => $validated['enabled'],
                    'allowed_pages' => json_encode($validated['allowed_pages'] ?? ['dashboard']),
                    'idle_timeout_seconds' => $validated['idle_timeout_seconds'] ?? 300,
                    'auto_logout' => $validated['auto_logout'] ?? true,
                    'show_header' => $validated['show_header'] ?? false,
                    'pin_code' => isset($validated['pin_code']) ? bcrypt($validated['pin_code']) : null,
                    'updated_at' => now(),
                ]
            );

            return response()->json(['message' => 'Configuração de quiosque atualizada']);
        } catch (\Exception $e) {
            Log::error('Kiosk config update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar configuração de quiosque'], 500);
        }
    }

    // 3. Offline Map Regions — regiões disponíveis para cache de mapa offline
    public function offlineMapRegions(): JsonResponse
    {
        $regions = DB::table('offline_map_regions')
            ->where('tenant_id', $this->tenantId())
            ->where('is_active', true)
            ->select('id', 'name', 'bounds', 'zoom_min', 'zoom_max', 'estimated_size_mb', 'updated_at')
            ->orderBy('name')
            ->get()
            ->map(function ($region) {
                $region->bounds = json_decode($region->bounds);
                return $region;
            });

        if ($regions->isEmpty()) {
            $regions = collect([
                [
                    'id' => 'default',
                    'name' => 'Região Metropolitana',
                    'bounds' => ['north' => -15.5, 'south' => -16.0, 'east' => -55.8, 'west' => -56.3],
                    'zoom_min' => 10,
                    'zoom_max' => 16,
                    'estimated_size_mb' => 45,
                ],
            ]);
        }

        return response()->json(['data' => $regions]);
    }
}
