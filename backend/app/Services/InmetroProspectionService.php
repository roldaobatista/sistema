<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\InmetroInstrument;
use App\Models\InmetroLeadInteraction;
use App\Models\InmetroLeadScore;
use App\Models\InmetroOwner;
use App\Models\InmetroProspectionQueue;
use App\Models\Notification;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InmetroProspectionService
{
    // ── Feature #1: Auto-Prospector — Daily Contact Queue ──

    public function generateDailyQueue(int $tenantId, ?int $assignedTo = null, int $maxItems = 20): array
    {
        $today = today();

        // Clear stale queue for today
        InmetroProspectionQueue::where('tenant_id', $tenantId)
            ->where('queue_date', $today)
            ->where('status', 'pending')
            ->delete();

        $queue = [];
        $position = 1;

        // Priority 1: Rejected instruments (immediate contact)
        $rejected = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->whereHas('instruments', fn($q) => $q->where('current_status', 'rejected'))
            ->orderByDesc('estimated_revenue')
            ->limit(5)
            ->get();

        foreach ($rejected as $owner) {
            $queue[] = $this->createQueueItem($owner, $tenantId, $today, $position++, $assignedTo,
                'rejected', 'Instrumento REPROVADO pelo INMETRO. Contato urgente — ofereça recalibração/ajuste imediato.');
        }

        // Priority 2: Expiring within 30 days (urgent)
        $expiring = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->where('lead_status', '!=', 'converted')
            ->whereHas('instruments', function ($q) {
                $q->whereNotNull('next_verification_at')
                  ->where('next_verification_at', '<=', now()->addDays(30))
                  ->where('next_verification_at', '>', now());
            })
            ->orderBy('estimated_revenue', 'desc')
            ->limit(5)
            ->get();

        foreach ($expiring as $owner) {
            if ($queue && collect($queue)->pluck('owner_id')->contains($owner->id)) continue;
            $queue[] = $this->createQueueItem($owner, $tenantId, $today, $position++, $assignedTo,
                'expiring_soon', 'Calibração vencendo em menos de 30 dias. Ofereça pacote preventivo com preço especial.');
        }

        // Priority 3: High-value leads not yet contacted
        $highValue = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->where('contact_count', 0)
            ->where('estimated_revenue', '>', 0)
            ->orderByDesc('estimated_revenue')
            ->limit(5)
            ->get();

        foreach ($highValue as $owner) {
            if ($position > $maxItems) break;
            if ($queue && collect($queue)->pluck('owner_id')->contains($owner->id)) continue;
            $queue[] = $this->createQueueItem($owner, $tenantId, $today, $position++, $assignedTo,
                'high_value', 'Lead de alto valor ainda não contactado. Primeiro contato — apresente a empresa.');
        }

        // Priority 4: Churn risk (existing customers not calibrating)
        $churnRisk = InmetroOwner::where('tenant_id', $tenantId)
            ->where('churn_risk', true)
            ->whereNotNull('converted_to_customer_id')
            ->limit(3)
            ->get();

        foreach ($churnRisk as $owner) {
            if ($position > $maxItems) break;
            if ($queue && collect($queue)->pluck('owner_id')->contains($owner->id)) continue;
            $queue[] = $this->createQueueItem($owner, $tenantId, $today, $position++, $assignedTo,
                'churn_risk', 'Cliente existente com risco de churn. Reengaje — pergunte sobre necessidades de calibração.');
        }

        // Priority 5: New registrations
        $newRegs = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->where('created_at', '>=', now()->subDays(7))
            ->where('contact_count', 0)
            ->limit(2)
            ->get();

        foreach ($newRegs as $owner) {
            if ($position > $maxItems) break;
            if ($queue && collect($queue)->pluck('owner_id')->contains($owner->id)) continue;
            $queue[] = $this->createQueueItem($owner, $tenantId, $today, $position++, $assignedTo,
                'new_registration', 'Novo registro INMETRO detectado. Primeiro contato — apresente seus serviços.');
        }

        return [
            'date' => $today->toDateString(),
            'total' => count($queue),
            'items' => $queue,
        ];
    }

    public function getContactQueue(int $tenantId, ?string $date = null): array
    {
        $queueDate = $date ? \Carbon\Carbon::parse($date) : today();

        $items = InmetroProspectionQueue::with(['owner', 'assignedUser'])
            ->where('tenant_id', $tenantId)
            ->where('queue_date', $queueDate)
            ->orderBy('position')
            ->get();

        $stats = [
            'total' => $items->count(),
            'pending' => $items->where('status', 'pending')->count(),
            'contacted' => $items->where('status', 'contacted')->count(),
            'skipped' => $items->where('status', 'skipped')->count(),
            'converted' => $items->where('status', 'converted')->count(),
        ];

        return compact('items', 'stats');
    }

    public function markQueueItem(int $queueId, string $status, int $tenantId): InmetroProspectionQueue
    {
        $item = InmetroProspectionQueue::where('tenant_id', $tenantId)->findOrFail($queueId);
        $item->update([
            'status' => $status,
            'contacted_at' => in_array($status, ['contacted', 'converted']) ? now() : null,
        ]);

        if (in_array($status, ['contacted', 'converted'])) {
            $item->owner->increment('contact_count');
            $item->owner->update(['last_contacted_at' => now()]);
        }

        return $item->fresh();
    }

    // ── Feature #3: Follow-up Automático ──

    public function scheduleFollowUps(int $tenantId): array
    {
        $overdue = InmetroLeadInteraction::where('tenant_id', $tenantId)
            ->whereNotNull('next_follow_up_at')
            ->where('next_follow_up_at', '<=', now())
            ->with('owner')
            ->get()
            ->groupBy('owner_id');

        $escalations = [];
        foreach ($overdue as $ownerId => $interactions) {
            $lastInteraction = $interactions->sortByDesc('created_at')->first();
            $daysSince = $lastInteraction->created_at->diffInDays(now());

            $level = 'reminder';
            if ($daysSince > 14) $level = 'escalate_admin';
            elseif ($daysSince > 7) $level = 'escalate_seller';

            $escalations[] = [
                'owner_id' => $ownerId,
                'owner_name' => $lastInteraction->owner->name ?? 'N/A',
                'last_contact' => $lastInteraction->created_at->toDateString(),
                'days_since' => $daysSince,
                'level' => $level,
                'follow_up_due' => $lastInteraction->next_follow_up_at->toDateString(),
            ];
        }

        return $escalations;
    }

    // ── Feature #4: Lead Scoring (0-100) ──

    public function calculateLeadScore(InmetroOwner $owner, int $tenantId): InmetroLeadScore
    {
        $factors = [];

        // Expiration score (0-25): instruments closer to expiring = higher score
        $expiringInstruments = $owner->instruments()
            ->whereNotNull('next_verification_at')
            ->where('next_verification_at', '<=', now()->addDays(90))
            ->count();
        $totalInstruments = $owner->instruments()->count();
        $expirationScore = $totalInstruments > 0
            ? min(25, (int)(($expiringInstruments / $totalInstruments) * 25) + ($expiringInstruments > 0 ? 5 : 0))
            : 0;
        $rejectedCount = $owner->instruments()->where('current_status', 'rejected')->count();
        if ($rejectedCount > 0) $expirationScore = 25; // Max if any rejected
        $factors['expiration'] = "Expiring: {$expiringInstruments}/{$totalInstruments}, Rejected: {$rejectedCount}";

        // Value score (0-25): estimated revenue
        $revenue = (float)$owner->estimated_revenue;
        $valueScore = match (true) {
            $revenue >= 10000 => 25,
            $revenue >= 5000 => 20,
            $revenue >= 2000 => 15,
            $revenue >= 1000 => 10,
            $revenue > 0 => 5,
            default => 0,
        };
        $factors['value'] = "Revenue: R$ " . number_format($revenue, 2, ',', '.');

        // Contact score (0-20): recent contact = lower score (already contacted)
        $contactScore = 20;
        if ($owner->contact_count > 0) {
            $daysSinceContact = $owner->last_contacted_at
                ? $owner->last_contacted_at->diffInDays(now())
                : 999;
            $contactScore = match (true) {
                $daysSinceContact <= 3 => 2,
                $daysSinceContact <= 7 => 5,
                $daysSinceContact <= 14 => 10,
                $daysSinceContact <= 30 => 15,
                default => 18,
            };
        }
        $factors['contact'] = "Contact count: {$owner->contact_count}, Days since: " . ($owner->last_contacted_at?->diffInDays(now()) ?? 'never');

        // Region score (0-15): closer to base = better
        $regionScore = 10; // Default medium
        $factors['region'] = 'Default region score';

        // Instrument score (0-15): more instruments = higher value
        $instrumentScore = match (true) {
            $totalInstruments >= 10 => 15,
            $totalInstruments >= 5 => 12,
            $totalInstruments >= 3 => 9,
            $totalInstruments >= 1 => 5,
            default => 0,
        };
        $factors['instruments'] = "Total instruments: {$totalInstruments}";

        $totalScore = min(100, $expirationScore + $valueScore + $contactScore + $regionScore + $instrumentScore);

        $score = InmetroLeadScore::updateOrCreate(
            ['owner_id' => $owner->id],
            [
                'tenant_id' => $tenantId,
                'total_score' => $totalScore,
                'expiration_score' => $expirationScore,
                'value_score' => $valueScore,
                'contact_score' => $contactScore,
                'region_score' => $regionScore,
                'instrument_score' => $instrumentScore,
                'factors' => $factors,
                'calculated_at' => now(),
            ]
        );


        $owner->update(['lead_score' => $totalScore]);

        return $score;
    }

    public function recalculateAllScores(int $tenantId): int
    {
        $owners = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->get();

        $count = 0;
        foreach ($owners as $owner) {
            $this->calculateLeadScore($owner, $tenantId);
            $count++;
        }

        return $count;
    }

    // ── Feature #5: Detecção de Clientes Perdidos (Churn) ──

    public function detectChurnedCustomers(int $tenantId, int $inactiveMonths = 6): array
    {
        // Find CRM customers linked to INMETRO owners that have active instruments
        // but no recent work orders
        $churned = DB::select("
            SELECT
                io.id as owner_id,
                io.name,
                io.document,
                io.converted_to_customer_id as customer_id,
                c.trade_name as customer_name,
                COUNT(DISTINCT ii.id) as active_instruments,
                MAX(wo.created_at) as last_work_order,
                COALESCE(
                    julianday('now') - julianday(MAX(wo.created_at)),
                    999
                ) as days_since_last_os
            FROM inmetro_owners io
            INNER JOIN customers c ON c.id = io.converted_to_customer_id
            LEFT JOIN work_orders wo ON wo.customer_id = c.id
            INNER JOIN inmetro_locations il ON il.owner_id = io.id
            INNER JOIN inmetro_instruments ii ON ii.location_id = il.id
            WHERE io.tenant_id = ?
                AND io.converted_to_customer_id IS NOT NULL
                AND ii.current_status != 'rejected'
            GROUP BY io.id, io.name, io.document, io.converted_to_customer_id, c.trade_name
            HAVING days_since_last_os > ?
            ORDER BY active_instruments DESC, days_since_last_os DESC
        ", [$tenantId, $inactiveMonths * 30]);

        // Mark churn risk on owners
        $churnedIds = collect($churned)->pluck('owner_id')->all();
        InmetroOwner::where('tenant_id', $tenantId)
            ->whereIn('id', $churnedIds)
            ->update(['churn_risk' => true]);

        // Clear risk flag for non-churned
        InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotIn('id', $churnedIds)
            ->where('churn_risk', true)
            ->update(['churn_risk' => false]);

        return [
            'total' => count($churned),
            'customers' => $churned,
            'estimated_lost_revenue' => collect($churned)->sum('active_instruments') * 500, // estimated avg per instrument
        ];
    }

    // ── Feature #6: Alerta de Novo Registro INMETRO ──

    public function detectNewRegistrations(int $tenantId, int $sinceDays = 7): array
    {
        $newOwners = InmetroOwner::where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subDays($sinceDays))
            ->whereNull('converted_to_customer_id')
            ->withCount('instruments')
            ->orderByDesc('instruments_count')
            ->get()
            ->map(fn($owner) => [
                'id' => $owner->id,
                'name' => $owner->name,
                'document' => $owner->document,
                'type' => $owner->type,
                'instruments' => $owner->instruments_count,
                'registered_at' => $owner->created_at->toDateString(),
                'city' => $owner->locations()->first()?->address_city ?? 'N/A',
            ]);

        return [
            'total' => $newOwners->count(),
            'since' => now()->subDays($sinceDays)->toDateString(),
            'new_owners' => $newOwners,
        ];
    }

    // ── Feature #22: Sugestão Automática de Próxima Calibração ──

    public function suggestNextCalibrations(int $tenantId, int $days = 90): array
    {
        $instruments = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('next_verification_at')
            ->where('next_verification_at', '<=', now()->addDays($days))
            ->with(['location.owner'])
            ->orderBy('next_verification_at')
            ->get()
            ->map(fn($inst) => [
                'instrument_id' => $inst->id,
                'inmetro_number' => $inst->inmetro_number,
                'brand' => $inst->brand,
                'model' => $inst->model,
                'capacity' => $inst->capacity,
                'owner_name' => $inst->location->owner->name ?? 'N/A',
                'owner_id' => $inst->location->owner->id ?? null,
                'city' => $inst->location->address_city ?? 'N/A',
                'next_verification' => $inst->next_verification_at->toDateString(),
                'days_until_due' => $inst->days_until_due,
                'suggested_action' => match (true) {
                    $inst->days_until_due <= 0 => 'VENCIDA — Contactar imediatamente',
                    $inst->days_until_due <= 15 => 'Agendar calibração para esta semana',
                    $inst->days_until_due <= 30 => 'Preparar proposta de recalibração',
                    $inst->days_until_due <= 60 => 'Incluir em campanha de renovação',
                    default => 'Monitorar — agendar nas próximas semanas',
                },
                'urgency' => match (true) {
                    $inst->days_until_due <= 0 => 'critical',
                    $inst->days_until_due <= 15 => 'urgent',
                    $inst->days_until_due <= 30 => 'high',
                    $inst->days_until_due <= 60 => 'medium',
                    default => 'low',
                },
            ]);

        $grouped = $instruments->groupBy('urgency');

        return [
            'total' => $instruments->count(),
            'by_urgency' => [
                'critical' => $grouped->get('critical', collect())->count(),
                'urgent' => $grouped->get('urgent', collect())->count(),
                'high' => $grouped->get('high', collect())->count(),
                'medium' => $grouped->get('medium', collect())->count(),
                'low' => $grouped->get('low', collect())->count(),
            ],
            'suggestions' => $instruments,
        ];
    }

    // ── Feature #33: Classificação Automática de Segmento ──

    public function classifySegments(int $tenantId): int
    {
        $owners = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('segment')
            ->get();

        $count = 0;
        foreach ($owners as $owner) {
            $segment = $this->detectSegment($owner);
            $owner->update(['segment' => $segment, 'cnpj_root' => substr($owner->document ?? '', 0, 8) ?: null]);
            $count++;
        }

        return $count;
    }

    public function getSegmentDistribution(int $tenantId): array
    {
        return InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('segment')
            ->selectRaw('segment, COUNT(*) as total, SUM(estimated_revenue) as revenue')
            ->groupBy('segment')
            ->orderByDesc('total')
            ->get()
            ->toArray();
    }

    // ── Feature #37: Alerta de Instrumento Reprovado ──

    public function getRejectAlerts(int $tenantId): array
    {
        $rejected = InmetroInstrument::where('current_status', 'rejected')
            ->whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))
            ->with(['location.owner'])
            ->get()
            ->map(fn($inst) => [
                'instrument_id' => $inst->id,
                'inmetro_number' => $inst->inmetro_number,
                'brand' => $inst->brand,
                'model' => $inst->model,
                'capacity' => $inst->capacity,
                'owner_name' => $inst->location->owner->name ?? 'N/A',
                'owner_id' => $inst->location->owner->id ?? null,
                'owner_document' => $inst->location->owner->document ?? null,
                'city' => $inst->location->address_city ?? 'N/A',
                'last_verification' => $inst->last_verification_at?->toDateString(),
                'action' => 'Contato URGENTE — instrumento reprovado precisa de recalibração ou ajuste.',
                'priority' => 'critical',
            ]);

        return [
            'total' => $rejected->count(),
            'alerts' => $rejected,
        ];
    }

    // ── Feature #39: Ranking de Vendedores por Conversão ──

    public function getConversionRanking(int $tenantId, ?string $period = null): array
    {
        $query = InmetroLeadInteraction::where('tenant_id', $tenantId)
            ->where('result', 'converted');

        if ($period === 'month') {
            $query->where('created_at', '>=', now()->startOfMonth());
        } elseif ($period === 'quarter') {
            $query->where('created_at', '>=', now()->startOfQuarter());
        } elseif ($period === 'year') {
            $query->where('created_at', '>=', now()->startOfYear());
        }

        $ranking = $query
            ->selectRaw('user_id, COUNT(*) as conversions')
            ->groupBy('user_id')
            ->orderByDesc('conversions')
            ->with('user:id,name')
            ->get()
            ->map(fn($item) => [
                'user_id' => $item->user_id,
                'user_name' => $item->user?->name ?? 'N/A',
                'conversions' => $item->conversions,
            ]);

        // Also count total contacts per user
        $contactsQuery = InmetroLeadInteraction::where('tenant_id', $tenantId);
        if ($period === 'month') $contactsQuery->where('created_at', '>=', now()->startOfMonth());

        $contacts = $contactsQuery
            ->selectRaw('user_id, COUNT(*) as total_contacts')
            ->groupBy('user_id')
            ->pluck('total_contacts', 'user_id');

        $result = $ranking->map(fn($item) => array_merge($item, [
            'total_contacts' => $contacts[$item['user_id']] ?? 0,
            'conversion_rate' => $contacts[$item['user_id']] > 0
                ? round(($item['conversions'] / $contacts[$item['user_id']]) * 100, 1)
                : 0,
        ]));

        return [
            'period' => $period ?? 'all_time',
            'ranking' => $result,
        ];
    }

    // ── Feature #42: Registro de Interação com Lead ──

    public function logInteraction(array $data, int $tenantId, int $userId): InmetroLeadInteraction
    {
        $interaction = InmetroLeadInteraction::create([
            'owner_id' => $data['owner_id'],
            'user_id' => $userId,
            'tenant_id' => $tenantId,
            'channel' => $data['channel'],
            'result' => $data['result'],
            'notes' => $data['notes'] ?? null,
            'next_follow_up_at' => $data['next_follow_up_at'] ?? null,
        ]);

        // Update owner contact stats
        $owner = InmetroOwner::find($data['owner_id']);
        if ($owner) {
            $owner->increment('contact_count');
            $owner->update([
                'last_contacted_at' => now(),
                'next_contact_at' => $data['next_follow_up_at'] ?? null,
            ]);

            // Update lead status based on result
            if ($data['result'] === 'converted') {
                $owner->update(['lead_status' => 'converted']);
            } elseif ($data['result'] === 'interested' && $owner->lead_status === 'new') {
                $owner->update(['lead_status' => 'contacted']);
            } elseif ($data['result'] === 'scheduled') {
                $owner->update(['lead_status' => 'negotiating']);
            }
        }

        return $interaction->load('user');
    }

    public function getInteractionHistory(int $ownerId, int $tenantId): array
    {
        $interactions = InmetroLeadInteraction::where('owner_id', $ownerId)
            ->where('tenant_id', $tenantId)
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->get();

        $summary = [
            'total' => $interactions->count(),
            'by_channel' => $interactions->groupBy('channel')->map->count(),
            'by_result' => $interactions->groupBy('result')->map->count(),
            'last_contact' => $interactions->first()?->created_at?->toDateString(),
        ];

        return compact('interactions', 'summary');
    }

    // ── Private helpers ──

    private function createQueueItem(InmetroOwner $owner, int $tenantId, $date, int $position, ?int $assignedTo, string $reason, string $script): array
    {
        $item = InmetroProspectionQueue::create([
            'owner_id' => $owner->id,
            'tenant_id' => $tenantId,
            'assigned_to' => $assignedTo,
            'queue_date' => $date,
            'position' => $position,
            'reason' => $reason,
            'suggested_script' => $script,
            'status' => 'pending',
        ]);

        return $item->toArray();
    }

    private function detectSegment(InmetroOwner $owner): string
    {
        $name = strtolower($owner->name ?? '');
        $tradeName = strtolower($owner->trade_name ?? '');
        $combined = $name . ' ' . $tradeName;

        $segments = [
            'agronegocio' => ['fazenda', 'agro', 'rural', 'pecuaria', 'grãos', 'soja', 'algodão', 'milho', 'sementes', 'agricola', 'cooperativa'],
            'industria' => ['indust', 'metalurg', 'siderurg', 'fabrica', 'manufat', 'quimica', 'usina', 'mineração', 'cimento'],
            'comercio' => ['comerc', 'mercado', 'supermercado', 'atacado', 'varejo', 'loja', 'distribu'],
            'governo' => ['prefeit', 'municip', 'estado', 'federal', 'secretar', 'ipem', 'defesa', 'exercito', 'base aerea'],
            'transporte' => ['transport', 'logistic', 'frete', 'rodoviár', 'rodovia', 'posto', 'pedagio'],
            'alimentos' => ['aliment', 'frigorifico', 'abatedouro', 'laticinios', 'carne', 'leite', 'aves'],
            'construcao' => ['construç', 'constru', 'concret', 'engenharia', 'infraestrutura'],
            'porto' => ['port', 'terminal', 'maritim', 'naval'],
            'energia' => ['energ', 'eletric', 'solar', 'eolica', 'termoelet', 'hidrelet'],
            'saude' => ['hospital', 'clinica', 'laborat', 'farmac', 'saude'],
        ];

        foreach ($segments as $segment => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($combined, $keyword)) {
                    return $segment;
                }
            }
        }

        return $owner->type === 'PJ' ? 'empresa_geral' : 'pessoa_fisica';
    }
}
