<?php

namespace App\Http\Controllers\Api\V1\Master;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Customer::with('contacts');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
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

        $customers = $query->orderBy('name')
            ->paginate($request->get('per_page', 20));

        return response()->json($customers);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;

    $validated = $request->validate([
        'type' => 'required|in:PF,PJ',
        'name' => 'required|string|max:255',
        'document' => [
            'nullable', 'string', 'max:20',
            \Illuminate\Validation\Rule::unique('customers', 'document')
                ->where('tenant_id', $tenantId)
                ->whereNull('deleted_at'),
        ],
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'phone2' => 'nullable|string|max:20',
            'address_zip' => 'nullable|string|max:10',
            'address_street' => 'nullable|string|max:255',
            'address_number' => 'nullable|string|max:20',
            'address_complement' => 'nullable|string|max:100',
            'address_neighborhood' => 'nullable|string|max:100',
            'address_city' => 'nullable|string|max:100',
            'address_state' => 'nullable|string|max:2',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
            'contacts' => 'array',
            'contacts.*.name' => 'required|string|max:255',
            'contacts.*.role' => 'nullable|string|max:100',
            'contacts.*.phone' => 'nullable|string|max:20',
            'contacts.*.email' => 'nullable|email|max:255',
            'contacts.*.is_primary' => 'boolean',
        ]);

        $customer = Customer::create(collect($validated)->except('contacts')->toArray());

        if (!empty($validated['contacts'])) {
            foreach ($validated['contacts'] as $contact) {
                $customer->contacts()->create($contact);
            }
        }

        return response()->json($customer->load('contacts'), 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json($customer->load('contacts'));
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'sometimes|in:PF,PJ',
            'name' => 'sometimes|string|max:255',
            'document' => [
                'nullable', 'string', 'max:20',
                \Illuminate\Validation\Rule::unique('customers', 'document')
                    ->where('tenant_id', $customer->tenant_id)
                    ->whereNull('deleted_at')
                    ->ignore($customer->id),
            ],
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'phone2' => 'nullable|string|max:20',
            'address_zip' => 'nullable|string|max:10',
            'address_street' => 'nullable|string|max:255',
            'address_number' => 'nullable|string|max:20',
            'address_complement' => 'nullable|string|max:100',
            'address_neighborhood' => 'nullable|string|max:100',
            'address_city' => 'nullable|string|max:100',
            'address_state' => 'nullable|string|max:2',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
            'contacts' => 'array',
            'contacts.*.id' => 'nullable|exists:customer_contacts,id',
            'contacts.*.name' => 'required|string|max:255',
            'contacts.*.role' => 'nullable|string|max:100',
            'contacts.*.phone' => 'nullable|string|max:20',
            'contacts.*.email' => 'nullable|email|max:255',
            'contacts.*.is_primary' => 'boolean',
        ]);

        $customer->update(collect($validated)->except('contacts')->toArray());

        // Sync contacts: update existing, create new, delete removed
        if (isset($validated['contacts'])) {
            $existingIds = [];
            foreach ($validated['contacts'] as $contactData) {
                if (!empty($contactData['id'])) {
                    $customer->contacts()->where('id', $contactData['id'])->update($contactData);
                    $existingIds[] = $contactData['id'];
                } else {
                    $c = $customer->contacts()->create($contactData);
                    $existingIds[] = $c->id;
                }
            }
            $customer->contacts()->whereNotIn('id', $existingIds)->delete();
        }

        return response()->json($customer->load('contacts'));
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $customer->delete();
        return response()->json(null, 204);
    }
}
