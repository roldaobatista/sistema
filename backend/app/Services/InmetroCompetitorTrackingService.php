<?php

namespace App\Services;

use App\Models\InmetroCompetitor;
use App\Models\InmetroCompetitorSnapshot;
use App\Models\InmetroInstrument;
use App\Models\InmetroOwner;
use App\Models\InmetroWinLoss;
use Illuminate\Support\Facades\DB;

class InmetroCompetitorTrackingService
{
    // ── Feature #13: Monthly Market Share Snapshot ──

    public function snapshotMarketShare(int $tenantId): InmetroCompetitorSnapshot
    {
        $periodStart = now()->startOfMonth();
        $periodEnd = now()->endOfMonth();

        $totalInstruments = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId))->count();

        $competitors = InmetroCompetitor::where('tenant_id', $tenantId)->get();

        foreach ($competitors as $competitor) {
            $repairCount = $competitor->repairs()
                ->where('repair_date', '>=', $periodStart)
                ->where('repair_date', '<=', $periodEnd)
                ->count();

            $instrumentCount = $competitor->repairs()->distinct('instrument_id')->count('instrument_id');

            $byCity = DB::select("
                SELECT il.address_city as city, COUNT(DISTINCT cir.instrument_id) as cnt
                FROM competitor_instrument_repairs cir
                INNER JOIN inmetro_instruments ii ON ii.id = cir.instrument_id
                INNER JOIN inmetro_locations il ON il.id = ii.location_id
                WHERE cir.competitor_id = ?
                GROUP BY il.address_city
            ", [$competitor->id]);

            InmetroCompetitorSnapshot::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'competitor_id' => $competitor->id,
                    'period_start' => $periodStart,
                ],
                [
                    'period_end' => $periodEnd,
                    'instrument_count' => $instrumentCount,
                    'repair_count' => $repairCount,
                    'market_share_pct' => $totalInstruments > 0 ? round(($instrumentCount / $totalInstruments) * 100, 2) : 0,
                    'by_city' => collect($byCity)->keyBy('city')->map(fn($c) => $c->cnt)->toArray(),
                ]
            );
        }

        // Snapshot for "self" (our company) — competitor_id = null
        $ourCustomerIds = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->pluck('converted_to_customer_id');

        $ourInstruments = InmetroInstrument::whereHas('location.owner', function ($q) use ($tenantId) {
            $q->where('tenant_id', $tenantId)->whereNotNull('converted_to_customer_id');
        })->count();

        return InmetroCompetitorSnapshot::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'competitor_id' => null,
                'period_start' => $periodStart,
            ],
            [
                'period_end' => $periodEnd,
                'snapshot_type' => 'monthly',
                'instrument_count' => $ourInstruments,
                'market_share_pct' => $totalInstruments > 0 ? round(($ourInstruments / $totalInstruments) * 100, 2) : 0,
            ]
        );
    }

    public function getMarketShareTimeline(int $tenantId, int $months = 12): array
    {
        $snapshots = InmetroCompetitorSnapshot::where('tenant_id', $tenantId)
            ->where('period_start', '>=', now()->subMonths($months)->startOfMonth())
            ->orderBy('period_start')
            ->get();

        $timeline = $snapshots->groupBy(fn($s) => $s->period_start->format('Y-m'))
            ->map(fn($group, $month) => [
                'month' => $month,
                'our_share' => $group->whereNull('competitor_id')->first()?->market_share_pct ?? 0,
                'competitors' => $group->whereNotNull('competitor_id')->map(fn($s) => [
                    'id' => $s->competitor_id,
                    'name' => $s->competitor?->name ?? 'N/A',
                    'share' => $s->market_share_pct,
                    'instruments' => $s->instrument_count,
                ]),
            ])->values();

        return ['months' => $months, 'timeline' => $timeline];
    }

    // ── Feature #14: Competitor Movements ──

    public function detectCompetitorMovements(int $tenantId): array
    {
        $current = InmetroCompetitorSnapshot::where('tenant_id', $tenantId)
            ->where('period_start', now()->startOfMonth())
            ->whereNotNull('competitor_id')
            ->get();

        $previous = InmetroCompetitorSnapshot::where('tenant_id', $tenantId)
            ->where('period_start', now()->subMonth()->startOfMonth())
            ->whereNotNull('competitor_id')
            ->get()
            ->keyBy('competitor_id');

        $movements = $current->map(function ($snap) use ($previous) {
            $prev = $previous->get($snap->competitor_id);
            $delta = $prev ? $snap->instrument_count - $prev->instrument_count : 0;

            return [
                'competitor_id' => $snap->competitor_id,
                'name' => $snap->competitor?->name ?? 'N/A',
                'current_instruments' => $snap->instrument_count,
                'previous_instruments' => $prev?->instrument_count ?? 0,
                'delta' => $delta,
                'direction' => $delta > 0 ? 'growing' : ($delta < 0 ? 'shrinking' : 'stable'),
                'current_share' => $snap->market_share_pct,
                'previous_share' => $prev?->market_share_pct ?? 0,
            ];
        })->filter(fn($m) => $m['delta'] !== 0)->sortByDesc(fn($m) => abs($m['delta']))->values();

        return [
            'total_movements' => $movements->count(),
            'growing' => $movements->where('direction', 'growing')->count(),
            'shrinking' => $movements->where('direction', 'shrinking')->count(),
            'movements' => $movements,
        ];
    }

    // ── Feature #15: Estimated Pricing ──

    public function estimatePricing(int $tenantId): array
    {
        $winLoss = InmetroWinLoss::where('tenant_id', $tenantId)
            ->whereNotNull('estimated_value')
            ->with('competitor:id,name')
            ->get()
            ->groupBy('competitor_id');

        $estimates = $winLoss->map(function ($records, $competitorId) {
            $wins = $records->where('outcome', 'win');
            $losses = $records->where('outcome', 'loss');
            $competitor = $records->first()?->competitor;

            return [
                'competitor_id' => $competitorId,
                'competitor_name' => $competitor?->name ?? 'Desconhecido',
                'avg_value_when_we_win' => round($wins->avg('estimated_value') ?? 0, 2),
                'avg_value_when_we_lose' => round($losses->avg('estimated_value') ?? 0, 2),
                'total_records' => $records->count(),
                'inference' => ($losses->avg('estimated_value') ?? 0) < ($wins->avg('estimated_value') ?? 0)
                    ? 'Provavelmente cobra menos que nós'
                    : 'Faixa de preço similar ou superior',
            ];
        })->values();

        return ['estimates' => $estimates];
    }

    // ── Feature #16: Competitor Profile ──

    public function getCompetitorProfile(int $tenantId, int $competitorId): array
    {
        $competitor = InmetroCompetitor::where('tenant_id', $tenantId)->findOrFail($competitorId);

        $repairs = $competitor->repairs()
            ->selectRaw("strftime('%Y-%m', repair_date) as month, COUNT(*) as cnt")
            ->groupByRaw("strftime('%Y-%m', repair_date)")
            ->orderBy('month')
            ->pluck('cnt', 'month');

        $citiesServed = DB::select("
            SELECT il.address_city as city, COUNT(DISTINCT cir.instrument_id) as instruments
            FROM competitor_instrument_repairs cir
            INNER JOIN inmetro_instruments ii ON ii.id = cir.instrument_id
            INNER JOIN inmetro_locations il ON il.id = ii.location_id
            WHERE cir.competitor_id = ?
            GROUP BY il.address_city
            ORDER BY instruments DESC
        ", [$competitorId]);

        $winLoss = InmetroWinLoss::where('tenant_id', $tenantId)
            ->where('competitor_id', $competitorId)
            ->get();

        $latestSnapshot = InmetroCompetitorSnapshot::where('competitor_id', $competitorId)
            ->orderByDesc('period_start')
            ->first();

        return [
            'profile' => $competitor,
            'market_share' => $latestSnapshot?->market_share_pct ?? 0,
            'instrument_count' => $latestSnapshot?->instrument_count ?? 0,
            'monthly_repairs' => $repairs,
            'cities_served' => $citiesServed,
            'win_loss' => [
                'wins' => $winLoss->where('outcome', 'win')->count(),
                'losses' => $winLoss->where('outcome', 'loss')->count(),
                'common_reasons' => $winLoss->groupBy('reason')->map->count()->sortDesc()->take(5),
            ],
            'strengths' => $this->inferStrengths($competitor, $citiesServed),
            'weaknesses' => $this->inferWeaknesses($competitor, $winLoss),
        ];
    }

    // ── Feature #17: Win/Loss Analysis ──

    public function recordWinLoss(array $data, int $tenantId): InmetroWinLoss
    {
        return InmetroWinLoss::create([
            'tenant_id' => $tenantId,
            'owner_id' => $data['owner_id'] ?? null,
            'competitor_id' => $data['competitor_id'] ?? null,
            'outcome' => $data['outcome'],
            'reason' => $data['reason'] ?? null,
            'estimated_value' => $data['estimated_value'] ?? null,
            'notes' => $data['notes'] ?? null,
            'outcome_date' => $data['outcome_date'] ?? today(),
        ]);
    }

    public function getWinLossAnalysis(int $tenantId, ?string $period = null): array
    {
        $query = InmetroWinLoss::where('tenant_id', $tenantId);

        if ($period === 'month') $query->where('outcome_date', '>=', now()->startOfMonth());
        elseif ($period === 'quarter') $query->where('outcome_date', '>=', now()->startOfQuarter());
        elseif ($period === 'year') $query->where('outcome_date', '>=', now()->startOfYear());

        $records = $query->with(['competitor:id,name', 'owner:id,name'])->get();

        $wins = $records->where('outcome', 'win');
        $losses = $records->where('outcome', 'loss');

        return [
            'period' => $period ?? 'all_time',
            'total' => $records->count(),
            'wins' => $wins->count(),
            'losses' => $losses->count(),
            'win_rate' => $records->count() > 0 ? round(($wins->count() / $records->count()) * 100, 1) : 0,
            'win_value' => round($wins->sum('estimated_value'), 2),
            'loss_value' => round($losses->sum('estimated_value'), 2),
            'by_competitor' => $records->groupBy(fn($r) => $r->competitor?->name ?? 'N/A')->map(fn($group) => [
                'wins' => $group->where('outcome', 'win')->count(),
                'losses' => $group->where('outcome', 'loss')->count(),
                'rate' => round(($group->where('outcome', 'win')->count() / max(1, $group->count())) * 100, 1),
            ]),
            'by_reason' => $losses->groupBy('reason')->map->count()->sortDesc(),
            'recent' => $records->sortByDesc('outcome_date')->take(10)->values(),
        ];
    }

    // ── Private helpers ──

    private function inferStrengths(InmetroCompetitor $competitor, $cities): array
    {
        $strengths = [];
        if (count($cities) > 5) $strengths[] = 'Ampla cobertura geográfica';
        if ($competitor->total_repairs_done > 100) $strengths[] = 'Volume alto de reparos';
        if ($competitor->authorization_valid_until && $competitor->authorization_valid_until->isFuture()) {
            $strengths[] = 'Autorização INMETRO válida';
        }
        return $strengths ?: ['Dados insuficientes para análise'];
    }

    private function inferWeaknesses(InmetroCompetitor $competitor, $winLoss): array
    {
        $weaknesses = [];
        $losses = $winLoss->where('outcome', 'loss');
        $priceLosses = $losses->where('reason', 'price')->count();
        if ($priceLosses > $losses->count() / 2) $weaknesses[] = 'Preço inferior ao nosso';
        if ($competitor->authorization_valid_until && $competitor->authorization_valid_until->isPast()) {
            $weaknesses[] = 'Autorização INMETRO possivelmente vencida';
        }
        return $weaknesses ?: ['Dados insuficientes para análise'];
    }
}
