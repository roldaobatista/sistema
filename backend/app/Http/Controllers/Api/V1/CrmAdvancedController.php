<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Quote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CrmAdvancedController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1. PDF PROPOSAL GENERATOR (Gerador de Propostas PDF)
    // ═══════════════════════════════════════════════════════════════════

    public function generateProposalPdf(int $quoteId): JsonResponse
    {
        $tenantId = $this->tenantId();

        $quote = Quote::where('tenant_id', $tenantId)
            ->with(['customer', 'items.product', 'createdBy'])
            ->findOrFail($quoteId);

        $data = [
            'quote_number' => $quote->number ?? "ORC-{$quote->id}",
            'date' => $quote->created_at->format('d/m/Y'),
            'valid_until' => $quote->valid_until ?? $quote->created_at->addDays(30)->format('d/m/Y'),
            'customer' => [
                'name' => $quote->customer?->name,
                'document' => $quote->customer?->document,
                'email' => $quote->customer?->email,
                'phone' => $quote->customer?->phone,
                'address' => $quote->customer?->address,
            ],
            'items' => $quote->items->map(fn($i) => [
                'description' => $i->product?->name ?? $i->description,
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
                'total' => $i->total,
            ]),
            'subtotal' => $quote->subtotal ?? $quote->items->sum('total'),
            'discount' => $quote->discount ?? 0,
            'total' => $quote->total ?? $quote->items->sum('total'),
            'notes' => $quote->notes,
            'payment_terms' => $quote->payment_terms,
            'seller' => $quote->createdBy?->name ?? 'N/A',
        ];

        return response()->json(['data' => $data, 'message' => 'Dados para geração de PDF']);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. MULTI-OPTION QUOTES (Orçamentos com Múltiplas Opções)
    // ═══════════════════════════════════════════════════════════════════

    public function multiOptionQuotes(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $quotes = Quote::where('tenant_id', $tenantId)
            ->whereNotNull('parent_quote_id')
            ->with('customer:id,name')
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($quotes);
    }

    public function createQuoteVariant(Request $request, int $quoteId): JsonResponse
    {
        $tenantId = $this->tenantId();

        $original = Quote::where('tenant_id', $tenantId)->findOrFail($quoteId);

        try {
            DB::beginTransaction();

            $variant = $original->replicate();
            $variant->parent_quote_id = $original->id;
            $variant->option_label = $request->input('option_label', 'Opção alternativa');
            $variant->status = 'draft';
            $variant->save();

            foreach ($original->items as $item) {
                $newItem = $item->replicate();
                $newItem->quote_id = $variant->id;
                $newItem->save();
            }

            DB::commit();
            return response()->json(['message' => 'Variante criada com sucesso', 'data' => $variant], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Quote variant creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar variante'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. CLIENT HEAT MAP (Mapa de Calor de Clientes)
    // ═══════════════════════════════════════════════════════════════════

    public function clientHeatMap(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $customers = Customer::where('tenant_id', $tenantId)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->select('id', 'name', 'latitude', 'longitude', 'city', 'state')
            ->withCount(['workOrders' => fn($q) => $q->where('created_at', '>=', now()->subMonths(12))])
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'lat' => (float) $c->latitude,
                'lng' => (float) $c->longitude,
                'city' => $c->city,
                'state' => $c->state,
                'intensity' => min($c->work_orders_count * 10, 100),
                'os_count' => $c->work_orders_count,
            ]);

        $byCity = $customers->groupBy('city')->map(fn($group) => [
            'count' => $group->count(),
            'total_os' => $group->sum('os_count'),
        ])->sortByDesc('total_os')->take(20);

        return response()->json([
            'data' => [
                'points' => $customers,
                'by_city' => $byCity,
                'total_geolocated' => $customers->count(),
            ],
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. SALES GAMIFICATION (Gamificação de Vendas)
    // ═══════════════════════════════════════════════════════════════════

    public function salesGamification(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $month = $request->input('month', now()->month);
        $year = $request->input('year', now()->year);

        $leaderboard = DB::table('quotes')
            ->where('quotes.tenant_id', $tenantId)
            ->where('quotes.status', 'approved')
            ->whereMonth('quotes.approved_at', $month)
            ->whereYear('quotes.approved_at', $year)
            ->join('users', 'quotes.created_by', '=', 'users.id')
            ->select(
                'users.id',
                'users.name',
                DB::raw('COUNT(quotes.id) as deals_won'),
                DB::raw('SUM(quotes.total) as total_revenue'),
                DB::raw('AVG(DATEDIFF(quotes.approved_at, quotes.created_at)) as avg_cycle_days')
            )
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('total_revenue')
            ->get()
            ->map(function ($seller, $index) {
                $seller->rank = $index + 1;
                $seller->badge = match (true) {
                    $index === 0 => '🥇 Campeão',
                    $index === 1 => '🥈 Vice',
                    $index === 2 => '🥉 Bronze',
                    $seller->deals_won >= 10 => '⭐ Estrela',
                    $seller->deals_won >= 5 => '🔥 Quente',
                    default => '📊 Em crescimento',
                };
                return $seller;
            });

        return response()->json(['data' => $leaderboard]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. LEAD IMPORT (Importar Leads)
    // ═══════════════════════════════════════════════════════════════════

    public function importLeads(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => 'required|in:linkedin,google,csv,manual',
            'leads' => 'required|array|min:1',
            'leads.*.name' => 'required|string|max:255',
            'leads.*.email' => 'nullable|email',
            'leads.*.phone' => 'nullable|string',
            'leads.*.company' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $tenantId = $this->tenantId();
            $imported = 0;
            $skipped = 0;

            foreach ($validated['leads'] as $lead) {
                $exists = DB::table('crm_deals')
                    ->where('tenant_id', $tenantId)
                    ->where(function ($q) use ($lead) {
                        if (!empty($lead['email'])) {
                            $q->where('contact_email', $lead['email']);
                        }
                        if (!empty($lead['phone'])) {
                            $q->orWhere('contact_phone', $lead['phone']);
                        }
                    })
                    ->exists();

                if ($exists) {
                    $skipped++;
                    continue;
                }

                DB::table('crm_deals')->insert([
                    'tenant_id' => $tenantId,
                    'title' => $lead['name'],
                    'contact_name' => $lead['name'],
                    'contact_email' => $lead['email'] ?? null,
                    'contact_phone' => $lead['phone'] ?? null,
                    'company_name' => $lead['company'] ?? null,
                    'source' => $validated['source'],
                    'stage' => 'lead',
                    'value' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $imported++;
            }

            DB::commit();
            return response()->json([
                'message' => "Importação concluída: {$imported} leads importados, {$skipped} duplicados ignorados",
                'imported' => $imported,
                'skipped' => $skipped,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Lead import failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao importar leads'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. EMAIL MARKETING CAMPAIGNS (Campanhas de E-mail)
    // ═══════════════════════════════════════════════════════════════════

    public function emailCampaigns(Request $request): JsonResponse
    {
        $data = DB::table('email_campaigns')
            ->where('tenant_id', $this->tenantId())
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeEmailCampaign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'subject' => 'required|string|max:255',
            'content' => 'required|string',
            'segment' => 'nullable|in:all,active,inactive,vip,prospects',
            'scheduled_at' => 'nullable|date|after:now',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('email_campaigns')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'name' => $validated['name'],
                'subject' => $validated['subject'],
                'content' => $validated['content'],
                'segment' => $validated['segment'] ?? 'all',
                'status' => 'draft',
                'scheduled_at' => $validated['scheduled_at'] ?? null,
                'created_by' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Campanha criada com sucesso', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Email campaign creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar campanha'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. WHATSAPP INTEGRATION (Integração WhatsApp)
    // ═══════════════════════════════════════════════════════════════════

    public function sendWhatsApp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'message' => 'required|string|max:4000',
            'template' => 'nullable|in:quote_followup,payment_reminder,appointment_confirmation,certificate_ready',
        ]);

        $customer = Customer::findOrFail($validated['customer_id']);

        if (!$customer->phone) {
            return response()->json(['message' => 'Cliente sem telefone cadastrado'], 422);
        }

        try {
            $phone = preg_replace('/[^0-9]/', '', $customer->phone);
            if (strlen($phone) <= 11) {
                $phone = '55' . $phone;
            }

            DB::table('whatsapp_messages')->insert([
                'tenant_id' => $this->tenantId(),
                'customer_id' => $customer->id,
                'phone' => $phone,
                'message' => $validated['message'],
                'template' => $validated['template'] ?? null,
                'status' => 'queued',
                'created_by' => auth()->id(),
                'created_at' => now(),
            ]);

            return response()->json([
                'message' => 'Mensagem adicionada à fila de envio',
                'whatsapp_link' => "https://wa.me/{$phone}?text=" . urlencode($validated['message']),
            ]);
        } catch (\Exception $e) {
            Log::error('WhatsApp message failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao enviar mensagem'], 500);
        }
    }

    public function whatsAppHistory(Request $request): JsonResponse
    {
        $data = DB::table('whatsapp_messages')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('customer_id'), fn($q, $c) => $q->where('customer_id', $c))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. SELF-SERVICE QUOTE PORTAL
    // ═══════════════════════════════════════════════════════════════════

    public function selfServiceCatalog(): JsonResponse
    {
        $tenantId = $this->tenantId();

        $services = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('type', 'service')
            ->select('id', 'name', 'description', 'sale_price', 'category')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $services]);
    }

    public function selfServiceQuoteRequest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_name' => 'required|string|max:255',
            'customer_email' => 'required|email',
            'customer_phone' => 'required|string|max:20',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('self_service_quote_requests')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'customer_name' => $validated['customer_name'],
                'customer_email' => $validated['customer_email'],
                'customer_phone' => $validated['customer_phone'],
                'items' => json_encode($validated['items']),
                'notes' => $validated['notes'] ?? null,
                'status' => 'pending',
                'created_at' => now(),
            ]);

            DB::commit();
            return response()->json([
                'message' => 'Solicitação de orçamento recebida. Entraremos em contato em breve.',
                'request_id' => $id,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Self-service quote request failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar solicitação'], 500);
        }
    }
}
