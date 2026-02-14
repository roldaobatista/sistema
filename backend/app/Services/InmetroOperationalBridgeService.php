<?php

namespace App\Services;

use App\Models\InmetroInstrument;
use App\Models\InmetroHistory;
use App\Models\InmetroOwner;
use App\Models\Equipment;
use Illuminate\Support\Facades\DB;

class InmetroOperationalBridgeService
{
    // ── Feature #18: Auto Link Instrument ↔ Equipment ──

    public function suggestLinkedEquipments(int $tenantId, int $customerId): array
    {
        // Find INMETRO owner linked to this customer
        $owner = InmetroOwner::where('tenant_id', $tenantId)
            ->where('converted_to_customer_id', $customerId)
            ->first();

        if (!$owner) {
            return ['suggestions' => [], 'message' => 'Customer not linked to INMETRO data'];
        }

        $inmetroInstruments = $owner->instruments()
            ->with('location')
            ->get();

        // Find existing equipments for this customer
        $existingEquipments = Equipment::where('customer_id', $customerId)->get();

        $suggestions = $inmetroInstruments->map(function ($inst) use ($existingEquipments) {
            // Try to match by serial number or brand+model
            $match = $existingEquipments->first(function ($eq) use ($inst) {
                return ($inst->serial_number && $eq->serial_number === $inst->serial_number) ||
                       ($inst->brand && $inst->model && $eq->brand === $inst->brand && $eq->model === $inst->model);
            });

            return [
                'instrument_id' => $inst->id,
                'inmetro_number' => $inst->inmetro_number,
                'brand' => $inst->brand,
                'model' => $inst->model,
                'serial_number' => $inst->serial_number,
                'capacity' => $inst->capacity,
                'current_status' => $inst->current_status,
                'next_verification' => $inst->next_verification_at?->toDateString(),
                'city' => $inst->location?->address_city,
                'matched_equipment_id' => $match?->id,
                'matched_equipment_name' => $match ? "{$match->brand} {$match->model} (#{$match->serial_number})" : null,
                'confidence' => $match ? ($inst->serial_number === $match->serial_number ? 'high' : 'medium') : 'none',
            ];
        });

        return [
            'owner_id' => $owner->id,
            'total_instruments' => $inmetroInstruments->count(),
            'matched' => $suggestions->where('confidence', '!=', 'none')->count(),
            'unmatched' => $suggestions->where('confidence', 'none')->count(),
            'suggestions' => $suggestions,
        ];
    }

    public function linkInstrumentToEquipment(int $instrumentId, int $equipmentId): InmetroInstrument
    {
        $instrument = InmetroInstrument::findOrFail($instrumentId);
        $instrument->update(['linked_equipment_id' => $equipmentId]);
        return $instrument;
    }

    // ── Feature #19: Pre-fill Certificate Data from INMETRO ──

    public function prefillCertificateData(int $instrumentId): array
    {
        $instrument = InmetroInstrument::with(['location.owner', 'history'])->findOrFail($instrumentId);

        $lastHistory = $instrument->history->first(); // ordered by date desc

        return [
            'instrument' => [
                'brand' => $instrument->brand,
                'model' => $instrument->model,
                'serial_number' => $instrument->serial_number,
                'capacity' => $instrument->capacity,
                'inmetro_number' => $instrument->inmetro_number,
                'instrument_type' => $instrument->instrument_type,
            ],
            'owner' => [
                'name' => $instrument->location->owner->name ?? '',
                'document' => $instrument->location->owner->document ?? '',
                'trade_name' => $instrument->location->owner->trade_name ?? '',
            ],
            'prefill' => [
                'location' => [
                    'address' => $instrument->location->address ?? '',
                    'city' => $instrument->location->address_city ?? '',
                    'state' => $instrument->location->address_state ?? '',
                    'cep' => $instrument->location->address_cep ?? '',
                ],
                'last_calibration' => [
                    'date' => $instrument->last_verification_at?->toDateString(),
                    'executor' => $lastHistory?->executor ?? '',
                    'status' => $instrument->current_status,
                    'event_type' => $lastHistory?->event_type ?? '',
                ],
                'suggested_next_calibration' => $instrument->next_verification_at?->toDateString(),
            ],
        ];
    }

    // ── Feature #20: Instrument Timeline ──

    public function getInstrumentTimeline(int $instrumentId, int $tenantId): array
    {
        $instrument = InmetroInstrument::with(['history.competitor', 'location.owner'])
            ->whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->findOrFail($instrumentId);

        $timeline = $instrument->history->map(fn($h) => [
            'id' => $h->id,
            'date' => $h->event_date?->toDateString(),
            'event_type' => $h->event_type,
            'status' => $h->status,
            'executor' => $h->executor,
            'competitor' => $h->competitor?->name,
            'seal_number' => $h->seal_number ?? null,
            'notes' => $h->notes ?? null,
            'type' => 'inmetro_history',
        ]);

        // If linked to equipment, add work order history
        if ($instrument->linked_equipment_id) {
            $workOrders = DB::select("
                SELECT wo.id, wo.number, wo.created_at, wo.status, wo.completed_at
                FROM work_orders wo
                INNER JOIN work_order_items woi ON woi.work_order_id = wo.id
                WHERE woi.equipment_id = ?
                ORDER BY wo.created_at DESC
            ", [$instrument->linked_equipment_id]);

            foreach ($workOrders as $wo) {
                $timeline->push([
                    'id' => 'wo-' . $wo->id,
                    'date' => substr($wo->created_at, 0, 10),
                    'event_type' => 'work_order',
                    'status' => $wo->status,
                    'executor' => 'Nossa equipe',
                    'competitor' => null,
                    'notes' => "OS #{$wo->number}",
                    'type' => 'work_order',
                ]);
            }
        }

        return [
            'instrument' => [
                'id' => $instrument->id,
                'inmetro_number' => $instrument->inmetro_number,
                'brand' => $instrument->brand,
                'model' => $instrument->model,
                'capacity' => $instrument->capacity,
                'current_status' => $instrument->current_status,
            ],
            'owner' => $instrument->location->owner?->name,
            'total_events' => $timeline->count(),
            'events' => $timeline->sortByDesc('date')->values(),
        ];
    }

    // ── Feature #21: Compare Calibration Results ──

    public function compareCalibrationResults(int $instrumentId, int $tenantId): array
    {
        $instrument = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->findOrFail($instrumentId);

        $history = InmetroHistory::where('instrument_id', $instrumentId)
            ->orderBy('event_date')
            ->get();

        $comparisons = $history->map(fn($h) => [
            'date' => $h->event_date?->toDateString(),
            'event_type' => $h->event_type,
            'status' => $h->status,
            'executor' => $h->executor,
        ]);

        $statusTransitions = $history->map(fn($h, $i) => [
            'from' => $i > 0 ? $history[$i - 1]->status : 'N/A',
            'to' => $h->status,
            'date' => $h->event_date?->toDateString(),
        ])->filter(fn($t) => $t['from'] !== $t['to']);

        $rejectionCount = $history->where('status', 'rejected')->count();
        $approvalCount = $history->where('status', 'approved')->count();

        return [
            'instrument' => $instrument,
            'comparisons' => $comparisons,
            'summary' => [
                'total_calibrations' => $history->count(),
                'approval_rate' => $history->count() > 0
                    ? round(($approvalCount / $history->count()) * 100, 1)
                    : 0,
                'rejection_count' => $rejectionCount,
                'trend' => $rejectionCount > $history->count() / 3 ? 'degrading' : 'stable',
            ],
            'status_transitions' => $statusTransitions->values(),
        ];
    }
}
