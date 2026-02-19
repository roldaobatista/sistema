<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ScopesByRole;
use App\Models\AccountPlan;
use App\Models\AccountPlanAction;
use App\Models\Commitment;
use App\Models\ContactPolicy;
use App\Models\CrmActivity;
use App\Models\CrmDeal;
use App\Models\Customer;
use App\Models\CustomerRfmScore;
use App\Models\GamificationBadge;
use App\Models\GamificationScore;
use App\Models\ImportantDate;
use App\Models\QuickNote;
use App\Models\VisitCheckin;
use App\Models\VisitReport;
use App\Models\VisitRoute;
use App\Models\VisitRouteStop;
use App\Models\VisitSurvey;
use App\Models\WorkOrder;
use App\Models\Quote;
use App\Models\Equipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class CrmFieldManagementController extends Controller
{
    use ScopesByRole;

    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════
    // 1. VISIT CHECKINS
    // ═══════════════════════════════════════════════════════

    public function checkinsIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $q = VisitCheckin::where('tenant_id', $tenantId)
            ->with(['customer:id,name,phone,address_city', 'user:id,name']);

        if ($request->filled('user_id')) $q->where('user_id', $request->user_id);
        if ($request->filled('customer_id')) $q->where('customer_id', $request->customer_id);
        if ($request->filled('status')) $q->where('status', $request->status);
        if ($request->filled('date_from')) $q->where('checkin_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $q->where('checkin_at', '<=', $request->date_to . ' 23:59:59');

        return response()->json($q->orderByDesc('checkin_at')->paginate($request->get('per_page', 25)));
    }

    public function checkin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'checkin_lat' => 'nullable|numeric',
            'checkin_lng' => 'nullable|numeric',
            'checkin_address' => 'nullable|string|max:500',
            'notes' => 'nullable|string',
        ]);

        $tenantId = $this->tenantId($request);
        $customer = Customer::where('tenant_id', $tenantId)->findOrFail($data['customer_id']);

        $distanceMeters = null;
        if ($customer->latitude && $customer->longitude && isset($data['checkin_lat']) && isset($data['checkin_lng'])) {
            $distanceMeters = $this->haversineDistance(
                $data['checkin_lat'], $data['checkin_lng'],
                $customer->latitude, $customer->longitude
            );
        }

        $checkin = VisitCheckin::create([
            'tenant_id' => $tenantId,
            'customer_id' => $customer->id,
            'user_id' => $request->user()->id,
            'checkin_at' => now(),
            'checkin_lat' => $data['checkin_lat'] ?? null,
            'checkin_lng' => $data['checkin_lng'] ?? null,
            'checkin_address' => $data['checkin_address'] ?? null,
            'distance_from_client_meters' => $distanceMeters,
            'status' => 'checked_in',
            'notes' => $data['notes'] ?? null,
        ]);

        $activity = CrmActivity::create([
            'tenant_id' => $tenantId,
            'type' => 'visita',
            'customer_id' => $customer->id,
            'user_id' => $request->user()->id,
            'title' => 'Check-in: ' . $customer->name,
            'scheduled_at' => now(),
            'channel' => 'presencial',
        ]);

        $checkin->update(['activity_id' => $activity->id]);
        $customer->update(['last_contact_at' => now()]);

        return response()->json($checkin->load(['customer:id,name', 'user:id,name']), 201);
    }

    public function checkout(Request $request, VisitCheckin $checkin): JsonResponse
    {
        if ($checkin->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        if ($checkin->status !== 'checked_in') {
            return response()->json(['message' => 'Checkin já finalizado.'], 422);
        }

        $data = $request->validate([
            'checkout_lat' => 'nullable|numeric',
            'checkout_lng' => 'nullable|numeric',
            'notes' => 'nullable|string',
        ]);

        $checkin->checkout(
            $data['checkout_lat'] ?? null,
            $data['checkout_lng'] ?? null,
            null
        );

        if (isset($data['notes'])) {
            $checkin->update(['notes' => $data['notes']]);
        }

        if ($checkin->activity_id) {
            CrmActivity::where('id', $checkin->activity_id)->update([
                'completed_at' => now(),
                'duration_minutes' => $checkin->duration_minutes,
                'outcome' => 'sucesso',
            ]);
        }

        return response()->json($checkin->fresh(['customer:id,name', 'user:id,name']));
    }

    // ═══════════════════════════════════════════════════════
    // 2. VISIT ROUTES
    // ═══════════════════════════════════════════════════════

    public function routesIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $q = VisitRoute::where('tenant_id', $tenantId)
            ->with(['user:id,name', 'stops.customer:id,name,address_city,latitude,longitude']);

        if ($request->filled('user_id')) $q->where('user_id', $request->user_id);
        if ($request->filled('date')) $q->whereDate('route_date', $request->date);
        if ($request->filled('status')) $q->where('status', $request->status);

        return response()->json($q->orderByDesc('route_date')->paginate($request->get('per_page', 25)));
    }

    public function routesStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'route_date' => 'required|date',
            'name' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'stops' => 'required|array|min:1',
            'stops.*.customer_id' => 'required|exists:customers,id',
            'stops.*.estimated_duration_minutes' => 'nullable|integer',
            'stops.*.objective' => 'nullable|string|max:500',
        ]);

        $tenantId = $this->tenantId($request);

        $route = VisitRoute::create([
            'tenant_id' => $tenantId,
            'user_id' => $request->user()->id,
            'route_date' => $data['route_date'],
            'name' => $data['name'] ?? 'Rota ' . $data['route_date'],
            'total_stops' => count($data['stops']),
            'notes' => $data['notes'] ?? null,
        ]);

        foreach ($data['stops'] as $i => $stop) {
            VisitRouteStop::create([
                'visit_route_id' => $route->id,
                'customer_id' => $stop['customer_id'],
                'stop_order' => $i + 1,
                'estimated_duration_minutes' => $stop['estimated_duration_minutes'] ?? null,
                'objective' => $stop['objective'] ?? null,
            ]);
        }

        return response()->json($route->load(['stops.customer:id,name,address_city,latitude,longitude']), 201);
    }

    public function routesUpdate(Request $request, VisitRoute $route): JsonResponse
    {
        if ($route->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $data = $request->validate([
            'status' => ['nullable', Rule::in(array_keys(VisitRoute::STATUSES))],
            'name' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $route->update(array_filter($data, fn($v) => $v !== null));
        return response()->json($route->fresh(['stops.customer:id,name']));
    }

    // ═══════════════════════════════════════════════════════
    // 3. VISIT REPORTS
    // ═══════════════════════════════════════════════════════

    public function reportsIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $q = VisitReport::where('tenant_id', $tenantId)
            ->with(['customer:id,name', 'user:id,name']);

        if ($request->filled('customer_id')) $q->where('customer_id', $request->customer_id);
        if ($request->filled('user_id')) $q->where('user_id', $request->user_id);
        if ($request->filled('sentiment')) $q->where('overall_sentiment', $request->sentiment);

        return response()->json($q->orderByDesc('visit_date')->paginate($request->get('per_page', 25)));
    }

    public function reportsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'checkin_id' => 'nullable|exists:visit_checkins,id',
            'deal_id' => 'nullable|exists:crm_deals,id',
            'visit_date' => 'required|date',
            'visit_type' => ['nullable', Rule::in(array_keys(VisitReport::VISIT_TYPES))],
            'contact_name' => 'nullable|string|max:255',
            'contact_role' => 'nullable|string|max:255',
            'summary' => 'required|string',
            'decisions' => 'nullable|string',
            'next_steps' => 'nullable|string',
            'overall_sentiment' => ['nullable', Rule::in(array_keys(VisitReport::SENTIMENTS))],
            'topics' => 'nullable|array',
            'follow_up_scheduled' => 'boolean',
            'next_contact_at' => 'nullable|date',
            'next_contact_type' => 'nullable|string',
            'commitments' => 'nullable|array',
            'commitments.*.title' => 'required|string',
            'commitments.*.responsible_type' => ['required', Rule::in(array_keys(Commitment::RESPONSIBLE_TYPES))],
            'commitments.*.due_date' => 'nullable|date',
            'commitments.*.priority' => ['nullable', Rule::in(array_keys(Commitment::PRIORITIES))],
        ]);

        $tenantId = $this->tenantId($request);

        $report = VisitReport::create([
            'tenant_id' => $tenantId,
            'user_id' => $request->user()->id,
            ...\Illuminate\Support\Arr::except($data, ['commitments']),
        ]);

        if (!empty($data['commitments'])) {
            foreach ($data['commitments'] as $c) {
                Commitment::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $data['customer_id'],
                    'user_id' => $request->user()->id,
                    'visit_report_id' => $report->id,
                    'title' => $c['title'],
                    'responsible_type' => $c['responsible_type'],
                    'due_date' => $c['due_date'] ?? null,
                    'priority' => $c['priority'] ?? 'normal',
                ]);
            }
        }

        if (!empty($data['next_contact_at'])) {
            Customer::where('id', $data['customer_id'])->update([
                'next_follow_up_at' => $data['next_contact_at'],
            ]);
        }

        return response()->json($report->load(['customer:id,name', 'user:id,name', 'commitments']), 201);
    }

    // ═══════════════════════════════════════════════════════
    // 4. PORTFOLIO MAP
    // ═══════════════════════════════════════════════════════

    public function portfolioMap(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $q = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->select('id', 'name', 'latitude', 'longitude', 'address_city', 'address_state',
                'rating', 'health_score', 'last_contact_at', 'segment', 'assigned_seller_id');

        if ($request->filled('seller_id')) $q->where('assigned_seller_id', $request->seller_id);
        if ($request->filled('rating')) $q->where('rating', $request->rating);
        if ($request->filled('segment')) $q->where('segment', $request->segment);

        $customers = $q->get()->map(function ($c) {
            $daysSinceContact = $c->last_contact_at ? (int) $c->last_contact_at->diffInDays(now()) : 999;
            $c->days_since_contact = $daysSinceContact;
            $c->alert_level = $daysSinceContact > 90 ? 'critical' : ($daysSinceContact > 60 ? 'warning' : ($daysSinceContact > 30 ? 'attention' : 'ok'));
            return $c;
        });

        return response()->json($customers);
    }

    // ═══════════════════════════════════════════════════════
    // 5. FORGOTTEN CLIENTS DASHBOARD
    // ═══════════════════════════════════════════════════════

    public function forgottenClients(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $noSchedule = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('next_follow_up_at')
                    ->orWhere('next_follow_up_at', '<', now());
            })
            ->select('id', 'name', 'rating', 'health_score', 'last_contact_at',
                'next_follow_up_at', 'assigned_seller_id', 'segment', 'address_city')
            ->with(['assignedSeller:id,name'])
            ->get()
            ->map(function ($c) {
                $c->days_since_contact = $c->last_contact_at
                    ? (int) $c->last_contact_at->diffInDays(now())
                    : 999;
                $c->urgency = $c->days_since_contact > 90 ? 'critical'
                    : ($c->days_since_contact > 60 ? 'high'
                    : ($c->days_since_contact > 30 ? 'medium' : 'low'));
                return $c;
            })
            ->sortByDesc('days_since_contact')
            ->values();

        $stats = [
            'total_forgotten' => $noSchedule->count(),
            'critical' => $noSchedule->where('urgency', 'critical')->count(),
            'high' => $noSchedule->where('urgency', 'high')->count(),
            'medium' => $noSchedule->where('urgency', 'medium')->count(),
            'by_seller' => $noSchedule->groupBy(fn($c) => $c->assignedSeller->name ?? 'Sem vendedor')
                ->map->count()->sortDesc(),
            'by_rating' => $noSchedule->groupBy('rating')->map->count(),
        ];

        return response()->json([
            'stats' => $stats,
            'customers' => $noSchedule->take(100),
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 6. CONTACT POLICIES
    // ═══════════════════════════════════════════════════════

    public function policiesIndex(Request $request): JsonResponse
    {
        return response()->json(
            ContactPolicy::where('tenant_id', $this->tenantId($request))->orderByDesc('priority')->get()
        );
    }

    public function policiesStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'target_type' => ['required', Rule::in(array_keys(ContactPolicy::TARGET_TYPES))],
            'target_value' => 'nullable|string|max:100',
            'max_days_without_contact' => 'required|integer|min:1|max:365',
            'warning_days_before' => 'integer|min:1|max:30',
            'preferred_contact_type' => 'nullable|string|max:50',
            'is_active' => 'boolean',
            'priority' => 'integer|min:0',
        ]);

        $policy = ContactPolicy::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($policy, 201);
    }

    public function policiesUpdate(Request $request, ContactPolicy $policy): JsonResponse
    {
        if ($policy->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $data = $request->validate([
            'name' => 'string|max:255',
            'target_type' => [Rule::in(array_keys(ContactPolicy::TARGET_TYPES))],
            'target_value' => 'nullable|string|max:100',
            'max_days_without_contact' => 'integer|min:1|max:365',
            'warning_days_before' => 'integer|min:1|max:30',
            'preferred_contact_type' => 'nullable|string|max:50',
            'is_active' => 'boolean',
            'priority' => 'integer|min:0',
        ]);

        $policy->update($data);
        return response()->json($policy);
    }

    public function policiesDestroy(Request $request, ContactPolicy $policy): JsonResponse
    {
        if ($policy->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $policy->delete();
        return response()->json(null, 204);
    }

    // ═══════════════════════════════════════════════════════
    // 7. SMART AGENDA (Suggestions)
    // ═══════════════════════════════════════════════════════

    public function smartAgenda(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $userId = $request->filled('user_id') ? $request->user_id : $request->user()->id;

        $policies = ContactPolicy::where('tenant_id', $tenantId)->active()->get();

        $customers = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where(function ($q) use ($userId) {
                $q->where('assigned_seller_id', $userId)->orWhereNull('assigned_seller_id');
            })
            ->select('id', 'name', 'rating', 'health_score', 'last_contact_at',
                'next_follow_up_at', 'segment', 'address_city', 'latitude', 'longitude')
            ->get();

        $suggestions = $customers->map(function ($c) use ($policies) {
            $daysSinceContact = $c->last_contact_at ? (int) $c->last_contact_at->diffInDays(now()) : 999;
            $policy = $policies->first(function ($p) use ($c) {
                return $p->target_type === 'all'
                    || ($p->target_type === 'rating' && $p->target_value === $c->rating)
                    || ($p->target_type === 'segment' && $p->target_value === $c->segment);
            });
            $maxDays = $policy ? $policy->max_days_without_contact : 90;
            $daysUntilDue = $maxDays - $daysSinceContact;

            $score = 0;
            if ($daysUntilDue <= 0) $score += 100;
            elseif ($daysUntilDue <= 7) $score += 80;
            elseif ($daysUntilDue <= 14) $score += 50;
            if ($c->rating === 'A') $score += 30;
            elseif ($c->rating === 'B') $score += 20;
            if ($c->health_score && $c->health_score < 50) $score += 20;

            $hasCalibrationExpiring = Equipment::where('customer_id', $c->id)
                ->whereNotNull('next_calibration_at')
                ->where('next_calibration_at', '<=', now()->addDays(30))
                ->exists();
            if ($hasCalibrationExpiring) $score += 25;

            $hasPendingQuote = Quote::where('customer_id', $c->id)
                ->where('status', 'pending')
                ->exists();
            if ($hasPendingQuote) $score += 15;

            $c->priority_score = $score;
            $c->days_since_contact = $daysSinceContact;
            $c->max_days_allowed = $maxDays;
            $c->days_until_due = $daysUntilDue;
            $c->has_calibration_expiring = $hasCalibrationExpiring;
            $c->has_pending_quote = $hasPendingQuote;
            $c->suggested_action = $daysUntilDue <= 0 ? 'Contato urgente' :
                ($hasCalibrationExpiring ? 'Oportunidade calibração' :
                ($hasPendingQuote ? 'Follow-up orçamento' : 'Contato de manutenção'));

            return $c;
        })
        ->filter(fn($c) => $c->priority_score > 0)
        ->sortByDesc('priority_score')
        ->values()
        ->take(30);

        return response()->json($suggestions);
    }

    // ═══════════════════════════════════════════════════════
    // 8. QUICK NOTES
    // ═══════════════════════════════════════════════════════

    public function quickNotesIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $q = QuickNote::where('tenant_id', $tenantId)
            ->with(['customer:id,name', 'user:id,name']);

        if ($request->filled('customer_id')) $q->where('customer_id', $request->customer_id);
        if ($request->filled('user_id')) $q->where('user_id', $request->user_id);
        if ($request->filled('pinned')) $q->where('is_pinned', true);
        if ($request->filled('sentiment')) $q->where('sentiment', $request->sentiment);

        return response()->json($q->orderByDesc('created_at')->paginate($request->get('per_page', 25)));
    }

    public function quickNotesStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'deal_id' => 'nullable|exists:crm_deals,id',
            'channel' => ['nullable', Rule::in(array_keys(QuickNote::CHANNELS))],
            'sentiment' => ['nullable', Rule::in(array_keys(QuickNote::SENTIMENTS))],
            'content' => 'required|string',
            'is_pinned' => 'boolean',
            'tags' => 'nullable|array',
        ]);

        $note = QuickNote::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
            'user_id' => $request->user()->id,
        ]);

        Customer::where('id', $data['customer_id'])->update(['last_contact_at' => now()]);

        return response()->json($note->load(['customer:id,name', 'user:id,name']), 201);
    }

    public function quickNotesUpdate(Request $request, QuickNote $note): JsonResponse
    {
        $data = $request->validate([
            'content' => 'string',
            'sentiment' => ['nullable', Rule::in(array_keys(QuickNote::SENTIMENTS))],
            'is_pinned' => 'boolean',
            'tags' => 'nullable|array',
        ]);
        $note->update($data);
        return response()->json($note);
    }

    public function quickNotesDestroy(Request $request, QuickNote $note): JsonResponse
    {
        if ($note->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $note->delete();
        return response()->json(null, 204);
    }

    // ═══════════════════════════════════════════════════════
    // 9. COMMITMENTS
    // ═══════════════════════════════════════════════════════

    public function commitmentsIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $q = Commitment::where('tenant_id', $tenantId)
            ->with(['customer:id,name', 'user:id,name']);

        if ($request->filled('customer_id')) $q->where('customer_id', $request->customer_id);
        if ($request->filled('status')) $q->where('status', $request->status);
        if ($request->filled('overdue')) $q->overdue();
        if ($request->filled('responsible_type')) $q->where('responsible_type', $request->responsible_type);

        return response()->json($q->orderBy('due_date')->paginate($request->get('per_page', 25)));
    }

    public function commitmentsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'visit_report_id' => 'nullable|exists:visit_reports,id',
            'activity_id' => 'nullable|exists:crm_activities,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'responsible_type' => ['required', Rule::in(array_keys(Commitment::RESPONSIBLE_TYPES))],
            'responsible_name' => 'nullable|string|max:255',
            'due_date' => 'nullable|date',
            'priority' => ['nullable', Rule::in(array_keys(Commitment::PRIORITIES))],
        ]);

        $commitment = Commitment::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
            'user_id' => $request->user()->id,
        ]);

        return response()->json($commitment->load(['customer:id,name', 'user:id,name']), 201);
    }

    public function commitmentsUpdate(Request $request, Commitment $commitment): JsonResponse
    {
        if ($commitment->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $data = $request->validate([
            'title' => 'string|max:255',
            'description' => 'nullable|string',
            'status' => [Rule::in(array_keys(Commitment::STATUSES))],
            'due_date' => 'nullable|date',
            'priority' => [Rule::in(array_keys(Commitment::PRIORITIES))],
            'completion_notes' => 'nullable|string',
        ]);

        if (isset($data['status']) && $data['status'] === 'completed' && !$commitment->completed_at) {
            $data['completed_at'] = now();
        }

        $commitment->update($data);
        return response()->json($commitment);
    }

    // ═══════════════════════════════════════════════════════
    // 10. NEGOTIATION HISTORY
    // ═══════════════════════════════════════════════════════

    public function negotiationHistory(Request $request, Customer $customer): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        if ($customer->tenant_id !== $tenantId) {
            abort(404);
        }

        $quotes = Quote::where('customer_id', $customer->id)
            ->where('tenant_id', $tenantId)
            ->select('id', 'quote_number', 'total', 'status', 'created_at', 'approved_at', 'discount_amount')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($q) => ['type' => 'quote', ...$q->toArray()]);

        $workOrders = WorkOrder::where('customer_id', $customer->id)
            ->where('tenant_id', $tenantId)
            ->select('id', 'os_number', 'business_number', 'total', 'status', 'created_at', 'completed_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($w) => ['type' => 'work_order', ...$w->toArray()]);

        $deals = CrmDeal::where('customer_id', $customer->id)
            ->where('tenant_id', $tenantId)
            ->select('id', 'title', 'value', 'status', 'created_at', 'won_at', 'lost_at', 'lost_reason')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($d) => ['type' => 'deal', ...$d->toArray()]);

        $timeline = $quotes->concat($workOrders)->concat($deals)
            ->sortByDesc('created_at')
            ->values();

        $totals = [
            'total_quoted' => $quotes->sum('total'),
            'total_os' => $workOrders->sum('total'),
            'total_deals_won' => $deals->where('status', 'won')->sum('value'),
            'quotes_count' => $quotes->count(),
            'os_count' => $workOrders->count(),
            'deals_count' => $deals->count(),
            'avg_discount' => $quotes->avg('discount_amount') ?? 0,
        ];

        return response()->json([
            'timeline' => $timeline,
            'totals' => $totals,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 11. CLIENT SUMMARY PDF DATA
    // ═══════════════════════════════════════════════════════

    public function clientSummary(Request $request, Customer $customer): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        if ($customer->tenant_id !== $tenantId) {
            abort(404);
        }

        $contacts = $customer->contacts()->get(['name', 'role', 'phone', 'email', 'is_primary']);

        $recentActivities = CrmActivity::where('customer_id', $customer->id)
            ->where('tenant_id', $tenantId)
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->take(5)
            ->get(['type', 'title', 'created_at', 'user_id', 'outcome']);

        $pendingCommitments = Commitment::where('customer_id', $customer->id)
            ->where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->get(['title', 'due_date', 'responsible_type', 'priority']);

        $equipmentsDue = Equipment::where('customer_id', $customer->id)
            ->whereNotNull('next_calibration_at')
            ->where('next_calibration_at', '<=', now()->addDays(60))
            ->get(['code', 'brand', 'model', 'next_calibration_at']);

        $pendingQuotes = Quote::where('customer_id', $customer->id)
            ->where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->get(['quote_number', 'total', 'created_at']);

        return response()->json([
            'customer' => $customer->only([
                'id', 'name', 'document', 'phone', 'email', 'address_city',
                'address_state', 'rating', 'health_score', 'segment',
                'last_contact_at', 'next_follow_up_at', 'contract_type',
            ]),
            'contacts' => $contacts,
            'recent_activities' => $recentActivities,
            'pending_commitments' => $pendingCommitments,
            'equipments_due' => $equipmentsDue,
            'pending_quotes' => $pendingQuotes,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 12. RFM CLASSIFICATION
    // ═══════════════════════════════════════════════════════

    public function rfmIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $scores = CustomerRfmScore::where('tenant_id', $tenantId)
            ->with('customer:id,name,rating,health_score,segment')
            ->orderByDesc('total_score')
            ->get();

        $bySegment = $scores->groupBy('rfm_segment')->map(fn($g) => [
            'count' => $g->count(),
            'total_revenue' => $g->sum('total_revenue'),
        ]);

        return response()->json([
            'scores' => $scores,
            'by_segment' => $bySegment,
            'segments' => CustomerRfmScore::SEGMENTS,
        ]);
    }

    public function rfmRecalculate(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $customers = Customer::where('tenant_id', $tenantId)->where('is_active', true)->get();

        $allRecency = [];
        $allFrequency = [];
        $allMonetary = [];

        foreach ($customers as $c) {
            $lastOs = WorkOrder::where('customer_id', $c->id)->max('created_at');
            $osCount = WorkOrder::where('customer_id', $c->id)
                ->where('created_at', '>=', now()->subMonths(24))
                ->count();
            $revenue = WorkOrder::where('customer_id', $c->id)
                ->where('status', 'completed')
                ->sum('total');
            $allRecency[$c->id] = $lastOs ? (int) now()->diffInDays($lastOs) : 999;
            $allFrequency[$c->id] = $osCount;
            $allMonetary[$c->id] = (float) $revenue;
        }

        $rQuintiles = $this->quintiles(array_values($allRecency), true);
        $fQuintiles = $this->quintiles(array_values($allFrequency));
        $mQuintiles = $this->quintiles(array_values($allMonetary));

        $count = 0;
        foreach ($customers as $c) {
            $r = $this->scoreInQuintile($allRecency[$c->id], $rQuintiles, true);
            $f = $this->scoreInQuintile($allFrequency[$c->id], $fQuintiles);
            $m = $this->scoreInQuintile($allMonetary[$c->id], $mQuintiles);

            CustomerRfmScore::updateOrCreate(
                ['tenant_id' => $tenantId, 'customer_id' => $c->id],
                [
                    'recency_score' => $r,
                    'frequency_score' => $f,
                    'monetary_score' => $m,
                    'rfm_segment' => CustomerRfmScore::calculateSegment($r, $f, $m),
                    'total_score' => $r + $f + $m,
                    'last_purchase_date' => $allRecency[$c->id] < 999
                        ? now()->subDays($allRecency[$c->id])->toDateString() : null,
                    'purchase_count' => $allFrequency[$c->id],
                    'total_revenue' => $allMonetary[$c->id],
                    'calculated_at' => now(),
                ]
            );
            $count++;
        }

        return response()->json(['message' => "RFM recalculado para {$count} clientes."]);
    }

    // ═══════════════════════════════════════════════════════
    // 13. PORTFOLIO COVERAGE
    // ═══════════════════════════════════════════════════════

    public function portfolioCoverage(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $period = $request->get('period', 30);

        $customers = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->select('id', 'name', 'rating', 'assigned_seller_id', 'last_contact_at')
            ->with('assignedSeller:id,name')
            ->get();

        $visited = $customers->filter(fn($c) =>
            $c->last_contact_at && $c->last_contact_at->diffInDays(now()) <= $period
        );

        $bySeller = $customers->groupBy(fn($c) => $c->assignedSeller->name ?? 'Sem vendedor')->map(function ($group) use ($period) {
            $total = $group->count();
            $visited = $group->filter(fn($c) => $c->last_contact_at && $c->last_contact_at->diffInDays(now()) <= $period)->count();
            return [
                'total' => $total,
                'visited' => $visited,
                'coverage' => $total > 0 ? round(($visited / $total) * 100, 1) : 0,
                'not_visited' => $total - $visited,
            ];
        })->sortByDesc('coverage');

        $byRating = $customers->groupBy('rating')->map(function ($group) use ($period) {
            $total = $group->count();
            $visited = $group->filter(fn($c) => $c->last_contact_at && $c->last_contact_at->diffInDays(now()) <= $period)->count();
            return [
                'total' => $total,
                'visited' => $visited,
                'coverage' => $total > 0 ? round(($visited / $total) * 100, 1) : 0,
            ];
        });

        return response()->json([
            'summary' => [
                'total_clients' => $customers->count(),
                'visited' => $visited->count(),
                'not_visited' => $customers->count() - $visited->count(),
                'coverage_percent' => $customers->count() > 0
                    ? round(($visited->count() / $customers->count()) * 100, 1) : 0,
                'period_days' => $period,
            ],
            'by_seller' => $bySeller,
            'by_rating' => $byRating,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 14. COMMERCIAL PRODUCTIVITY
    // ═══════════════════════════════════════════════════════

    public function commercialProductivity(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $period = $request->get('period', 30);
        $since = now()->subDays($period);

        $checkins = VisitCheckin::where('tenant_id', $tenantId)
            ->where('checkin_at', '>=', $since)
            ->where('status', 'checked_out')
            ->select('user_id', DB::raw('COUNT(*) as visits_count'),
                DB::raw('AVG(duration_minutes) as avg_duration'),
                DB::raw('SUM(duration_minutes) as total_duration'))
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $activities = CrmActivity::where('tenant_id', $tenantId)
            ->where('created_at', '>=', $since)
            ->select('user_id', 'type', DB::raw('COUNT(*) as count'))
            ->groupBy('user_id', 'type')
            ->get();

        $activitiesByUser = $activities->groupBy('user_id')->map(function ($items) {
            return $items->pluck('count', 'type');
        });

        $dealsWon = CrmDeal::where('tenant_id', $tenantId)
            ->won()->where('won_at', '>=', $since)
            ->select('assigned_to', DB::raw('COUNT(*) as count'), DB::raw('SUM(value) as total_value'))
            ->groupBy('assigned_to')
            ->get()
            ->keyBy('assigned_to');

        $quotesGenerated = Quote::where('tenant_id', $tenantId)
            ->where('created_at', '>=', $since)
            ->select('seller_id', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as total_value'))
            ->groupBy('seller_id')
            ->get()
            ->keyBy('seller_id');

        $sellers = \App\Models\User::whereHas('roles', fn($q) => $q->whereIn('name', ['comercial', 'vendedor', 'tecnico_vendedor']))
            ->where('tenant_id', $tenantId)
            ->get(['id', 'name']);

        $productivity = $sellers->map(function ($seller) use ($checkins, $activitiesByUser, $dealsWon, $quotesGenerated, $period) {
            $ck = $checkins->get($seller->id);
            $acts = $activitiesByUser->get($seller->id, collect());
            $dw = $dealsWon->get($seller->id);
            $qg = $quotesGenerated->get($seller->id);

            return [
                'user_id' => $seller->id,
                'user_name' => $seller->name,
                'visits' => $ck ? (int) $ck->visits_count : 0,
                'visits_per_day' => $ck && $period > 0 ? round($ck->visits_count / $period, 1) : 0,
                'avg_visit_duration' => $ck ? round($ck->avg_duration) : 0,
                'calls' => (int) ($acts->get('ligacao', 0)),
                'emails' => (int) ($acts->get('email', 0)),
                'whatsapp' => (int) ($acts->get('whatsapp', 0)),
                'total_activities' => $acts->sum(),
                'deals_won' => $dw ? (int) $dw->count : 0,
                'deals_value' => $dw ? (float) $dw->total_value : 0,
                'quotes_generated' => $qg ? (int) $qg->count : 0,
                'quotes_value' => $qg ? (float) $qg->total_value : 0,
            ];
        })->sortByDesc('visits')->values();

        return response()->json([
            'period_days' => $period,
            'sellers' => $productivity,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 15. LATENT OPPORTUNITIES
    // ═══════════════════════════════════════════════════════

    public function latentOpportunities(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $calibrationExpiring = Equipment::whereHas('customer', fn($q) => $q->where('tenant_id', $tenantId)->where('is_active', true))
            ->whereNotNull('next_calibration_at')
            ->where('next_calibration_at', '<=', now()->addDays(60))
            ->whereDoesntHave('customer.deals', fn($q) => $q->where('status', 'open'))
            ->with('customer:id,name,rating')
            ->select('id', 'customer_id', 'code', 'brand', 'model', 'next_calibration_at')
            ->get()
            ->map(fn($e) => [
                'type' => 'calibration_expiring',
                'customer' => $e->customer,
                'detail' => "{$e->brand} {$e->model} ({$e->code})",
                'date' => $e->next_calibration_at,
                'priority' => $e->next_calibration_at <= now() ? 'high' : 'medium',
            ]);

        $inactiveCustomers = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('rating', '!=', 'D')
            ->where(function ($q) {
                $q->whereNull('last_contact_at')
                    ->orWhere('last_contact_at', '<', now()->subDays(120));
            })
            ->whereDoesntHave('deals', fn($q) => $q->where('status', 'open'))
            ->select('id', 'name', 'rating', 'last_contact_at', 'health_score')
            ->get()
            ->map(fn($c) => [
                'type' => 'inactive_customer',
                'customer' => $c,
                'detail' => 'Sem contato há ' . ($c->last_contact_at ? (int) $c->last_contact_at->diffInDays(now()) . ' dias' : 'nunca'),
                'priority' => $c->rating === 'A' ? 'high' : 'medium',
            ]);

        $pendingRenewals = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereNotNull('contract_end')
            ->where('contract_end', '<=', now()->addDays(60))
            ->where('contract_end', '>=', now()->subDays(30))
            ->select('id', 'name', 'contract_type', 'contract_end', 'rating')
            ->get()
            ->map(fn($c) => [
                'type' => 'contract_renewal',
                'customer' => $c,
                'detail' => "Contrato {$c->contract_type} vence em " . $c->contract_end->format('d/m/Y'),
                'priority' => $c->contract_end <= now() ? 'high' : 'medium',
            ]);

        $all = $calibrationExpiring->concat($inactiveCustomers)->concat($pendingRenewals)
            ->sortBy(fn($o) => $o['priority'] === 'high' ? 0 : 1)
            ->values();

        return response()->json([
            'opportunities' => $all,
            'summary' => [
                'calibration_expiring' => $calibrationExpiring->count(),
                'inactive_customers' => $inactiveCustomers->count(),
                'contract_renewals' => $pendingRenewals->count(),
                'total' => $all->count(),
            ],
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 16. IMPORTANT DATES
    // ═══════════════════════════════════════════════════════

    public function importantDatesIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $q = ImportantDate::where('tenant_id', $tenantId)
            ->with('customer:id,name');

        if ($request->filled('customer_id')) $q->where('customer_id', $request->customer_id);
        if ($request->filled('upcoming')) $q->upcoming((int) $request->upcoming);

        return response()->json($q->orderBy('date')->get());
    }

    public function importantDatesStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'title' => 'required|string|max:255',
            'type' => ['required', Rule::in(array_keys(ImportantDate::TYPES))],
            'date' => 'required|date',
            'recurring_yearly' => 'boolean',
            'remind_days_before' => 'integer|min:1|max:60',
            'contact_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $date = ImportantDate::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($date->load('customer:id,name'), 201);
    }

    public function importantDatesUpdate(Request $request, ImportantDate $date): JsonResponse
    {
        if ($date->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $data = $request->validate([
            'title' => 'string|max:255',
            'type' => [Rule::in(array_keys(ImportantDate::TYPES))],
            'date' => 'date',
            'recurring_yearly' => 'boolean',
            'remind_days_before' => 'integer|min:1|max:60',
            'contact_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
        ]);
        $date->update($data);
        return response()->json($date);
    }

    public function importantDatesDestroy(Request $request, ImportantDate $date): JsonResponse
    {
        if ($date->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $date->delete();
        return response()->json(null, 204);
    }

    // ═══════════════════════════════════════════════════════
    // 17. VISIT SURVEYS
    // ═══════════════════════════════════════════════════════

    public function surveysIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $surveys = VisitSurvey::where('tenant_id', $tenantId)
            ->with(['customer:id,name', 'user:id,name'])
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 25));

        return response()->json($surveys);
    }

    public function surveysSend(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'checkin_id' => 'nullable|exists:visit_checkins,id',
        ]);

        $survey = VisitSurvey::create([
            'tenant_id' => $this->tenantId($request),
            'customer_id' => $data['customer_id'],
            'checkin_id' => $data['checkin_id'] ?? null,
            'user_id' => $request->user()->id,
            'sent_at' => now(),
            'expires_at' => now()->addDays(7),
        ]);

        return response()->json($survey, 201);
    }

    public function surveysAnswer(Request $request, string $token): JsonResponse
    {
        $survey = VisitSurvey::where('token', $token)->firstOrFail();

        if ($survey->status === 'answered') {
            return response()->json(['message' => 'Pesquisa já respondida.'], 422);
        }

        if ($survey->expires_at && $survey->expires_at < now()) {
            $survey->update(['status' => 'expired']);
            return response()->json(['message' => 'Pesquisa expirada.'], 422);
        }

        $data = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string',
        ]);

        $survey->update([
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
            'status' => 'answered',
            'answered_at' => now(),
        ]);

        return response()->json(['message' => 'Obrigado pela avaliação!']);
    }

    // ═══════════════════════════════════════════════════════
    // 18. ACCOUNT PLANS
    // ═══════════════════════════════════════════════════════

    public function accountPlansIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $q = AccountPlan::where('tenant_id', $tenantId)
            ->with(['customer:id,name,rating', 'owner:id,name', 'actions']);

        if ($request->filled('customer_id')) $q->where('customer_id', $request->customer_id);
        if ($request->filled('status')) $q->where('status', $request->status);

        return response()->json($q->orderByDesc('created_at')->paginate($request->get('per_page', 25)));
    }

    public function accountPlansStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'title' => 'required|string|max:255',
            'objective' => 'nullable|string',
            'start_date' => 'nullable|date',
            'target_date' => 'nullable|date',
            'revenue_target' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'actions' => 'nullable|array',
            'actions.*.title' => 'required|string|max:255',
            'actions.*.description' => 'nullable|string',
            'actions.*.due_date' => 'nullable|date',
            'actions.*.assigned_to' => 'nullable|exists:users,id',
        ]);

        $plan = AccountPlan::create([
            'tenant_id' => $this->tenantId($request),
            'owner_id' => $request->user()->id,
            ...\Illuminate\Support\Arr::except($data, ['actions']),
        ]);

        if (!empty($data['actions'])) {
            foreach ($data['actions'] as $i => $a) {
                AccountPlanAction::create([
                    'account_plan_id' => $plan->id,
                    'title' => $a['title'],
                    'description' => $a['description'] ?? null,
                    'due_date' => $a['due_date'] ?? null,
                    'assigned_to' => $a['assigned_to'] ?? null,
                    'sort_order' => $i,
                ]);
            }
        }

        return response()->json($plan->load(['customer:id,name', 'owner:id,name', 'actions']), 201);
    }

    public function accountPlansUpdate(Request $request, AccountPlan $plan): JsonResponse
    {
        if ($plan->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $data = $request->validate([
            'title' => 'string|max:255',
            'objective' => 'nullable|string',
            'status' => [Rule::in(array_keys(AccountPlan::STATUSES))],
            'target_date' => 'nullable|date',
            'revenue_target' => 'nullable|numeric|min:0',
            'revenue_current' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $plan->update($data);
        $plan->recalculateProgress();

        return response()->json($plan->fresh(['customer:id,name', 'owner:id,name', 'actions']));
    }

    public function accountPlanActionsUpdate(Request $request, AccountPlanAction $action): JsonResponse
    {
        $plan = $action->plan;
        if ($plan->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
        $data = $request->validate([
            'title' => 'string|max:255',
            'description' => 'nullable|string',
            'status' => [Rule::in(array_keys(AccountPlanAction::STATUSES))],
            'due_date' => 'nullable|date',
            'assigned_to' => 'nullable|exists:users,id',
        ]);

        if (isset($data['status']) && $data['status'] === 'completed' && !$action->completed_at) {
            $data['completed_at'] = now();
        }

        $action->update($data);
        $action->plan->recalculateProgress();

        return response()->json($action);
    }

    // ═══════════════════════════════════════════════════════
    // 19. GAMIFICATION
    // ═══════════════════════════════════════════════════════

    public function gamificationDashboard(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $period = now()->format('Y-m');

        $leaderboard = GamificationScore::where('tenant_id', $tenantId)
            ->where('period', $period)
            ->where('period_type', 'monthly')
            ->with('user:id,name')
            ->orderByDesc('total_points')
            ->get();

        $rank = 1;
        foreach ($leaderboard as $score) {
            $score->rank_position = $rank++;
        }

        $badges = GamificationBadge::where('tenant_id', $tenantId)->active()->get();

        return response()->json([
            'period' => $period,
            'leaderboard' => $leaderboard,
            'badges' => $badges,
        ]);
    }

    public function gamificationRecalculate(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $period = now()->format('Y-m');
        $startOfMonth = now()->startOfMonth();

        $sellers = \App\Models\User::whereHas('roles', fn($q) => $q->whereIn('name', ['comercial', 'vendedor', 'tecnico_vendedor']))
            ->where('tenant_id', $tenantId)
            ->get();

        $totalClients = Customer::where('tenant_id', $tenantId)->where('is_active', true)->count();

        foreach ($sellers as $seller) {
            $visits = VisitCheckin::where('tenant_id', $tenantId)
                ->where('user_id', $seller->id)
                ->where('checkin_at', '>=', $startOfMonth)
                ->where('status', 'checked_out')
                ->count();

            $dealsWon = CrmDeal::where('tenant_id', $tenantId)
                ->where('assigned_to', $seller->id)
                ->won()->where('won_at', '>=', $startOfMonth)
                ->count();

            $dealsValue = CrmDeal::where('tenant_id', $tenantId)
                ->where('assigned_to', $seller->id)
                ->won()->where('won_at', '>=', $startOfMonth)
                ->sum('value');

            $activitiesCount = CrmActivity::where('tenant_id', $tenantId)
                ->where('user_id', $seller->id)
                ->where('created_at', '>=', $startOfMonth)
                ->count();

            $clientsContacted = Customer::where('tenant_id', $tenantId)
                ->where('assigned_seller_id', $seller->id)
                ->where('last_contact_at', '>=', $startOfMonth)
                ->count();

            $myClients = Customer::where('tenant_id', $tenantId)
                ->where('assigned_seller_id', $seller->id)
                ->where('is_active', true)
                ->count();

            $coverage = $myClients > 0 ? round(($clientsContacted / $myClients) * 100, 2) : 0;

            $csatAvg = VisitSurvey::where('tenant_id', $tenantId)
                ->where('user_id', $seller->id)
                ->where('status', 'answered')
                ->where('answered_at', '>=', $startOfMonth)
                ->avg('rating') ?? 0;

            $commitmentsTotal = Commitment::where('tenant_id', $tenantId)
                ->where('user_id', $seller->id)
                ->where('created_at', '>=', $startOfMonth)
                ->count();

            $commitmentsOnTime = Commitment::where('tenant_id', $tenantId)
                ->where('user_id', $seller->id)
                ->where('status', 'completed')
                ->where('completed_at', '>=', $startOfMonth)
                ->whereColumn('completed_at', '<=', DB::raw('IFNULL(due_date, completed_at)'))
                ->count();

            $totalPoints = ($visits * 10) + ($dealsWon * 50) + ($activitiesCount * 2) +
                (int) ($coverage * 2) + (int) ($csatAvg * 20) + ($commitmentsOnTime * 5);

            GamificationScore::updateOrCreate(
                ['tenant_id' => $tenantId, 'user_id' => $seller->id, 'period' => $period],
                [
                    'period_type' => 'monthly',
                    'visits_count' => $visits,
                    'deals_won' => $dealsWon,
                    'deals_value' => $dealsValue,
                    'new_clients' => 0,
                    'activities_count' => $activitiesCount,
                    'coverage_percent' => $coverage,
                    'csat_avg' => round($csatAvg, 2),
                    'commitments_on_time' => $commitmentsOnTime,
                    'commitments_total' => $commitmentsTotal,
                    'total_points' => $totalPoints,
                ]
            );
        }

        return response()->json(['message' => 'Gamificação recalculada para ' . $sellers->count() . ' vendedores.']);
    }

    // ═══════════════════════════════════════════════════════
    // 20. CONSTANTS
    // ═══════════════════════════════════════════════════════

    public function constants(): JsonResponse
    {
        return response()->json([
            'visit_statuses' => VisitCheckin::STATUSES,
            'route_statuses' => VisitRoute::STATUSES,
            'report_sentiments' => VisitReport::SENTIMENTS,
            'report_visit_types' => VisitReport::VISIT_TYPES,
            'contact_policy_target_types' => ContactPolicy::TARGET_TYPES,
            'quick_note_channels' => QuickNote::CHANNELS,
            'quick_note_sentiments' => QuickNote::SENTIMENTS,
            'commitment_statuses' => Commitment::STATUSES,
            'commitment_responsible_types' => Commitment::RESPONSIBLE_TYPES,
            'commitment_priorities' => Commitment::PRIORITIES,
            'important_date_types' => ImportantDate::TYPES,
            'survey_statuses' => VisitSurvey::STATUSES,
            'account_plan_statuses' => AccountPlan::STATUSES,
            'account_plan_action_statuses' => AccountPlanAction::STATUSES,
            'rfm_segments' => CustomerRfmScore::SEGMENTS,
            'gamification_categories' => GamificationBadge::CATEGORIES,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════

    private function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }

    private function quintiles(array $values, bool $inverse = false): array
    {
        if (empty($values)) return [0, 0, 0, 0, 0];
        sort($values);
        $n = count($values);
        return [
            $values[(int) ($n * 0.2)] ?? 0,
            $values[(int) ($n * 0.4)] ?? 0,
            $values[(int) ($n * 0.6)] ?? 0,
            $values[(int) ($n * 0.8)] ?? 0,
            $values[$n - 1] ?? 0,
        ];
    }

    private function scoreInQuintile(float $value, array $quintiles, bool $inverse = false): int
    {
        if ($inverse) {
            if ($value <= $quintiles[0]) return 5;
            if ($value <= $quintiles[1]) return 4;
            if ($value <= $quintiles[2]) return 3;
            if ($value <= $quintiles[3]) return 2;
            return 1;
        }
        if ($value >= $quintiles[3]) return 5;
        if ($value >= $quintiles[2]) return 4;
        if ($value >= $quintiles[1]) return 3;
        if ($value >= $quintiles[0]) return 2;
        return 1;
    }
}
