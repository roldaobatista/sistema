<?php

namespace App\Http\Requests\Quote;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = $this->user()->current_tenant_id ?? $this->user()->tenant_id;

        return [
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'seller_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'valid_until' => 'nullable|date|after:today',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'observations' => 'nullable|string',
            'internal_notes' => 'nullable|string',
            'equipments' => 'required|array|min:1',
            'equipments.*.equipment_id' => ['required', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipments.*.description' => 'nullable|string',
            'equipments.*.items' => 'required|array|min:1',
            'equipments.*.items.*.type' => 'required|in:product,service',
            'equipments.*.items.*.product_id' => ['nullable', 'required_if:equipments.*.items.*.type,product', Rule::exists('products', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipments.*.items.*.service_id' => ['nullable', 'required_if:equipments.*.items.*.type,service', Rule::exists('services', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipments.*.items.*.custom_description' => 'nullable|string',
            'equipments.*.items.*.quantity' => 'required|numeric|min:0.01',
            'equipments.*.items.*.original_price' => 'required|numeric|min:0',
            'equipments.*.items.*.unit_price' => 'required|numeric|min:0',
            'equipments.*.items.*.discount_percentage' => 'nullable|numeric|min:0|max:100',
        ];
    }
}
