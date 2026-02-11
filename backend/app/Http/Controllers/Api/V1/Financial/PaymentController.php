<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Payment::with(['receiver:id,name'])
            ->where('tenant_id', $this->tenantId($request));

        if ($method = $request->get('payment_method')) {
            $query->where('payment_method', $method);
        }
        if ($from = $request->get('date_from')) {
            $query->where('payment_date', '>=', $from);
        }
        if ($to = $request->get('date_to')) {
            $query->where('payment_date', '<=', $to);
        }
        if ($type = $request->get('payable_type')) {
            $query->where('payable_type', $type);
        }

        $payments = $query->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->paginate($request->get('per_page', 50));

        // Eager load payable info
        $payments->getCollection()->transform(function ($payment) {
            $payable = $payment->payable;
            $payment->payable_summary = match (class_basename($payment->payable_type)) {
                'AccountReceivable' => [
                    'type' => 'receivable',
                    'description' => $payable?->description,
                    'customer' => $payable?->customer?->name ?? null,
                ],
                'AccountPayable' => [
                    'type' => 'payable',
                    'description' => $payable?->description,
                    'supplier' => $payable?->supplier ?? $payable?->supplierRelation?->name ?? null,
                ],
                default => ['type' => 'unknown'],
            };
            return $payment;
        });

        return response()->json($payments);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = Payment::query()
            ->where('tenant_id', $this->tenantId($request));

        if ($from = $request->get('date_from')) {
            $query->where('payment_date', '>=', $from);
        }
        if ($to = $request->get('date_to')) {
            $query->where('payment_date', '<=', $to);
        }

        $total = (clone $query)->sum('amount');
        $byMethod = (clone $query)->selectRaw('payment_method, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('payment_method')
            ->get();

        return response()->json([
            'total' => (float) $total,
            'by_method' => $byMethod,
        ]);
    }
}
