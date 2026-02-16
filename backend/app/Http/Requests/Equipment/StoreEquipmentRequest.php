<?php

namespace App\Http\Requests\Equipment;

use App\Models\Equipment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEquipmentRequest extends FormRequest
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
            'type' => 'required|string|max:100',
            'category' => 'nullable|string|max:40',
            'brand' => 'nullable|string|max:100',
            'manufacturer' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string',
            'capacity' => 'nullable|numeric',
            'capacity_unit' => 'nullable|string|max:10',
            'resolution' => 'nullable|numeric',
            'precision_class' => 'nullable|in:I,II,III,IIII',
            'status' => ['nullable', Rule::in(array_keys(Equipment::STATUSES))],
            'location' => 'nullable|string|max:150',
            'responsible_user_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'purchase_date' => 'nullable|date',
            'purchase_value' => 'nullable|numeric',
            'warranty_expires_at' => 'nullable|date',
            'last_calibration_at' => 'nullable|date',
            'next_calibration_at' => 'nullable|date',
            'calibration_interval_months' => 'nullable|integer|min:1',
            'inmetro_number' => 'nullable|string|max:50',
            'tag' => 'nullable|string|max:50',
            'is_critical' => 'nullable|boolean',
            'notes' => 'nullable|string',
            'equipment_model_id' => ['nullable', Rule::exists('equipment_models', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => 'O cliente e obrigatorio.',
            'customer_id.exists' => 'Cliente invalido.',
            'type.required' => 'O tipo do equipamento e obrigatorio.',
            'precision_class.in' => 'A classe de precisao deve ser I, II, III ou IIII.',
        ];
    }
}
