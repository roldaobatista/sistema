<?php

namespace App\Http\Requests\Quote;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function withValidator(\Illuminate\Contracts\Validation\Validator $validator): void
    {
        $validator->after(function ($v) {
            $pct = (float) ($this->discount_percentage ?? 0);
            $amt = (float) ($this->discount_amount ?? 0);
            if ($pct > 0 && $amt > 0) {
                $v->errors()->add('discount_amount', 'Não é possível informar desconto percentual e valor fixo ao mesmo tempo.');
            }
        });
    }

    public function rules(): array
    {
        $tenantId = $this->user()->current_tenant_id ?? $this->user()->tenant_id;

        return [
            'source' => 'nullable|in:prospeccao,retorno,contato_direto,indicacao',
            'customer_id' => ['sometimes', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'seller_id' => ['sometimes', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'valid_until' => 'nullable|date|after_or_equal:today',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'displacement_value' => 'nullable|numeric|min:0',
            'observations' => 'nullable|string',
            'internal_notes' => 'nullable|string',
        ];
    }
}
