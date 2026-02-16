<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WarrantyTracking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarrantyTrackingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) (auth()->user()->current_tenant_id ?? auth()->user()->tenant_id);

        $query = WarrantyTracking::with(['workOrder:id,os_number,number', 'customer:id,name', 'equipment:id,code', 'product:id,name,code'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('work_order_id')) {
            $query->where('work_order_id', $request->work_order_id);
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }
        if ($request->filled('equipment_id')) {
            $query->where('equipment_id', $request->equipment_id);
        }
        if ($request->filled('status')) {
            if ($request->status === 'active') {
                $query->whereDate('warranty_end_at', '>=', now()->toDateString());
            } elseif ($request->status === 'expired') {
                $query->whereDate('warranty_end_at', '<', now()->toDateString());
            } elseif ($request->status === 'expiring') {
                $query->whereDate('warranty_end_at', '>=', now()->toDateString())
                    ->whereDate('warranty_end_at', '<=', now()->addDays(30)->toDateString());
            }
        }

        $items = $query->orderBy('warranty_end_at')->paginate($request->integer('per_page', 20));
        return response()->json($items);
    }
}
