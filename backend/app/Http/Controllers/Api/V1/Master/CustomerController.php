<?php

namespace App\Http\Controllers\Api\V1\Master;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Models\Customer;
use App\Models\CustomerContact;
use App\Events\CustomerCreated;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Customer::with(['contacts', 'assignedSeller:id,name']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('trade_name', 'like', "%{$search}%")
                    ->orWhere('document', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->has('type')) {
            $query->where('type', $request->get('type'));
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->has('segment')) {
            $query->where('segment', $request->get('segment'));
        }

        if ($request->has('rating')) {
            $query->where('rating', $request->get('rating'));
        }

        if ($request->has('source')) {
            $query->where('source', $request->get('source'));
        }

        if ($request->has('assigned_seller_id')) {
            $query->where('assigned_seller_id', $request->get('assigned_seller_id'));
        }

        $sortField = $request->get('sort', 'name');
        $sortDir = $request->get('direction', 'asc');
        $allowedSorts = ['name', 'created_at', 'health_score', 'last_contact_at', 'rating'];
        if (in_array($sortField, $allowedSorts)) {
            $query->orderBy($sortField, $sortDir === 'desc' ? 'desc' : 'asc');
        } else {
            $query->orderBy('name');
        }

        $customers = $query->paginate($request->get('per_page', 20));

        return response()->json($customers);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $validated = $request->validated();

        try {
            DB::beginTransaction();

            $customer = Customer::create(collect($validated)->except('contacts')->toArray());

            if (!empty($validated['contacts'])) {
                foreach ($validated['contacts'] as $contactData) {
                    $customer->contacts()->create($contactData);
                }
            }

            \App\Events\CustomerCreated::dispatch($customer);

            DB::commit();

            return response()->json($customer->load(['contacts', 'assignedSeller:id,name']), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar cliente', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao criar cliente.'], 500);
        }
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json(
            $customer->load(['contacts', 'assignedSeller:id,name'])
        );
    }

    public function update(UpdateCustomerRequest $request, Customer $customer): JsonResponse
    {
        $validated = $request->validated();

        try {
            DB::beginTransaction();

            $customer->update(collect($validated)->except('contacts')->toArray());

            // Sync contacts: only if explicitly provided in the request
            if ($request->has('contacts')) {
                $providedContacts = $validated['contacts'] ?? [];
                $existingContactIds = [];

                foreach ($providedContacts as $contactData) {
                    if (!empty($contactData['id'])) {
                        $customer->contacts()->where('id', $contactData['id'])->update($contactData);
                        $existingContactIds[] = $contactData['id'];
                    } else {
                        $newContact = $customer->contacts()->create($contactData);
                        $existingContactIds[] = $newContact->id;
                    }
                }

                // Delete only if an empty array or specific contacts were omitted FROM THE PROVIDED LIST
                $customer->contacts()->whereNotIn('id', $existingContactIds)->delete();
            }

            DB::commit();

            return response()->json($customer->load(['contacts', 'assignedSeller:id,name']));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao atualizar cliente', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao atualizar cliente.'], 500);
        }
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $hasActiveOrders = $customer->workOrders()
            ->whereNotIn('status', [\App\Models\WorkOrder::STATUS_CANCELLED])
            ->exists();
        $hasReceivables = $customer->accountsReceivable()
            ->whereIn('status', [
                \App\Models\AccountReceivable::STATUS_PENDING,
                \App\Models\AccountReceivable::STATUS_PARTIAL,
                \App\Models\AccountReceivable::STATUS_OVERDUE,
            ])->exists();
        
        $quotesCount = \App\Models\Quote::where('customer_id', $customer->id)->count();
        $dealsCount = \App\Models\CrmDeal::where('customer_id', $customer->id)->count();

        if ($hasActiveOrders || $hasReceivables || $quotesCount > 0 || $dealsCount > 0) {
            $blocks = [];
            if ($hasActiveOrders) $blocks[] = 'ordens de serviço ativas';
            if ($hasReceivables) $blocks[] = 'pendências financeiras';
            if ($quotesCount > 0) $blocks[] = "$quotesCount orçamento(s)";
            if ($dealsCount > 0) $blocks[] = "$dealsCount negociação(ões)";
            
            return response()->json([
                'message' => 'Não é possível excluir — cliente possui ' . implode(', ', $blocks),
                'dependencies' => [
                    'active_work_orders' => $hasActiveOrders,
                    'receivables' => $hasReceivables,
                    'quotes' => $quotesCount,
                    'deals' => $dealsCount,
                ],
            ], 409);
        }

        try {
            DB::transaction(fn () => $customer->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('Customer destroy failed', ['id' => $customer->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir cliente'], 500);
        }
    }

    /**
     * Return CRM enum options for frontend selects.
     */
    public function options(): JsonResponse
    {
        return response()->json([
            'sources' => Customer::SOURCES,
            'segments' => Customer::SEGMENTS,
            'company_sizes' => Customer::COMPANY_SIZES,
            'contract_types' => Customer::CONTRACT_TYPES,
            'ratings' => Customer::RATINGS,
        ]);
    }
}
