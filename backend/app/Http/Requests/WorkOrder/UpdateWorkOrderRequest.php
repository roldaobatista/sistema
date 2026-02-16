<?php

namespace App\Http\Requests\WorkOrder;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWorkOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = $this->user()->current_tenant_id ?? $this->user()->tenant_id;

        return [
            'customer_id' => ['sometimes', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'priority' => 'sometimes|in:low,normal,high,urgent',
            'description' => 'sometimes|string',
            'internal_notes' => 'nullable|string',
            'technical_report' => 'nullable|string',
            'received_at' => 'nullable|date',
            'discount' => 'sometimes|numeric|min:0',
            'os_number' => 'nullable|string|max:30',
            'seller_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'discount_percentage' => 'sometimes|numeric|min:0|max:100',
            'displacement_value' => 'sometimes|numeric|min:0',
            'is_warranty' => 'sometimes|boolean',
        ];
    }
}
