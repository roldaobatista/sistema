<?php

namespace App\Http\Requests\ServiceCall;

use App\Models\ServiceCall;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceCallRequest extends FormRequest
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
            'quote_id' => ['nullable', Rule::exists('quotes', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'technician_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'priority' => ['nullable', Rule::in(array_keys(ServiceCall::PRIORITIES))],
            'scheduled_date' => 'nullable|date',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'state' => 'nullable|string|max:2',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'observations' => 'nullable|string',
            'equipment_ids' => 'nullable|array',
            'equipment_ids.*' => [Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => 'O cliente e obrigatorio.',
            'customer_id.exists' => 'Cliente invalido.',
            'state.max' => 'O estado deve ter no maximo 2 caracteres (UF).',
        ];
    }
}
