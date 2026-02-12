<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerMergeController extends Controller
{
    /**
     * Merge duplicate customers into a primary customer.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function merge(Request $request)
    {
        $user = $request->user();
        $tenantId = app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);

        $request->validate([
            'primary_id' => [
                'required',
                \Illuminate\Validation\Rule::exists('customers', 'id')
                    ->where('tenant_id', $tenantId)
                    ->whereNull('deleted_at'),
            ],
            'duplicate_ids' => 'required|array|min:1',
            'duplicate_ids.*' => [
                \Illuminate\Validation\Rule::exists('customers', 'id')
                    ->where('tenant_id', $tenantId)
                    ->whereNull('deleted_at'),
                'different:primary_id',
            ],
        ]);

        $primaryId = $request->primary_id;
        $duplicateIds = $request->duplicate_ids;

        DB::beginTransaction();

        try {
            $primary = Customer::findOrFail($primaryId);
            $duplicates = Customer::whereIn('id', $duplicateIds)->get();

            foreach ($duplicates as $duplicate) {
                // 1. Move Relationships
                
                // Contacts
                $duplicate->contacts()->update(['customer_id' => $primaryId]);
                
                // CRM Deals
                $duplicate->deals()->update(['customer_id' => $primaryId]);
                
                // CRM Activities
                $duplicate->activities()->update(['customer_id' => $primaryId]);
                
                // Equipments
                $duplicate->equipments()->update(['customer_id' => $primaryId]);
                
                // Work Orders
                $duplicate->workOrders()->update(['customer_id' => $primaryId]);
                
                // Quotes
                $duplicate->quotes()->update(['customer_id' => $primaryId]);
                
                // Service Calls
                $duplicate->serviceCalls()->update(['customer_id' => $primaryId]);
                
                // Accounts Receivable
                $duplicate->accountsReceivable()->update(['customer_id' => $primaryId]);

                // Client Portal Users (if any)
                // We need to check if schema exists or try catch, as it was just added in 6.1
                try {
                     \App\Models\ClientPortalUser::where('customer_id', $duplicate->id)
                        ->update(['customer_id' => $primaryId]);
                } catch (\Throwable $e) {
                    // Ignore if table/model issues, though it should exist now.
                }

                // Append notes from duplicate to primary
                if ($duplicate->notes) {
                    $newNotes = $primary->notes . "\n\n[Fusão em " . now()->format('d/m/Y') . "] Notas importadas de #{$duplicate->id} ({$duplicate->name}):\n" . $duplicate->notes;
                    $primary->update(['notes' => $newNotes]);
                }

                // 2. Soft Delete Duplicate
                // Add a note explaining why it was deleted
                $duplicate->notes = $duplicate->notes . "\n\n[Fusão] Mesclado com cliente #{$primaryId} em " . now()->format('d/m/Y H:i');
                $duplicate->save();
                $duplicate->delete();
            }

            // Recalculate Health Score for primary as it might have new data
            $primary->recalculateHealthScore();

            DB::commit();

            return response()->json([
                'message' => count($duplicates) . ' clientes foram mesclados com sucesso no cliente #' . $primaryId,
                'primary' => $primary->fresh()
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Search for potential duplicates.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function searchDuplicates(Request $request)
    {
        // Find customers with same name OR same document OR same email
        // This is a heavy query, optimize for specific cases or limited set.
        
        $type = $request->query('type', 'name'); // name, document, email
        
        $duplicates = [];

        if ($type === 'document') {
             $duplicates = Customer::select('document', DB::raw('count(*) as count'), DB::raw('GROUP_CONCAT(id) as ids'))
                ->whereNotNull('document')
                ->where('document', '!=', '')
                ->groupBy('document')
                ->having('count', '>', 1)
                ->limit(20)
                ->get();
        } elseif ($type === 'email') {
             $duplicates = Customer::select('email', DB::raw('count(*) as count'), DB::raw('GROUP_CONCAT(id) as ids'))
                ->whereNotNull('email')
                ->where('email', '!=', '')
                ->groupBy('email')
                ->having('count', '>', 1)
                ->limit(20)
                ->get();
        } else {
            // Name fuzzy search is hard in pure SQL efficiently without fulltext, 
            // but we can look for exact matches first.
            $duplicates = Customer::select('name', DB::raw('count(*) as count'), DB::raw('GROUP_CONCAT(id) as ids'))
                ->groupBy('name')
                ->having('count', '>', 1)
                ->limit(20)
                ->get();
        }

        // Hydrate the IDs to return basic info
        $results = [];
        foreach ($duplicates as $dup) {
            $ids = explode(',', $dup->ids);
            $customers = Customer::whereIn('id', $ids)->get(['id', 'name', 'document', 'email', 'created_at']);
            $results[] = [
                'key' => $dup->{$type}, // The duplicate value
                'count' => $dup->count,
                'customers' => $customers
            ];
        }

        return response()->json($results);
    }
}
