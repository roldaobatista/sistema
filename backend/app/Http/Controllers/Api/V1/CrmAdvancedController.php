<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CrmDeal;
use App\Models\Quote;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class CrmAdvancedController extends Controller
{
    // ─── #22 Automação de Email por Etapa do Funil ──────────────

    public function funnelAutomations(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $automations = DB::table('funnel_email_automations')
            ->where('tenant_id', $tenantId)
            ->orderBy('pipeline_stage_id')
            ->get();

        return response()->json($automations);
    }

    public function storeFunnelAutomation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pipeline_stage_id' => 'required|integer',
            'trigger'           => 'required|string|in:on_enter,on_exit,after_days',
            'trigger_days'      => 'nullable|integer|min:1',
            'subject'           => 'required|string|max:255',
            'body'              => 'required|string',
            'is_active'         => 'boolean',
        ]);

        $data['tenant_id'] = $request->user()->current_tenant_id;
        $id = DB::table('funnel_email_automations')->insertGetId(array_merge($data, [
            'created_at' => now(), 'updated_at' => now(),
        ]));

        return response()->json(['id' => $id, ...$data], 201);
    }

    public function updateFunnelAutomation(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'trigger'      => 'sometimes|string|in:on_enter,on_exit,after_days',
            'trigger_days' => 'nullable|integer|min:1',
            'subject'      => 'sometimes|string|max:255',
            'body'         => 'sometimes|string',
            'is_active'    => 'boolean',
        ]);

        DB::table('funnel_email_automations')
            ->where('id', $id)->where('tenant_id', $request->user()->current_tenant_id)
            ->update(array_merge($data, ['updated_at' => now()]));

        return response()->json(['message' => 'Updated']);
    }

    public function deleteFunnelAutomation(Request $request, int $id): JsonResponse
    {
        DB::table('funnel_email_automations')
            ->where('id', $id)->where('tenant_id', $request->user()->current_tenant_id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── #23 Deal Scoring ───────────────────────────────────────
    // CRM usa CrmDeal (não Lead). Score calculado sobre deals abertos.

    public function recalculateLeadScores(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $deals    = CrmDeal::where('tenant_id', $tenantId)
            ->where('status', CrmDeal::STATUS_OPEN)
            ->get();
        $updated  = 0;

        foreach ($deals as $deal) {
            $score = 0;
            if ($deal->value > 0)   $score += 20;
            if ($deal->customer_id) $score += 10;

            $lastActivity = DB::table('crm_interactions')
                ->where('deal_id', $deal->id)
                ->max('created_at');

            if ($lastActivity && Carbon::parse($lastActivity)->diffInDays(now()) <= 7)  $score += 15;
            if ($lastActivity && Carbon::parse($lastActivity)->diffInDays(now()) > 30)  $score = (int) ($score * 0.7);

            $score += (int) ($deal->probability / 5);

            $deal->update(['score' => min(100, $score)]);
            $updated++;
        }

        return response()->json(['message' => "{$updated} deal scores recalculated"]);
    }

    // ─── #24 Orçamento com Assinatura Digital ───────────────────

    public function sendQuoteForSignature(Request $request, Quote $quote): JsonResponse
    {
        $token = bin2hex(random_bytes(32));
        // Token armazenado em internal_notes até migration dedicada ser criada
        $quote->update([
            'internal_notes' => ($quote->internal_notes ?? '') . "\n[SIGNATURE_TOKEN:{$token}]",
        ]);

        return response()->json([
            'message'       => 'Quote ready for signature',
            'signature_url' => config('app.frontend_url') . "/quote-sign/{$token}",
        ]);
    }

    public function signQuote(Request $request, string $token): JsonResponse
    {
        $request->validate([
            'signer_name'    => 'required|string|max:255',
            'signature_data' => 'required|string',
        ]);

        $quote = Quote::where('internal_notes', 'like', "%[SIGNATURE_TOKEN:{$token}]%")->firstOrFail();

        $quote->update(['approved_at' => now()]);

        return response()->json(['message' => 'Quote signed successfully']);
    }

    // ─── #25 Previsão de Fechamento (Forecast) ─────────────────

    public function salesForecast(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $months   = $request->input('months', 3);

        $deals = CrmDeal::where('tenant_id', $tenantId)
            ->whereNotIn('status', [CrmDeal::STATUS_LOST, CrmDeal::STATUS_WON])
            ->get();

        $forecast = [];
        for ($i = 0; $i < $months; $i++) {
            $monthStart = now()->addMonths($i)->startOfMonth();
            $monthEnd   = $monthStart->copy()->endOfMonth();

            $monthDeals = $deals->filter(function ($deal) use ($monthStart, $monthEnd) {
                return $deal->expected_close_date &&
                    Carbon::parse($deal->expected_close_date)->between($monthStart, $monthEnd);
            });

            $forecast[] = [
                'month'          => $monthStart->format('Y-m'),
                'pipeline_value' => round($monthDeals->sum('value'), 2),
                'weighted_value' => round($monthDeals->sum(fn ($d) => $d->value * ($d->probability / 100)), 2),
                'deals_count'    => $monthDeals->count(),
            ];
        }

        return response()->json([
            'forecast'       => $forecast,
            'total_pipeline' => round($deals->sum('value'), 2),
        ]);
    }

    // ─── #26 Deals Duplicados ────────────────────────────────────

    public function findDuplicateLeads(Request $request): JsonResponse
    {
        $tenantId   = $request->user()->current_tenant_id;
        $duplicates = [];

        $byCustomer = CrmDeal::where('tenant_id', $tenantId)
            ->where('status', CrmDeal::STATUS_OPEN)
            ->selectRaw('customer_id, stage_id, COUNT(*) as cnt, GROUP_CONCAT(id) as ids')
            ->groupBy('customer_id', 'stage_id')
            ->having('cnt', '>', 1)
            ->get();

        foreach ($byCustomer as $d) {
            $duplicates[] = [
                'type'     => 'customer_stage',
                'value'    => "customer_id:{$d->customer_id}",
                'deal_ids' => explode(',', $d->ids),
            ];
        }

        return response()->json(['total_groups' => count($duplicates), 'duplicates' => $duplicates]);
    }

    public function mergeLeads(Request $request): JsonResponse
    {
        $request->validate([
            'primary_id' => 'required|integer|exists:crm_deals,id',
            'merge_ids'  => 'required|array|min:1',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $primary  = CrmDeal::where('tenant_id', $tenantId)->findOrFail($request->input('primary_id'));
        $mergeIds = $request->input('merge_ids');

        DB::beginTransaction();
        try {
            DB::table('crm_interactions')
                ->whereIn('deal_id', $mergeIds)
                ->update(['deal_id' => $primary->id]);

            $maxValue = CrmDeal::whereIn('id', $mergeIds)->max('value');
            if ($maxValue > $primary->value) {
                $primary->value = $maxValue;
                $primary->save();
            }

            CrmDeal::whereIn('id', $mergeIds)->update([
                'status'     => CrmDeal::STATUS_LOST,
                'deleted_at' => now(),
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('CrmAdvanced mergeLeads: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['error' => 'Erro interno do servidor.'], 500);
        }

        return response()->json(['message' => count($mergeIds) . ' deals merged into #' . $primary->id]);
    }

    // ─── #27 Pipeline Multi-Produto ─────────────────────────────

    public function multiProductPipelines(Request $request): JsonResponse
    {
        $tenantId  = $request->user()->current_tenant_id;
        $pipelines = DB::table('crm_pipelines')->where('tenant_id', $tenantId)->get()
            ->map(function ($p) {
                $p->stages      = DB::table('crm_stages')->where('pipeline_id', $p->id)->orderBy('position')->get();
                $p->total_value = CrmDeal::where('pipeline_id', $p->id)
                    ->where('status', '!=', CrmDeal::STATUS_LOST)
                    ->sum('value');
                return $p;
            });

        return response()->json($pipelines);
    }

    public function createPipeline(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                 => 'required|string|max:255',
            'product_category'     => 'nullable|string',
            'stages'               => 'required|array|min:2',
            'stages.*.name'        => 'required|string',
            'stages.*.probability' => 'required|integer|min:0|max:100',
        ]);

        $tenantId = $request->user()->current_tenant_id;

        DB::beginTransaction();
        try {
            $pipelineId = DB::table('crm_pipelines')->insertGetId([
                'tenant_id'        => $tenantId,
                'name'             => $data['name'],
                'product_category' => $data['product_category'] ?? null,
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);

            foreach ($data['stages'] as $i => $stage) {
                DB::table('crm_stages')->insert([
                    'pipeline_id' => $pipelineId,
                    'name'        => $stage['name'],
                    'probability' => $stage['probability'],
                    'position'    => $i + 1,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('CrmAdvanced createPipeline: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['error' => 'Erro interno do servidor.'], 500);
        }

        return response()->json(['id' => $pipelineId, 'message' => 'Pipeline created'], 201);
    }
}
