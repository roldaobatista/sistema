<?php

namespace App\Http\Requests\WorkOrder;

use App\Models\WorkOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorkOrderRequest extends FormRequest
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
            'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'priority' => 'sometimes|in:low,normal,high,urgent',
            'description' => 'required|string',
            'internal_notes' => 'nullable|string',
            'received_at' => 'nullable|date',
            'discount' => 'nullable|numeric|min:0',
            'os_number' => 'nullable|string|max:30',
            'quote_id' => ['nullable', Rule::exists('quotes', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'service_call_id' => ['nullable', Rule::exists('service_calls', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'seller_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'origin_type' => ['nullable', Rule::in([
                WorkOrder::ORIGIN_QUOTE,
                WorkOrder::ORIGIN_SERVICE_CALL,
                WorkOrder::ORIGIN_RECURRING,
                WorkOrder::ORIGIN_MANUAL,
                'direct',
            ])],
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'displacement_value' => 'nullable|numeric|min:0',
            'is_warranty' => 'sometimes|boolean',
            'technician_ids' => 'nullable|array',
            'technician_ids.*' => [Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_ids' => 'nullable|array',
            'equipment_ids.*' => [Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'new_equipment' => 'nullable|array',
            'new_equipment.type' => 'required_with:new_equipment|string|max:100',
            'new_equipment.brand' => 'nullable|string|max:100',
            'new_equipment.model' => 'nullable|string|max:100',
            'new_equipment.serial_number' => 'nullable|string|max:255',
            'items' => 'array',
            'items.*.type' => 'required|in:product,service',
            'items.*.reference_id' => 'nullable|integer',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'sometimes|numeric|min:0.01',
            'items.*.unit_price' => 'sometimes|numeric|min:0',
            'items.*.discount' => 'sometimes|numeric|min:0',
            'items.*.cost_price' => 'sometimes|numeric|min:0',
            'initial_status' => 'sometimes|in:open,completed,delivered,invoiced',
            'completed_at' => 'nullable|date',
            'started_at' => 'nullable|date',
            'delivered_at' => 'nullable|date',
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => 'O cliente e obrigatorio.',
            'customer_id.exists' => 'Cliente invalido.',
            'description.required' => 'A descricao e obrigatoria.',
            'items.*.description.required' => 'A descricao do item e obrigatoria.',
            'items.*.type.required' => 'O tipo do item e obrigatorio.',
            'items.*.type.in' => 'O tipo do item deve ser produto ou servico.',
        ];
    }
}
