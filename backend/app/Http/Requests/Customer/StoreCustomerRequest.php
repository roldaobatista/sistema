<?php

namespace App\Http\Requests\Customer;

use App\Models\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = $this->user()->current_tenant_id ?? $this->user()->tenant_id;

        return [
            'type' => 'required|in:PF,PJ',
            'name' => 'required|string|max:255',
            'trade_name' => 'nullable|string|max:255',
            'document' => [
                'nullable', 'string', 'max:20',
                new \App\Rules\CpfCnpj(),
                Rule::unique('customers', 'document')
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
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'google_maps_link' => 'nullable|url|max:500',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
            'source' => ['nullable', 'string', Rule::in(array_keys(Customer::SOURCES))],
            'segment' => ['nullable', 'string', Rule::in(array_keys(Customer::SEGMENTS))],
            'company_size' => ['nullable', 'string', Rule::in(array_keys(Customer::COMPANY_SIZES))],
            'annual_revenue_estimate' => 'nullable|numeric|min:0',
            'contract_type' => ['nullable', 'string', Rule::in(array_keys(Customer::CONTRACT_TYPES))],
            'contract_start' => 'nullable|date',
            'contract_end' => 'nullable|date|after_or_equal:contract_start',
            'rating' => ['nullable', 'string', Rule::in(array_keys(Customer::RATINGS))],
            'assigned_seller_id' => 'nullable|exists:users,id',
            // Enrichment fields
            'state_registration' => 'nullable|string|max:30',
            'municipal_registration' => 'nullable|string|max:30',
            'cnae_code' => 'nullable|string|max:10',
            'cnae_description' => 'nullable|string|max:255',
            'legal_nature' => 'nullable|string|max:255',
            'capital' => 'nullable|numeric|min:0',
            'simples_nacional' => 'nullable|boolean',
            'mei' => 'nullable|boolean',
            'company_status' => 'nullable|string|max:50',
            'opened_at' => 'nullable|date',
            'is_rural_producer' => 'boolean',
            'partners' => 'nullable|array',
            'partners.*.name' => 'nullable|string|max:255',
            'partners.*.role' => 'nullable|string|max:255',
            'partners.*.document' => 'nullable|string|max:20',
            'secondary_activities' => 'nullable|array',
            'secondary_activities.*.code' => 'nullable|string|max:10',
            'secondary_activities.*.description' => 'nullable|string|max:255',
            'enrichment_data' => 'nullable|array',
            'enriched_at' => 'nullable|date',

            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'contacts' => 'nullable|array',
            'contacts.*.name' => 'required|string|max:255',
            'contacts.*.role' => 'nullable|string|max:100',
            'contacts.*.phone' => 'nullable|string|max:20',
            'contacts.*.email' => 'nullable|email|max:255',
            'contacts.*.is_primary' => 'boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'O tipo (PF/PJ) e obrigatorio.',
            'name.required' => 'O nome e obrigatorio.',
            'document.unique' => 'Ja existe um cliente com este documento.',
            'contract_end.after_or_equal' => 'A data final do contrato deve ser posterior a data inicial.',
        ];
    }
}
