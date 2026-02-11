<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PriceHistory;
use Illuminate\Http\Request;

class PriceHistoryController extends Controller
{
    public function index(Request $request)
    {
        $query = PriceHistory::with('changedByUser')
            ->orderByDesc('created_at');

        if ($request->filled('priceable_type')) {
            $query->where('priceable_type', $request->priceable_type);
        }

        if ($request->filled('priceable_id')) {
            $query->where('priceable_id', $request->priceable_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        return $query->paginate($request->per_page ?? 25);
    }

    public function forProduct(Request $request, int $productId)
    {
        return PriceHistory::with('changedByUser')
            ->where('priceable_type', \App\Models\Product::class)
            ->where('priceable_id', $productId)
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 25);
    }

    public function forService(Request $request, int $serviceId)
    {
        return PriceHistory::with('changedByUser')
            ->where('priceable_type', \App\Models\Service::class)
            ->where('priceable_id', $serviceId)
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 25);
    }
}
