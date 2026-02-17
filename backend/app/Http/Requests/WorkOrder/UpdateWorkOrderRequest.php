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

        $workOrder = $this->route('workOrder') ?? $this->route('work_order');
        $isFinalStatus = $workOrder && in_array($workOrder->status, [
            \App\Models\WorkOrder::STATUS_INVOICED,
        ], true);

        $isClosedStatus = $workOrder && in_array($workOrder->status, [
            \App\Models\WorkOrder::STATUS_COMPLETED,
            \App\Models\WorkOrder::STATUS_DELIVERED,
            \App\Models\WorkOrder::STATUS_INVOICED,
        ], true);

        $rules = [
            'priority' => 'sometimes|in:low,normal,high,urgent',
            'description' => 'sometimes|string',
            'internal_notes' => 'nullable|string',
            'technical_report' => 'nullable|string',
            'displacement_value' => 'sometimes|numeric|min:0',
            'is_warranty' => 'sometimes|boolean',
        ];

        if (!$isFinalStatus) {
            $rules += [
                'customer_id' => ['sometimes', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
                'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
                'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
                'received_at' => 'nullable|date',
                'os_number' => 'nullable|string|max:30',
                'seller_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
                'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            ];
        }

        if (!$isClosedStatus) {
            $rules += [
                'discount' => 'sometimes|numeric|min:0',
                'discount_percentage' => 'sometimes|numeric|min:0|max:100',
            ];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'customer_id.exists' => 'Cliente inválido para este tenant.',
        ];
    }
}
