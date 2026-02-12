<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InmetroOwner;
use App\Models\InmetroInstrument;
use App\Models\InmetroCompetitor;
use App\Services\InmetroXmlImportService;
use App\Services\InmetroPsieScraperService;
use App\Services\InmetroEnrichmentService;
use App\Services\InmetroLeadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InmetroController extends Controller
{
    public function __construct(
        private InmetroXmlImportService $xmlImportService,
        private InmetroPsieScraperService $scraperService,
        private InmetroEnrichmentService $enrichmentService,
        private InmetroLeadService $leadService,
    ) {}

    private function priorityOrderExpression(): string
    {
        if (DB::getDriverName() === 'sqlite') {
            return "CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END";
        }

        return "FIELD(priority, 'urgent', 'high', 'normal', 'low')";
    }

    /**
     * Dashboard with KPIs and summary.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $data = $this->leadService->getDashboard($request->user()->current_tenant_id);
        return response()->json($data);
    }

    /**
     * List owners (prospects) with pagination and filters.
     */
    public function owners(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = InmetroOwner::where('tenant_id', $tenantId)
            ->withCount(['locations', 'instruments']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('document', 'like', "%{$search}%")
                  ->orWhere('trade_name', 'like', "%{$search}%");
            });
        }

        if ($status = $request->input('lead_status')) {
            $query->where('lead_status', $status);
        }

        if ($priority = $request->input('priority')) {
            $query->where('priority', $priority);
        }

        if ($city = $request->input('city')) {
            $query->whereHas('locations', fn($q) => $q->where('address_city', $city));
        }

        if ($request->boolean('only_leads')) {
            $query->leads();
        }

        if ($request->boolean('only_converted')) {
            $query->converted();
        }

        $sortBy = $request->input('sort_by', 'priority');
        $sortOrder = $request->input('sort_order', 'asc');

        if ($sortBy === 'priority') {
            $query->orderByRaw($this->priorityOrderExpression());
        } else {
            $query->orderBy($sortBy, $sortOrder);
        }

        $owners = $query->paginate($request->input('per_page', 25));

        return response()->json($owners);
    }

    /**
     * Show owner detail with locations, instruments, and history.
     */
    public function showOwner(Request $request, int $id): JsonResponse
    {
        $owner = InmetroOwner::where('tenant_id', $request->user()->current_tenant_id)
            ->with([
                'locations.instruments.history',
                'convertedCustomer',
            ])
            ->findOrFail($id);

        return response()->json($owner);
    }

    /**
     * List instruments with filters (expiration, city, status).
     */
    public function instruments(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->select('inmetro_instruments.*', 'inmetro_owners.id as owner_id', 'inmetro_owners.name as owner_name', 'inmetro_owners.document as owner_document',
                     'inmetro_locations.address_city', 'inmetro_locations.address_state');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('inmetro_instruments.inmetro_number', 'like', "%{$search}%")
                  ->orWhere('inmetro_instruments.brand', 'like', "%{$search}%")
                  ->orWhere('inmetro_owners.name', 'like', "%{$search}%");
            });
        }

        if ($city = $request->input('city')) {
            $query->where('inmetro_locations.address_city', $city);
        }

        if ($status = $request->input('status')) {
            $query->where('inmetro_instruments.current_status', $status);
        }

        if ($daysUntilDue = $request->input('days_until_due')) {
            $query->where('inmetro_instruments.next_verification_at', '<=', now()->addDays((int) $daysUntilDue));
        }

        if ($request->boolean('overdue')) {
            $query->where('inmetro_instruments.next_verification_at', '<', now());
        }

        $query->orderBy('inmetro_instruments.next_verification_at', 'asc');

        $instruments = $query->paginate($request->input('per_page', 25));

        return response()->json($instruments);
    }

    /**
     * List leads sorted by priority and expiration.
     */
    public function leads(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = InmetroOwner::where('tenant_id', $tenantId)
            ->leads()
            ->withCount('instruments')
            ->with(['locations' => fn($q) => $q->select('id', 'owner_id', 'address_city', 'address_state')]);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('document', 'like', "%{$search}%")
                  ->orWhere('trade_name', 'like', "%{$search}%");
            });
        }

        if ($leadStatus = $request->input('lead_status')) {
            $query->where('lead_status', $leadStatus);
        }

        if ($priority = $request->input('priority')) {
            $query->where('priority', $priority);
        }

        if ($city = $request->input('city')) {
            $query->whereHas('locations', fn($q) => $q->where('address_city', $city));
        }

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        $query->orderByRaw($this->priorityOrderExpression());

        $leads = $query->paginate($request->input('per_page', 25));

        return response()->json($leads);
    }

    /**
     * List competitors (authorized repair shops).
     */
    public function competitors(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = InmetroCompetitor::where('tenant_id', $tenantId);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('cnpj', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%");
            });
        }

        if ($city = $request->input('city')) {
            $query->where('city', $city);
        }

        $competitors = $query->orderBy('city')->paginate($request->input('per_page', 25));

        return response()->json($competitors);
    }

    /**
     * Import XML data from PSIE open data.
     */
    public function importXml(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $uf = $request->input('uf', 'MT');
        $type = $request->input('type', 'all');

        try {
            $results = [];

            if ($type === 'all' || $type === 'competitors') {
                $results['competitors'] = $this->xmlImportService->importCompetitors($tenantId, $uf);
            }

            if ($type === 'all' || $type === 'instruments') {
                $results['instruments'] = $this->xmlImportService->importInstruments($tenantId, $uf);
            }

            $this->leadService->recalculatePriorities($tenantId);

            return response()->json(['message' => 'Import completed', 'results' => $results]);
        } catch (\Exception $e) {
            Log::error('INMETRO XML import error', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Import failed', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Initialize PSIE captcha session for manual scraping.
     */
    public function initPsieScrape(Request $request): JsonResponse
    {
        $session = $this->scraperService->initCaptchaSession();
        return response()->json($session);
    }

    /**
     * Submit PSIE scrape results after manual captcha resolution.
     */
    public function submitPsieResults(Request $request): JsonResponse
    {
        $request->validate([
            'results' => 'required|array',
            'results.*.inmetro_number' => 'required|string',
            'results.*.owner_name' => 'required|string',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $result = $this->scraperService->saveScrapeResults($tenantId, $request->input('results'));

        if ($result['success']) {
            $this->leadService->recalculatePriorities($tenantId);
        }

        return response()->json($result);
    }

    /**
     * Enrich a single owner's contact data.
     */
    public function enrichOwner(Request $request, int $ownerId): JsonResponse
    {
        $owner = InmetroOwner::where('tenant_id', $request->user()->current_tenant_id)->findOrFail($ownerId);

        try {
            $result = $this->enrichmentService->enrichOwner($owner);
            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('INMETRO enrichment error', ['owner_id' => $ownerId, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Batch enrich multiple owners.
     */
    public function enrichBatch(Request $request): JsonResponse
    {
        $request->validate([
            'owner_ids' => 'required|array|max:50',
            'owner_ids.*' => 'integer|exists:inmetro_owners,id',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $stats = $this->enrichmentService->enrichBatch($request->input('owner_ids'), $tenantId);

        return response()->json(['message' => 'Batch enrichment completed', 'stats' => $stats]);
    }

    /**
     * Convert an INMETRO prospect into a CRM customer.
     */
    public function convertToCustomer(Request $request, int $ownerId): JsonResponse
    {
        $owner = InmetroOwner::where('tenant_id', $request->user()->current_tenant_id)->findOrFail($ownerId);

        $result = $this->leadService->convertToCustomer($owner);

        if ($result['success']) {
            return response()->json(['message' => 'Converted successfully', 'customer_id' => $result['customer_id']]);
        }

        return response()->json(['message' => 'Conversion failed', 'error' => $result['error']], 422);
    }

    /**
     * Update owner lead status.
     */
    public function updateLeadStatus(Request $request, int $ownerId): JsonResponse
    {
        $request->validate([
            'lead_status' => 'required|in:new,contacted,negotiating,converted,lost',
            'notes' => 'nullable|string',
        ]);

        $owner = InmetroOwner::where('tenant_id', $request->user()->current_tenant_id)->findOrFail($ownerId);

        try {
            $previousStatus = $owner->lead_status;
            $owner->update([
                'lead_status' => $request->input('lead_status'),
                'notes' => $request->input('notes', $owner->notes),
            ]);

            Log::info('INMETRO lead status updated', [
                'owner_id' => $ownerId,
                'from' => $previousStatus,
                'to' => $request->input('lead_status'),
            ]);

            return response()->json(['message' => 'Status updated', 'data' => $owner->fresh()]);
        } catch (\Exception $e) {
            Log::error('INMETRO lead status update failed', ['owner_id' => $ownerId, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to update status'], 500);
        }
    }

    /**
     * Get MT municipalities list from IBGE.
     */
    public function municipalities(): JsonResponse
    {
        $municipalities = $this->scraperService->getMtMunicipalities();
        return response()->json($municipalities);
    }

    /**
     * Recalculate all owner priorities.
     */
    public function recalculatePriorities(Request $request): JsonResponse
    {
        $stats = $this->leadService->recalculatePriorities($request->user()->current_tenant_id);
        return response()->json(['message' => 'Priorities recalculated', 'stats' => $stats]);
    }

    /**
     * Get available cities with instrument counts.
     */
    public function cities(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $cities = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->selectRaw('inmetro_locations.address_city as city, COUNT(*) as instrument_count, COUNT(DISTINCT inmetro_owners.id) as owner_count')
            ->groupBy('inmetro_locations.address_city')
            ->orderByDesc('instrument_count')
            ->get();

        return response()->json($cities);
    }

    /**
     * Show instrument detail with history.
     */
    public function showInstrument(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $instrument = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->where('inmetro_instruments.id', $id)
            ->select('inmetro_instruments.*', 'inmetro_owners.name as owner_name', 'inmetro_owners.id as owner_id',
                     'inmetro_owners.document as owner_document', 'inmetro_locations.address_city', 'inmetro_locations.address_state',
                     'inmetro_locations.farm_name')
            ->firstOrFail();

        $instrument->load('history');

        return response()->json($instrument);
    }

    /**
     * Conversion statistics for the dashboard.
     */
    public function conversionStats(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $totalLeads = InmetroOwner::where('tenant_id', $tenantId)->count();
        $converted = InmetroOwner::where('tenant_id', $tenantId)->whereNotNull('converted_to_customer_id')->count();
        $conversionRate = $totalLeads > 0 ? round(($converted / $totalLeads) * 100, 1) : 0;

        $avgDaysToConvert = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->selectRaw('AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) as avg_days')
            ->value('avg_days');

        $byStatus = InmetroOwner::where('tenant_id', $tenantId)
            ->selectRaw('lead_status, COUNT(*) as total')
            ->groupBy('lead_status')
            ->pluck('total', 'lead_status');

        $recentConversions = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->orderByDesc('updated_at')
            ->limit(5)
            ->select('id', 'name', 'document', 'updated_at', 'converted_to_customer_id')
            ->get();

        return response()->json([
            'total_leads' => $totalLeads,
            'converted' => $converted,
            'conversion_rate' => $conversionRate,
            'avg_days_to_convert' => $avgDaysToConvert ? round((float) $avgDaysToConvert, 1) : null,
            'by_status' => $byStatus,
            'recent_conversions' => $recentConversions,
        ]);
    }
    /**
     * Update owner details.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $owner = InmetroOwner::where('tenant_id', $request->user()->current_tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'trade_name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string',
        ]);

        try {
            $owner->update($validated);
            return response()->json(['message' => 'Owner updated successfully', 'data' => $owner->fresh()]);
        } catch (\Exception $e) {
            Log::error('INMETRO owner update failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to update owner'], 500);
        }
    }

    /**
     * Delete owner (and associated instruments/locations).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $owner = InmetroOwner::where('tenant_id', $request->user()->current_tenant_id)->findOrFail($id);

        try {
            DB::transaction(function () use ($owner) {
                $owner->locations()->each(function ($location) {
                    $location->instruments()->each(fn($inst) => $inst->history()->delete());
                    $location->instruments()->delete();
                });
                $owner->locations()->delete();
                $owner->delete();
            });

            return response()->json(['message' => 'Owner deleted successfully']);
        } catch (\Exception $e) {
            Log::error('INMETRO owner delete failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to delete owner: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Export leads as CSV.
     */
    public function exportLeadsCsv(Request $request)
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = InmetroOwner::where('tenant_id', $tenantId)
            ->withCount(['locations', 'instruments']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('document', 'like', "%{$search}%")
                  ->orWhere('trade_name', 'like', "%{$search}%");
            });
        }

        if ($status = $request->input('lead_status')) {
            $query->where('lead_status', $status);
        }

        if ($priority = $request->input('priority')) {
            $query->where('priority', $priority);
        }

        $owners = $query->orderByRaw($this->priorityOrderExpression())->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="leads-inmetro-' . now()->format('Y-m-d') . '.csv"',
        ];

        $callback = function () use ($owners) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($file, ['Nome', 'CNPJ/CPF', 'Tipo', 'Telefone', 'Email', 'Status Lead', 'Prioridade', 'Locais', 'Instrumentos', 'Criado em']);

            foreach ($owners as $owner) {
                fputcsv($file, [
                    $owner->name,
                    $owner->document,
                    $owner->type,
                    $owner->phone,
                    $owner->email,
                    $owner->lead_status,
                    $owner->priority,
                    $owner->locations_count,
                    $owner->instruments_count,
                    $owner->created_at?->format('d/m/Y'),
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export instruments as CSV.
     */
    public function exportInstrumentsCsv(Request $request)
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->select('inmetro_instruments.*', 'inmetro_owners.name as owner_name', 'inmetro_owners.document as owner_document',
                     'inmetro_locations.address_city', 'inmetro_locations.address_state');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('inmetro_instruments.inmetro_number', 'like', "%{$search}%")
                  ->orWhere('inmetro_instruments.brand', 'like', "%{$search}%")
                  ->orWhere('inmetro_owners.name', 'like', "%{$search}%");
            });
        }

        if ($city = $request->input('city')) {
            $query->where('inmetro_locations.address_city', $city);
        }

        if ($status = $request->input('status')) {
            $query->where('inmetro_instruments.current_status', $status);
        }

        if ($request->boolean('overdue')) {
            $query->where('inmetro_instruments.next_verification_at', '<', now());
        }

        if ($daysUntilDue = $request->input('days_until_due')) {
            $query->where('inmetro_instruments.next_verification_at', '<=', now()->addDays((int) $daysUntilDue));
        }

        $instruments = $query->orderBy('inmetro_instruments.next_verification_at', 'asc')->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="instrumentos-inmetro-' . now()->format('Y-m-d') . '.csv"',
        ];

        $callback = function () use ($instruments) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($file, ['Nº INMETRO', 'Marca', 'Modelo', 'Capacidade', 'Tipo', 'Status', 'Proprietário', 'CNPJ/CPF', 'Cidade', 'UF', 'Última Verif.', 'Próxima Verif.', 'Executor']);

            foreach ($instruments as $inst) {
                fputcsv($file, [
                    $inst->inmetro_number,
                    $inst->brand,
                    $inst->model,
                    $inst->capacity,
                    $inst->instrument_type,
                    $inst->current_status,
                    $inst->owner_name,
                    $inst->owner_document,
                    $inst->address_city,
                    $inst->address_state,
                    $inst->last_verification_at ? \Carbon\Carbon::parse($inst->last_verification_at)->format('d/m/Y') : '',
                    $inst->next_verification_at ? \Carbon\Carbon::parse($inst->next_verification_at)->format('d/m/Y') : '',
                    $inst->last_executor,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
