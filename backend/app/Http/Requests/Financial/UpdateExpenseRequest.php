<?php

namespace App\Http\Requests\Financial;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateExpenseRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'expense_category_id' => $this->expense_category_id ?: null,
            'work_order_id' => $this->work_order_id ?: null,
            'chart_of_account_id' => $this->chart_of_account_id ?: null,
        ]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = $this->user()->current_tenant_id ?? $this->user()->tenant_id;

        return [
            'expense_category_id' => ['nullable', Rule::exists('expense_categories', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'chart_of_account_id' => ['nullable', Rule::exists('chart_of_accounts', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'description' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0.01',
            'expense_date' => 'sometimes|date|before_or_equal:today',
            'payment_method' => ['nullable', Rule::in(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia'])],
            'notes' => 'nullable|string',
            'affects_technician_cash' => 'boolean',
            'affects_net_value' => 'boolean',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120', // Max 5MB
        ];
    }
}
