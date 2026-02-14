<?php

namespace App\Http\Controllers\Api\V1;

use App\Services\InmetroCompetitorTrackingService;
use App\Services\InmetroComplianceService;
use App\Services\InmetroOperationalBridgeService;
use App\Services\InmetroProspectionService;
use App\Services\InmetroReportingService;
use App\Services\InmetroTerritorialService;
use App\Services\InmetroWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use App\Http\Controllers\Controller;

class InmetroAdvancedController extends Controller
{
    public function __construct(
        private InmetroProspectionService $prospection,
        private InmetroTerritorialService $territorial,
        private InmetroCompetitorTrackingService $competitorTracking,
        private InmetroOperationalBridgeService $operational,
        private InmetroReportingService $reporting,
        private InmetroComplianceService $compliance,
        private InmetroWebhookService $webhooks,
    ) {}

    // ════════════════════════════════════════════
    // PROSPECTION & LEADS
    // ════════════════════════════════════════════

    public function generateDailyQueue(Request $request): JsonResponse
    {
        try {
            $result = $this->prospection->generateDailyQueue(
                $request->user()->tenant_id,
                $request->input('assigned_to'),
                $request->input('max_items', 20),
            );
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to generate queue', 'error' => $e->getMessage()], 500);
        }
    }

    public function getContactQueue(Request $request): JsonResponse
    {
        $result = $this->prospection->getContactQueue(
            $request->user()->tenant_id,
            $request->input('date'),
        );
        return response()->json($result);
    }

    public function markQueueItem(Request $request, int $queueId): JsonResponse
    {
        $request->validate(['status' => 'required|in:contacted,skipped,converted']);

        try {
            $item = $this->prospection->markQueueItem($queueId, $request->input('status'), $request->user()->tenant_id);
            return response()->json(['message' => 'Queue item updated', 'data' => $item]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to update queue item', 'error' => $e->getMessage()], 500);
        }
    }

    public function followUps(Request $request): JsonResponse
    {
        $result = $this->prospection->scheduleFollowUps($request->user()->tenant_id);
        return response()->json($result);
    }

    public function calculateLeadScore(Request $request, int $ownerId): JsonResponse
    {
        try {
            $owner = \App\Models\InmetroOwner::where('tenant_id', $request->user()->tenant_id)->findOrFail($ownerId);
            $score = $this->prospection->calculateLeadScore($owner, $request->user()->tenant_id);
            return response()->json(['message' => 'Score calculated', 'data' => $score]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to calculate score', 'error' => $e->getMessage()], 500);
        }
    }

    public function recalculateAllScores(Request $request): JsonResponse
    {
        try {
            $count = $this->prospection->recalculateAllScores($request->user()->tenant_id);
            return response()->json(['message' => "Scores recalculated for {$count} owners"]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to recalculate scores', 'error' => $e->getMessage()], 500);
        }
    }

    public function detectChurn(Request $request): JsonResponse
    {
        $result = $this->prospection->detectChurnedCustomers(
            $request->user()->tenant_id,
            $request->input('inactive_months', 6),
        );
        return response()->json($result);
    }

    public function newRegistrations(Request $request): JsonResponse
    {
        $result = $this->prospection->detectNewRegistrations(
            $request->user()->tenant_id,
            $request->input('since_days', 7),
        );
        return response()->json($result);
    }

    public function suggestNextCalibrations(Request $request): JsonResponse
    {
        $result = $this->prospection->suggestNextCalibrations(
            $request->user()->tenant_id,
            $request->input('days', 90),
        );
        return response()->json($result);
    }

    public function classifySegments(Request $request): JsonResponse
    {
        try {
            $count = $this->prospection->classifySegments($request->user()->tenant_id);
            return response()->json(['message' => "{$count} owners classified"]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to classify segments', 'error' => $e->getMessage()], 500);
        }
    }

    public function segmentDistribution(Request $request): JsonResponse
    {
        $result = $this->prospection->getSegmentDistribution($request->user()->tenant_id);
        return response()->json($result);
    }

    public function rejectAlerts(Request $request): JsonResponse
    {
        $result = $this->prospection->getRejectAlerts($request->user()->tenant_id);
        return response()->json($result);
    }

    public function conversionRanking(Request $request): JsonResponse
    {
        $result = $this->prospection->getConversionRanking(
            $request->user()->tenant_id,
            $request->input('period'),
        );
        return response()->json($result);
    }

    public function logInteraction(Request $request): JsonResponse
    {
        $request->validate([
            'owner_id' => 'required|exists:inmetro_owners,id',
            'channel' => 'required|in:whatsapp,phone,email,visit,system',
            'result' => 'required|in:interested,rejected,no_answer,scheduled,converted',
            'notes' => 'nullable|string|max:2000',
            'next_follow_up_at' => 'nullable|date',
        ]);

        try {
            $interaction = $this->prospection->logInteraction(
                $request->only(['owner_id', 'channel', 'result', 'notes', 'next_follow_up_at']),
                $request->user()->tenant_id,
                $request->user()->id,
            );
            return response()->json(['message' => 'Interaction logged', 'data' => $interaction], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to log interaction', 'error' => $e->getMessage()], 500);
        }
    }

    public function interactionHistory(Request $request, int $ownerId): JsonResponse
    {
        $result = $this->prospection->getInteractionHistory($ownerId, $request->user()->tenant_id);
        return response()->json($result);
    }

    // ════════════════════════════════════════════
    // TERRITORIAL INTELLIGENCE
    // ════════════════════════════════════════════

    public function layeredMapData(Request $request): JsonResponse
    {
        $layers = $request->input('layers', ['instruments', 'competitors', 'leads']);
        $result = $this->territorial->getLayeredMapData($request->user()->tenant_id, $layers);
        return response()->json($result);
    }

    public function optimizeRoute(Request $request): JsonResponse
    {
        $request->validate([
            'base_lat' => 'required|numeric',
            'base_lng' => 'required|numeric',
            'owner_ids' => 'required|array|min:1',
        ]);

        $result = $this->territorial->optimizeRoute(
            $request->user()->tenant_id,
            (float)$request->input('base_lat'),
            (float)$request->input('base_lng'),
            $request->input('owner_ids'),
        );
        return response()->json($result);
    }

    public function competitorZones(Request $request): JsonResponse
    {
        $result = $this->territorial->getCompetitorZones($request->user()->tenant_id);
        return response()->json($result);
    }

    public function coverageVsPotential(Request $request): JsonResponse
    {
        $result = $this->territorial->getCoverageVsPotential($request->user()->tenant_id);
        return response()->json($result);
    }

    public function densityViability(Request $request): JsonResponse
    {
        $request->validate([
            'base_lat' => 'required|numeric',
            'base_lng' => 'required|numeric',
        ]);

        $result = $this->territorial->getDensityViability(
            $request->user()->tenant_id,
            (float)$request->input('base_lat'),
            (float)$request->input('base_lng'),
            (float)$request->input('cost_per_km', 1.30),
        );
        return response()->json($result);
    }

    public function nearbyLeads(Request $request): JsonResponse
    {
        $request->validate([
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
        ]);

        $result = $this->territorial->getNearbyLeads(
            $request->user()->tenant_id,
            (float)$request->input('lat'),
            (float)$request->input('lng'),
            (float)$request->input('radius_km', 50),
        );
        return response()->json($result);
    }

    // ════════════════════════════════════════════
    // COMPETITOR TRACKING
    // ════════════════════════════════════════════

    public function snapshotMarketShare(Request $request): JsonResponse
    {
        try {
            $snapshot = $this->competitorTracking->snapshotMarketShare($request->user()->tenant_id);
            return response()->json(['message' => 'Market share snapshot created', 'data' => $snapshot]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create snapshot', 'error' => $e->getMessage()], 500);
        }
    }

    public function marketShareTimeline(Request $request): JsonResponse
    {
        $result = $this->competitorTracking->getMarketShareTimeline(
            $request->user()->tenant_id,
            $request->input('months', 12),
        );
        return response()->json($result);
    }

    public function competitorMovements(Request $request): JsonResponse
    {
        $result = $this->competitorTracking->detectCompetitorMovements($request->user()->tenant_id);
        return response()->json($result);
    }

    public function estimatePricing(Request $request): JsonResponse
    {
        $result = $this->competitorTracking->estimatePricing($request->user()->tenant_id);
        return response()->json($result);
    }

    public function competitorProfile(Request $request, int $competitorId): JsonResponse
    {
        try {
            $result = $this->competitorTracking->getCompetitorProfile($request->user()->tenant_id, $competitorId);
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Competitor not found', 'error' => $e->getMessage()], 404);
        }
    }

    public function recordWinLoss(Request $request): JsonResponse
    {
        $data = $request->validate([
            'outcome' => 'required|in:win,loss',
            'owner_id' => 'nullable|exists:inmetro_owners,id',
            'competitor_id' => 'nullable|exists:inmetro_competitors,id',
            'reason' => 'nullable|string|max:100',
            'estimated_value' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:2000',
            'outcome_date' => $request->input('outcome_date', now()->toDateString()),
        ]);

        try {
            $record = $this->competitorTracking->recordWinLoss($data, $request->user()->tenant_id);
            return response()->json(['message' => 'Win/Loss recorded', 'data' => $record], 201);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to record win/loss', 'error' => $e->getMessage()], 500);
        }
    }

    public function winLossAnalysis(Request $request): JsonResponse
    {
        $result = $this->competitorTracking->getWinLossAnalysis(
            $request->user()->tenant_id,
            $request->input('period'),
        );
        return response()->json($result);
    }

    // ════════════════════════════════════════════
    // OPERATIONAL BRIDGE (OS + CERTIFICATES)
    // ════════════════════════════════════════════

    public function suggestLinkedEquipments(Request $request, int $customerId): JsonResponse
    {
        $result = $this->operational->suggestLinkedEquipments($request->user()->tenant_id, $customerId);
        return response()->json($result);
    }

    public function linkInstrument(Request $request): JsonResponse
    {
        $request->validate([
            'instrument_id' => 'required|exists:inmetro_instruments,id',
            'equipment_id' => 'required|exists:equipments,id',
        ]);

        try {
            $result = $this->operational->linkInstrumentToEquipment(
                $request->input('instrument_id'),
                $request->input('equipment_id'),
            );
            return response()->json(['message' => 'Instrument linked', 'data' => $result]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to link instrument', 'error' => $e->getMessage()], 500);
        }
    }

    public function prefillCertificate(Request $request, int $instrumentId): JsonResponse
    {
        try {
            $result = $this->operational->prefillCertificateData($instrumentId);
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Instrument not found', 'error' => $e->getMessage()], 404);
        }
    }

    public function instrumentTimeline(Request $request, int $instrumentId): JsonResponse
    {
        try {
            $result = $this->operational->getInstrumentTimeline($instrumentId, $request->user()->tenant_id);
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Instrument not found', 'error' => $e->getMessage()], 404);
        }
    }

    public function compareCalibrations(Request $request, int $instrumentId): JsonResponse
    {
        try {
            $result = $this->operational->compareCalibrationResults($instrumentId, $request->user()->tenant_id);
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Instrument not found', 'error' => $e->getMessage()], 404);
        }
    }

    // ════════════════════════════════════════════
    // REPORTING & DASHBOARDS
    // ════════════════════════════════════════════

    public function executiveDashboard(Request $request): JsonResponse
    {
        $result = $this->reporting->getExecutiveDashboard($request->user()->tenant_id);
        return response()->json($result);
    }

    public function revenueForecast(Request $request): JsonResponse
    {
        $result = $this->reporting->getRevenueForecast(
            $request->user()->tenant_id,
            $request->input('months', 6),
        );
        return response()->json($result);
    }

    public function conversionFunnel(Request $request): JsonResponse
    {
        $result = $this->reporting->getConversionFunnel($request->user()->tenant_id);
        return response()->json($result);
    }

    public function exportData(Request $request): JsonResponse
    {
        $result = $this->reporting->getExportData($request->user()->tenant_id);
        return response()->json($result);
    }

    public function yearOverYear(Request $request): JsonResponse
    {
        $result = $this->reporting->getYearOverYear($request->user()->tenant_id);
        return response()->json($result);
    }

    // ════════════════════════════════════════════
    // COMPLIANCE & REGULATORY
    // ════════════════════════════════════════════

    public function complianceChecklists(Request $request): JsonResponse
    {
        $result = $this->compliance->getChecklists(
            $request->user()->tenant_id,
            $request->input('instrument_type'),
        );
        return response()->json($result);
    }

    public function createChecklist(Request $request): JsonResponse
    {
        $data = $request->validate([
            'instrument_type' => 'required|string|max:100',
            'title' => 'required|string|max:255',
            'items' => 'required|array',
            'regulation_reference' => 'nullable|string|max:100',
        ]);

        try {
            $checklist = $this->compliance->createChecklist($data, $request->user()->tenant_id);
            return response()->json(['message' => 'Checklist created', 'data' => $checklist], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create checklist', 'error' => $e->getMessage()], 500);
        }
    }

    public function updateChecklist(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'items' => 'sometimes|array',
            'is_active' => 'sometimes|boolean',
        ]);

        try {
            $checklist = $this->compliance->updateChecklist($id, $data, $request->user()->tenant_id);
            return response()->json(['message' => 'Checklist updated', 'data' => $checklist]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to update checklist', 'error' => $e->getMessage()], 500);
        }
    }

    public function regulatoryTraceability(Request $request, int $instrumentId): JsonResponse
    {
        try {
            $result = $this->compliance->getRegulatoryTraceability($instrumentId, $request->user()->tenant_id);
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Instrument not found', 'error' => $e->getMessage()], 404);
        }
    }

    public function simulateRegulatoryImpact(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_period_months' => 'required|integer|min:1',
            'new_period_months' => 'required|integer|min:1',
            'affected_types' => 'nullable|array',
        ]);

        $result = $this->compliance->simulateRegulatoryImpact($request->user()->tenant_id, $data);
        return response()->json($result);
    }

    public function corporateGroups(Request $request): JsonResponse
    {
        $result = $this->compliance->detectCorporateGroups($request->user()->tenant_id);
        return response()->json($result);
    }

    public function instrumentTypes(Request $request): JsonResponse
    {
        $result = $this->compliance->getInstrumentTypes($request->user()->tenant_id);
        return response()->json($result);
    }

    public function detectAnomalies(Request $request): JsonResponse
    {
        $result = $this->compliance->detectAnomalies($request->user()->tenant_id);
        return response()->json($result);
    }

    public function renewalProbability(Request $request): JsonResponse
    {
        $result = $this->compliance->getRenewalProbability($request->user()->tenant_id);
        return response()->json($result);
    }

    // ════════════════════════════════════════════
    // WEBHOOKS & PUBLIC API
    // ════════════════════════════════════════════

    public function publicInstrumentData(Request $request): JsonResponse
    {
        $result = $this->webhooks->getPublicInstrumentData(
            $request->user()->tenant_id,
            $request->input('city'),
        );
        return response()->json($result);
    }

    public function listWebhooks(Request $request): JsonResponse
    {
        $result = $this->webhooks->listWebhooks($request->user()->tenant_id);
        return response()->json($result);
    }

    public function createWebhook(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event_type' => 'required|string|max:50',
            'url' => 'required|url|max:500',
            'secret' => 'nullable|string|max:100',
        ]);

        try {
            $webhook = $this->webhooks->createWebhook($data, $request->user()->tenant_id);
            return response()->json(['message' => 'Webhook created', 'data' => $webhook], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create webhook', 'error' => $e->getMessage()], 500);
        }
    }

    public function updateWebhook(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'url' => 'sometimes|url|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        try {
            $webhook = $this->webhooks->updateWebhook($id, $data, $request->user()->tenant_id);
            return response()->json(['message' => 'Webhook updated', 'data' => $webhook]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to update webhook', 'error' => $e->getMessage()], 500);
        }
    }

    public function deleteWebhook(Request $request, int $id): JsonResponse
    {
        try {
            $this->webhooks->deleteWebhook($id, $request->user()->tenant_id);
            return response()->json(['message' => 'Webhook deleted']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to delete webhook', 'error' => $e->getMessage()], 500);
        }
    }

    public function availableWebhookEvents(): JsonResponse
    {
        return response()->json($this->webhooks->getAvailableEvents());
    }
}
