<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    private const INVALID_TYPE = '__invalid_type__';

    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    private function resolvePayableType(?string $typeAlias, ?string $explicitType): ?string
    {
        if (!empty($explicitType)) {
            return in_array($explicitType, [AccountReceivable::class, AccountPayable::class], true)
                ? $explicitType
                : self::INVALID_TYPE;
        }

        if (empty($typeAlias)) {
            return null;
        }

        return match (strtolower(trim($typeAlias))) {
            'receivable' => AccountReceivable::class,
            'payable' => AccountPayable::class,
            default => self::INVALID_TYPE,
        };
    }

    private function validateFilters(Request $request): ?JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'payment_method' => ['nullable', 'string', 'max:50'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'type' => ['nullable', 'string', 'max:20'],
            'payable_type' => ['nullable', Rule::in([AccountReceivable::class, AccountPayable::class])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Parametros de filtro invalidos.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $from = $request->get('date_from');
        $to = $request->get('date_to');
        if ($from && $to && $from > $to) {
            return response()->json([
                'message' => 'Periodo invalido: date_from deve ser menor ou igual a date_to.',
            ], 422);
        }

        return null;
    }

    private function applyCommonFilters(Request $request, Builder $query): ?JsonResponse
    {
        if ($method = $request->get('payment_method')) {
            $query->where('payment_method', $method);
        }
        if ($from = $request->get('date_from')) {
            $query->whereDate('payment_date', '>=', $from);
        }
        if ($to = $request->get('date_to')) {
            $query->whereDate('payment_date', '<=', $to);
        }

        $payableType = $this->resolvePayableType(
            $request->get('type'),
            $request->get('payable_type')
        );
        if ($payableType === self::INVALID_TYPE) {
            return response()->json([
                'message' => 'Tipo invalido. Use receivable ou payable.',
            ], 422);
        }
        if ($payableType !== null) {
            $query->where('payable_type', $payableType);
        }

        return null;
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $validationError = $this->validateFilters($request);
            if ($validationError) {
                return $validationError;
            }

            $query = Payment::with(['receiver:id,name'])
                ->where('tenant_id', $this->tenantId($request));

            $filterError = $this->applyCommonFilters($request, $query);
            if ($filterError) {
                return $filterError;
            }

            $perPage = (int) ($request->get('per_page', 50));
            $payments = $query->orderByDesc('payment_date')
                ->orderByDesc('id')
                ->paginate($perPage);

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
        } catch (\Throwable $e) {
            Log::error('Payment index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar pagamentos'], 500);
        }
    }

    public function destroy(Request $request, Payment $payment): JsonResponse
    {
        // Verify tenant ownership
        if ((int) $payment->tenant_id !== $this->tenantId($request)) {
            return response()->json(['message' => 'Pagamento nao encontrado'], 404);
        }

        try {
            DB::transaction(function () use ($payment) {
                // Payment::booted() deleted event will automatically decrement amount_paid
                // and recalculate status on the payable
                $payment->delete();
            });

            return response()->json(['message' => 'Pagamento estornado com sucesso']);
        } catch (\Throwable $e) {
            Log::error('Payment destroy failed', ['id' => $payment->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao estornar pagamento'], 500);
        }
    }

    public function summary(Request $request): JsonResponse
    {
        try {
            $validationError = $this->validateFilters($request);
            if ($validationError) {
                return $validationError;
            }

            $query = Payment::query()
                ->where('tenant_id', $this->tenantId($request));

            $filterError = $this->applyCommonFilters($request, $query);
            if ($filterError) {
                return $filterError;
            }

            $totalReceived = (float) (clone $query)
                ->where('payable_type', AccountReceivable::class)
                ->sum('amount');
            $totalPaid = (float) (clone $query)
                ->where('payable_type', AccountPayable::class)
                ->sum('amount');
            $count = (int) (clone $query)->count();
            $total = (float) (clone $query)->sum('amount');
            $net = $totalReceived - $totalPaid;

            $byMethod = (clone $query)->selectRaw('payment_method, SUM(amount) as total, COUNT(*) as count')
                ->groupBy('payment_method')
                ->get();

            return response()->json([
                'total_received' => $totalReceived,
                'total_paid' => $totalPaid,
                'net' => $net,
                'count' => $count,
                'total' => $total,
                'by_method' => $byMethod,
            ]);
        } catch (\Throwable $e) {
            Log::error('Payment summary failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar resumo de pagamentos'], 500);
        }
    }
}
