<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Opportunity;
use App\Models\Quote;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class CrmAdvancedController extends Controller
{
    // ─── #22 Automação de Email por Etapa do Funil ──────────────

    public function funnelAutomations(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $automations = DB::table('funnel_email_automations')
            ->where('company_id', $tenantId)
            ->orderBy('pipeline_stage_id')
            ->get();

        return response()->json($automations);
    }

    public function storeFunnelAutomation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pipeline_stage_id' => 'required|integer',
            'trigger' => 'required|string|in:on_enter,on_exit,after_days',
            'trigger_days' => 'nullable|integer|min:1',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
            'is_active' => 'boolean',
        ]);

        $data['company_id'] = $request->user()->company_id;
        $id = DB::table('funnel_email_automations')->insertGetId(array_merge($data, [
            'created_at' => now(), 'updated_at' => now(),
        ]));

        return response()->json(['id' => $id, ...$data], 201);
    }

    public function updateFunnelAutomation(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'trigger' => 'sometimes|string|in:on_enter,on_exit,after_days',
            'trigger_days' => 'nullable|integer|min:1',
            'subject' => 'sometimes|string|max:255',
            'body' => 'sometimes|string',
            'is_active' => 'boolean',
        ]);

        DB::table('funnel_email_automations')
            ->where('id', $id)->where('company_id', $request->user()->company_id)
            ->update(array_merge($data, ['updated_at' => now()]));

        return response()->json(['message' => 'Updated']);
    }

    public function deleteFunnelAutomation(Request $request, int $id): JsonResponse
    {
        DB::table('funnel_email_automations')
            ->where('id', $id)->where('company_id', $request->user()->company_id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── #23 Lead Scoring com Interações ────────────────────────

    public function recalculateLeadScores(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $leads = Lead::where('company_id', $tenantId)->where('status', '!=', 'converted')->get();
        $updated = 0;

        foreach ($leads as $lead) {
            $score = 0;
            if ($lead->email) $score += 10;
            if ($lead->phone) $score += 5;
            if ($lead->company_name) $score += 10;

            $emailOpens = DB::table('email_tracking')->where('lead_id', $lead->id)->where('event', 'open')->count();
            $score += min(20, $emailOpens * 3);

            $emailClicks = DB::table('email_tracking')->where('lead_id', $lead->id)->where('event', 'click')->count();
            $score += min(25, $emailClicks * 5);

            $visits = DB::table('lead_activities')->where('lead_id', $lead->id)->where('type', 'website_visit')->count();
            $score += min(15, $visits * 2);

            $lastActivity = DB::table('lead_activities')->where('lead_id', $lead->id)->max('created_at');
            if ($lastActivity && Carbon::parse($lastActivity)->diffInDays(now()) <= 7) $score += 15;
            if ($lastActivity && Carbon::parse($lastActivity)->diffInDays(now()) > 30) $score = (int) ($score * 0.7);

            $lead->update(['score' => min(100, $score), 'score_updated_at' => now()]);
            $updated++;
        }

        return response()->json(['message' => "{$updated} lead scores recalculated"]);
    }

    // ─── #24 Orçamento com Assinatura Digital ───────────────────

    public function sendQuoteForSignature(Request $request, Quote $quote): JsonResponse
    {
        $token = bin2hex(random_bytes(32));
        $quote->update(['signature_token' => $token, 'signature_sent_at' => now(), 'status' => 'SENT']);

        return response()->json([
            'message' => 'Quote ready for signature',
            'signature_url' => config('app.frontend_url') . "/quote-sign/{$token}",
        ]);
    }

    public function signQuote(Request $request, string $token): JsonResponse
    {
        $request->validate([
            'signer_name' => 'required|string|max:255',
            'signature_data' => 'required|string',
        ]);

        $quote = Quote::where('signature_token', $token)->firstOrFail();
        if ($quote->signed_at) return response()->json(['message' => 'Already signed'], 422);

        $quote->update([
            'status' => 'APPROVED', 'signed_at' => now(),
            'signer_name' => $request->input('signer_name'),
            'signature_data' => $request->input('signature_data'),
            'signer_ip' => $request->ip(),
        ]);

        return response()->json(['message' => 'Quote signed successfully']);
    }

    // ─── #25 Previsão de Fechamento (Forecast) ─────────────────

    public function salesForecast(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $months = $request->input('months', 3);

        $opportunities = Opportunity::where('company_id', $tenantId)
            ->whereNotIn('status', ['lost', 'won'])->get();

        $forecast = [];
        for ($i = 0; $i < $months; $i++) {
            $monthStart = now()->addMonths($i)->startOfMonth();
            $monthEnd = $monthStart->copy()->endOfMonth();

            $monthOpps = $opportunities->filter(function ($opp) use ($monthStart, $monthEnd) {
                return Carbon::parse($opp->expected_close_date)->between($monthStart, $monthEnd);
            });

            $forecast[] = [
                'month' => $monthStart->format('Y-m'),
                'pipeline_value' => round($monthOpps->sum('value'), 2),
                'weighted_value' => round($monthOpps->sum(fn ($o) => $o->value * ($o->probability / 100)), 2),
                'opportunities_count' => $monthOpps->count(),
            ];
        }

        return response()->json([
            'forecast' => $forecast,
            'total_pipeline' => round($opportunities->sum('value'), 2),
        ]);
    }

    // ─── #26 Merge de Leads Duplicados ──────────────────────────

    public function findDuplicateLeads(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $duplicates = [];

        $byEmail = Lead::where('company_id', $tenantId)->whereNotNull('email')
            ->selectRaw('email, COUNT(*) as cnt, GROUP_CONCAT(id) as ids')
            ->groupBy('email')->having('cnt', '>', 1)->get();

        foreach ($byEmail as $d) {
            $duplicates[] = ['type' => 'email', 'value' => $d->email, 'lead_ids' => explode(',', $d->ids)];
        }

        $byPhone = Lead::where('company_id', $tenantId)->whereNotNull('phone')
            ->selectRaw('phone, COUNT(*) as cnt, GROUP_CONCAT(id) as ids')
            ->groupBy('phone')->having('cnt', '>', 1)->get();

        foreach ($byPhone as $d) {
            $duplicates[] = ['type' => 'phone', 'value' => $d->phone, 'lead_ids' => explode(',', $d->ids)];
        }

        return response()->json(['total_groups' => count($duplicates), 'duplicates' => $duplicates]);
    }

    public function mergeLeads(Request $request): JsonResponse
    {
        $request->validate([
            'primary_id' => 'required|integer|exists:leads,id',
            'merge_ids' => 'required|array|min:1',
        ]);

        $tenantId = $request->user()->company_id;
        $primary = Lead::where('company_id', $tenantId)->findOrFail($request->input('primary_id'));
        $mergeIds = $request->input('merge_ids');

        DB::beginTransaction();
        try {
            DB::table('lead_activities')->whereIn('lead_id', $mergeIds)->update(['lead_id' => $primary->id]);
            Opportunity::whereIn('lead_id', $mergeIds)->update(['lead_id' => $primary->id]);

            foreach (Lead::whereIn('id', $mergeIds)->get() as $ml) {
                if (!$primary->email && $ml->email) $primary->email = $ml->email;
                if (!$primary->phone && $ml->phone) $primary->phone = $ml->phone;
            }
            $primary->save();

            Lead::whereIn('id', $mergeIds)->update(['status' => 'merged', 'merged_into_id' => $primary->id, 'deleted_at' => now()]);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }

        return response()->json(['message' => count($mergeIds) . ' leads merged']);
    }

    // ─── #27 Pipeline Multi-Produto ─────────────────────────────

    public function multiProductPipelines(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $pipelines = DB::table('pipelines')->where('company_id', $tenantId)->get()
            ->map(function ($p) {
                $p->stages = DB::table('pipeline_stages')->where('pipeline_id', $p->id)->orderBy('position')->get();
                $p->total_value = Opportunity::where('pipeline_id', $p->id)->whereNotIn('status', ['lost'])->sum('value');
                return $p;
            });

        return response()->json($pipelines);
    }

    public function createPipeline(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'product_category' => 'nullable|string',
            'stages' => 'required|array|min:2',
            'stages.*.name' => 'required|string',
            'stages.*.probability' => 'required|integer|min:0|max:100',
        ]);

        $tenantId = $request->user()->company_id;
        DB::beginTransaction();
        try {
            $pipelineId = DB::table('pipelines')->insertGetId([
                'company_id' => $tenantId, 'name' => $data['name'],
                'product_category' => $data['product_category'] ?? null,
                'created_at' => now(), 'updated_at' => now(),
            ]);

            foreach ($data['stages'] as $i => $stage) {
                DB::table('pipeline_stages')->insert([
                    'pipeline_id' => $pipelineId, 'name' => $stage['name'],
                    'probability' => $stage['probability'], 'position' => $i + 1,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }

        return response()->json(['id' => $pipelineId, 'message' => 'Pipeline created'], 201);
    }
}
