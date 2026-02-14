<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PortalClienteController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1. EXECUTIVE DASHBOARD (Dashboard Executivo)
    // ═══════════════════════════════════════════════════════════════════

    public function executiveDashboard(int $customerId): JsonResponse
    {
        $tenantId = $this->tenantId();

        $stats = [
            'total_os' => DB::table('work_orders')->where('tenant_id', $tenantId)->where('customer_id', $customerId)->count(),
            'os_pending' => DB::table('work_orders')->where('tenant_id', $tenantId)->where('customer_id', $customerId)->where('status', 'pending')->count(),
            'os_completed' => DB::table('work_orders')->where('tenant_id', $tenantId)->where('customer_id', $customerId)->where('status', 'completed')->count(),
            'total_certificates' => DB::table('calibration_certificates')->where('tenant_id', $tenantId)->where('customer_id', $customerId)->count(),
            'certificates_valid' => DB::table('calibration_certificates')->where('tenant_id', $tenantId)->where('customer_id', $customerId)->where('valid_until', '>', now())->count(),
            'certificates_expiring' => DB::table('calibration_certificates')->where('tenant_id', $tenantId)->where('customer_id', $customerId)->whereBetween('valid_until', [now(), now()->addDays(30)])->count(),
            'open_invoices' => DB::table('accounts_receivable')->where('tenant_id', $tenantId)->where('customer_id', $customerId)->where('status', 'pending')->sum('amount'),
            'last_service_date' => DB::table('work_orders')->where('tenant_id', $tenantId)->where('customer_id', $customerId)->max('completed_at'),
        ];

        $recentOs = DB::table('work_orders')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get(['id', 'number', 'status', 'created_at', 'scheduled_at']);

        return response()->json([
            'data' => ['stats' => $stats, 'recent_orders' => $recentOs],
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. BATCH CERTIFICATE DOWNLOAD
    // ═══════════════════════════════════════════════════════════════════

    public function batchCertificateDownload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'certificate_ids' => 'nullable|array',
            'certificate_ids.*' => 'exists:calibration_certificates,id',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
        ]);

        $query = DB::table('calibration_certificates')
            ->where('tenant_id', $this->tenantId())
            ->where('customer_id', $validated['customer_id']);

        if (!empty($validated['certificate_ids'])) {
            $query->whereIn('id', $validated['certificate_ids']);
        }
        if (!empty($validated['date_from'])) {
            $query->where('issued_at', '>=', $validated['date_from']);
        }
        if (!empty($validated['date_to'])) {
            $query->where('issued_at', '<=', $validated['date_to']);
        }

        $certificates = $query->select('id', 'number', 'issued_at', 'valid_until', 'file_path')->get();

        return response()->json([
            'data' => $certificates,
            'total' => $certificates->count(),
            'message' => "Preparados {$certificates->count()} certificados para download",
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. QR CODE TICKET OPENING
    // ═══════════════════════════════════════════════════════════════════

    public function openTicketByQrCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'qr_data' => 'required|string',
            'customer_id' => 'required|exists:customers,id',
            'description' => 'required|string|max:1000',
            'priority' => 'nullable|in:low,medium,high,critical',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('support_tickets')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'customer_id' => $validated['customer_id'],
                'source' => 'qr_code',
                'qr_data' => $validated['qr_data'],
                'description' => $validated['description'],
                'priority' => $validated['priority'] ?? 'medium',
                'status' => 'open',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Chamado aberto com sucesso via QR Code', 'ticket_id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('QR code ticket creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao abrir chamado'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. ONE-CLICK QUOTE APPROVAL
    // ═══════════════════════════════════════════════════════════════════

    public function oneClickApproval(Request $request, int $quoteId): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'approval_token' => 'required|string',
        ]);

        try {
            $quote = DB::table('quotes')
                ->where('id', $quoteId)
                ->where('customer_id', $validated['customer_id'])
                ->first();

            if (!$quote) {
                return response()->json(['message' => 'Orçamento não encontrado'], 404);
            }

            if ($quote->status === 'approved') {
                return response()->json(['message' => 'Orçamento já aprovado anteriormente']);
            }

            DB::beginTransaction();

            DB::table('quotes')
                ->where('id', $quoteId)
                ->update([
                    'status' => 'approved',
                    'approved_at' => now(),
                    'approved_by_client' => true,
                    'updated_at' => now(),
                ]);

            DB::commit();
            return response()->json(['message' => 'Orçamento aprovado com sucesso!']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('One-click approval failed', ['error' => $e->getMessage(), 'quote_id' => $quoteId]);
            return response()->json(['message' => 'Erro ao aprovar orçamento'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. REAL-TIME SUPPORT CHAT
    // ═══════════════════════════════════════════════════════════════════

    public function chatMessages(Request $request, int $ticketId): JsonResponse
    {
        $messages = DB::table('chat_messages')
            ->where('ticket_id', $ticketId)
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $messages]);
    }

    public function sendChatMessage(Request $request, int $ticketId): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:2000',
            'sender_type' => 'required|in:customer,agent',
        ]);

        try {
            $id = DB::table('chat_messages')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'ticket_id' => $ticketId,
                'sender_id' => auth()->id(),
                'sender_type' => $validated['sender_type'],
                'message' => $validated['message'],
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Mensagem enviada', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Chat message send failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao enviar mensagem'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. FINANCIAL HISTORY & 2ND INVOICE COPY
    // ═══════════════════════════════════════════════════════════════════

    public function financialHistory(Request $request, int $customerId): JsonResponse
    {
        $data = DB::table('accounts_receivable')
            ->where('tenant_id', $this->tenantId())
            ->where('customer_id', $customerId)
            ->orderByDesc('due_date')
            ->paginate(20);

        return response()->json($data);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. ONLINE SELF-SCHEDULING
    // ═══════════════════════════════════════════════════════════════════

    public function availableSlots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date|after:today',
            'service_type' => 'nullable|string',
        ]);

        $date = \Carbon\Carbon::parse($validated['date']);
        $slots = [];
        $hours = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

        $bookedSlots = DB::table('work_orders')
            ->where('tenant_id', $this->tenantId())
            ->whereDate('scheduled_at', $date)
            ->pluck('scheduled_at')
            ->map(fn($s) => \Carbon\Carbon::parse($s)->format('H:i'))
            ->toArray();

        foreach ($hours as $hour) {
            $slots[] = [
                'time' => $hour,
                'available' => !in_array($hour, $bookedSlots),
            ];
        }

        return response()->json(['data' => ['date' => $date->format('Y-m-d'), 'slots' => $slots]]);
    }

    public function bookSlot(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'date' => 'required|date|after:today',
            'time' => 'required|string',
            'service_type' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $scheduledAt = \Carbon\Carbon::parse($validated['date'] . ' ' . $validated['time']);

            $id = DB::table('scheduled_appointments')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'customer_id' => $validated['customer_id'],
                'scheduled_at' => $scheduledAt,
                'service_type' => $validated['service_type'],
                'notes' => $validated['notes'] ?? null,
                'status' => 'confirmed',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Agendamento confirmado', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Slot booking failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao agendar'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. BROWSER PUSH NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════════

    public function registerPushSubscription(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => 'required|url',
            'keys' => 'required|array',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ]);

        try {
            DB::table('push_subscriptions')->updateOrInsert(
                ['user_id' => auth()->id(), 'endpoint' => $validated['endpoint']],
                [
                    'tenant_id' => $this->tenantId(),
                    'p256dh_key' => $validated['keys']['p256dh'],
                    'auth_key' => $validated['keys']['auth'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            return response()->json(['message' => 'Inscrição push registrada com sucesso']);
        } catch (\Exception $e) {
            Log::error('Push subscription registration failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar inscrição push'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 9. KNOWLEDGE BASE (FAQ)
    // ═══════════════════════════════════════════════════════════════════

    public function knowledgeBase(Request $request): JsonResponse
    {
        $articles = DB::table('knowledge_base_articles')
            ->where('tenant_id', $this->tenantId())
            ->where('published', true)
            ->when($request->input('category'), fn($q, $c) => $q->where('category', $c))
            ->when($request->input('search'), fn($q, $s) => $q->where('title', 'like', "%{$s}%")->orWhere('content', 'like', "%{$s}%"))
            ->orderBy('sort_order')
            ->paginate(20);

        return response()->json($articles);
    }

    public function storeArticle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'category' => 'required|string|max:100',
            'published' => 'boolean',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('knowledge_base_articles')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'title' => $validated['title'],
                'content' => $validated['content'],
                'category' => $validated['category'],
                'published' => $validated['published'] ?? false,
                'sort_order' => 0,
                'created_by' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Artigo criado', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Knowledge base article creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar artigo'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 10. MULTI-LOCATION MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    public function customerLocations(int $customerId): JsonResponse
    {
        $locations = DB::table('customer_locations')
            ->where('customer_id', $customerId)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $locations]);
    }

    public function storeLocation(Request $request, int $customerId): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'required|string|max:500',
            'city' => 'required|string|max:100',
            'state' => 'required|string|max:2',
            'zip_code' => 'nullable|string|max:10',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'contact_name' => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:20',
        ]);

        try {
            DB::beginTransaction();

            $validated['customer_id'] = $customerId;
            $validated['tenant_id'] = $this->tenantId();
            $validated['created_at'] = now();
            $validated['updated_at'] = now();

            $id = DB::table('customer_locations')->insertGetId($validated);

            DB::commit();
            return response()->json(['message' => 'Localidade cadastrada', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Customer location creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao cadastrar localidade'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 11. PUBLIC API
    // ═══════════════════════════════════════════════════════════════════

    public function publicApiOverview(): JsonResponse
    {
        return response()->json([
            'data' => [
                'version' => 'v1',
                'endpoints' => [
                    ['method' => 'GET', 'path' => '/api/v1/portal/dashboard/{customerId}', 'description' => 'Dashboard executivo'],
                    ['method' => 'GET', 'path' => '/api/v1/portal/certificates/{customerId}', 'description' => 'Certificados'],
                    ['method' => 'POST', 'path' => '/api/v1/portal/tickets', 'description' => 'Abrir chamado'],
                    ['method' => 'GET', 'path' => '/api/v1/portal/financial/{customerId}', 'description' => 'Histórico financeiro'],
                    ['method' => 'GET', 'path' => '/api/v1/portal/schedule/slots', 'description' => 'Horários disponíveis'],
                    ['method' => 'POST', 'path' => '/api/v1/portal/schedule/book', 'description' => 'Agendar atendimento'],
                ],
                'rate_limit' => '100 requests/minute',
                'auth' => 'Bearer token (API Key)',
            ],
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 12. WHITE LABEL CONFIG
    // ═══════════════════════════════════════════════════════════════════

    public function whiteLabelConfig(): JsonResponse
    {
        $config = DB::table('portal_white_label')
            ->where('tenant_id', $this->tenantId())
            ->first();

        return response()->json(['data' => $config ?? ['theme' => 'default', 'logo' => null, 'colors' => []]]);
    }

    public function updateWhiteLabelConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => 'nullable|string|max:255',
            'logo_url' => 'nullable|url',
            'primary_color' => 'nullable|string|max:7',
            'secondary_color' => 'nullable|string|max:7',
            'custom_css' => 'nullable|string|max:5000',
            'custom_domain' => 'nullable|string|max:255',
        ]);

        try {
            DB::table('portal_white_label')->updateOrInsert(
                ['tenant_id' => $this->tenantId()],
                array_merge($validated, ['updated_at' => now()])
            );

            return response()->json(['message' => 'Configuração atualizada']);
        } catch (\Exception $e) {
            Log::error('White label config update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar configuração'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 13. NPS SURVEYS
    // ═══════════════════════════════════════════════════════════════════

    public function npsSurveys(Request $request): JsonResponse
    {
        $data = DB::table('nps_surveys')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('customer_id'), fn($q, $c) => $q->where('customer_id', $c))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function submitNps(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'score' => 'required|integer|min:0|max:10',
            'comment' => 'nullable|string|max:1000',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('nps_surveys')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'customer_id' => $validated['customer_id'],
                'work_order_id' => $validated['work_order_id'] ?? null,
                'score' => $validated['score'],
                'category' => match (true) {
                    $validated['score'] >= 9 => 'promoter',
                    $validated['score'] >= 7 => 'neutral',
                    default => 'detractor',
                },
                'comment' => $validated['comment'] ?? null,
                'created_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Avaliação registrada. Obrigado!', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('NPS submission failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar avaliação'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 14. EQUIPMENT VISUAL MAP
    // ═══════════════════════════════════════════════════════════════════

    public function equipmentMap(int $customerId): JsonResponse
    {
        $equipment = DB::table('customer_equipment')
            ->where('customer_id', $customerId)
            ->select('id', 'name', 'type', 'serial_number', 'location', 'last_calibration_at', 'next_calibration_at', 'status')
            ->orderBy('location')
            ->orderBy('name')
            ->get()
            ->groupBy('location');

        return response()->json(['data' => $equipment]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 15. BI SELF-SERVICE REPORTS
    // ═══════════════════════════════════════════════════════════════════

    public function biSelfServiceReport(Request $request, int $customerId): JsonResponse
    {
        $validated = $request->validate([
            'report_type' => 'required|in:calibration_history,cost_analysis,compliance_status,equipment_lifecycle',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
        ]);

        $tenantId = $this->tenantId();

        $data = match ($validated['report_type']) {
            'calibration_history' => DB::table('calibration_certificates')
                ->where('tenant_id', $tenantId)->where('customer_id', $customerId)
                ->when($validated['date_from'] ?? null, fn($q, $d) => $q->where('issued_at', '>=', $d))
                ->select(DB::raw('MONTH(issued_at) as month'), DB::raw('COUNT(*) as total'))
                ->groupByRaw('MONTH(issued_at)')
                ->get(),
            'cost_analysis' => DB::table('work_orders')
                ->where('tenant_id', $tenantId)->where('customer_id', $customerId)
                ->select(DB::raw('MONTH(created_at) as month'), DB::raw('SUM(total) as total_cost'), DB::raw('COUNT(*) as os_count'))
                ->groupByRaw('MONTH(created_at)')
                ->get(),
            'compliance_status' => [
                'total_equipment' => DB::table('customer_equipment')->where('customer_id', $customerId)->count(),
                'calibrated' => DB::table('customer_equipment')->where('customer_id', $customerId)->where('next_calibration_at', '>', now())->count(),
                'overdue' => DB::table('customer_equipment')->where('customer_id', $customerId)->where('next_calibration_at', '<', now())->count(),
            ],
            'equipment_lifecycle' => DB::table('customer_equipment')
                ->where('customer_id', $customerId)
                ->select('id', 'name', 'purchased_at', 'last_calibration_at', 'next_calibration_at', 'status')
                ->get(),
            default => [],
        };

        return response()->json(['data' => $data, 'report_type' => $validated['report_type']]);
    }
}
