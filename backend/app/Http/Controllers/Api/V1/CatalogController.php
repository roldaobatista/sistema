<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Models\ServiceCatalog;
use App\Models\ServiceCatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CatalogController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    /** Público — catálogo por slug (sem auth) */
    public function publicShow(string $slug): JsonResponse
    {
        $catalog = ServiceCatalog::withoutGlobalScopes()
            ->where('slug', $slug)
            ->where('is_published', true)
            ->with(['items' => fn ($q) => $q->orderBy('sort_order')])
            ->first();

        if (!$catalog) {
            return response()->json(['message' => 'Catálogo não encontrado'], 404);
        }

        $tenant = $catalog->tenant;
        $items = $catalog->items->map(function (ServiceCatalogItem $item) {
            return [
                'id' => $item->id,
                'title' => $item->title,
                'description' => $item->description,
                'image_url' => $item->image_path
                    ? Storage::disk('public')->url($item->image_path)
                    : null,
                'service' => $item->service ? [
                    'id' => $item->service->id,
                    'name' => $item->service->name,
                    'code' => $item->service->code,
                    'default_price' => $item->service->default_price,
                ] : null,
            ];
        });

        return response()->json([
            'catalog' => [
                'id' => $catalog->id,
                'name' => $catalog->name,
                'slug' => $catalog->slug,
                'subtitle' => $catalog->subtitle,
                'header_description' => $catalog->header_description,
            ],
            'tenant' => $tenant ? ['name' => $tenant->name] : null,
            'items' => $items,
        ]);
    }

    /** Admin — listar catálogos */
    public function index(Request $request): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId($request));

        $catalogs = ServiceCatalog::withCount('items')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $catalogs]);
    }

    /** Admin — criar catálogo */
    public function store(Request $request): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId($request));

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:64|regex:/^[a-z0-9\-]+$/',
            'subtitle' => 'nullable|string|max:255',
            'header_description' => 'nullable|string',
            'is_published' => 'boolean',
        ]);

        $base = isset($validated['slug']) && $validated['slug']
            ? Str::slug($validated['slug'])
            : Str::slug($validated['name']);
        $validated['slug'] = ServiceCatalog::generateSlug($base);
        $validated['tenant_id'] = $this->tenantId($request);

        try {
            $catalog = DB::transaction(fn () => ServiceCatalog::create($validated));
            return response()->json($catalog->loadCount('items'), 201);
        } catch (\Throwable $e) {
            Log::error('ServiceCatalog store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar catálogo'], 500);
        }
    }

    /** Admin — atualizar catálogo */
    public function update(Request $request, ServiceCatalog $catalog): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId($request));

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9\-]+$/', Rule::unique('service_catalogs', 'slug')->ignore($catalog->id)],
            'subtitle' => 'nullable|string|max:255',
            'header_description' => 'nullable|string',
            'is_published' => 'boolean',
        ]);

        if (!empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        try {
            $catalog->update($validated);
            return response()->json($catalog->loadCount('items'));
        } catch (\Throwable $e) {
            Log::error('ServiceCatalog update failed', ['id' => $catalog->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar catálogo'], 500);
        }
    }

    /** Admin — excluir catálogo */
    public function destroy(ServiceCatalog $catalog): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId(request()));

        try {
            DB::transaction(function () use ($catalog) {
                foreach ($catalog->items as $item) {
                    if ($item->image_path) {
                        Storage::disk('public')->delete($item->image_path);
                    }
                }
                $catalog->items()->delete();
                $catalog->delete();
            });
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('ServiceCatalog destroy failed', ['id' => $catalog->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir catálogo'], 500);
        }
    }

    /** Admin — listar itens do catálogo */
    public function items(ServiceCatalog $catalog): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId(request()));

        $items = $catalog->items()
            ->with('service:id,name,code,default_price')
            ->orderBy('sort_order')
            ->get();

        $items = $items->map(function (ServiceCatalogItem $item) {
            $arr = $item->toArray();
            $arr['image_url'] = $item->image_path ? Storage::disk('public')->url($item->image_path) : null;
            return $arr;
        });

        return response()->json(['data' => $items]);
    }

    /** Admin — criar item */
    public function storeItem(Request $request, ServiceCatalog $catalog): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId($request));

        $validated = $request->validate([
            'service_id' => 'nullable|exists:services,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'sort_order' => 'integer|min:0',
        ]);

        $validated['service_catalog_id'] = $catalog->id;
        $validated['sort_order'] = $validated['sort_order'] ?? ($catalog->items()->max('sort_order') ?? 0) + 1;

        $item = ServiceCatalogItem::create($validated);
        $item->load('service:id,name,code,default_price');
        $arr = $item->toArray();
        $arr['image_url'] = null;

        return response()->json($arr, 201);
    }

    /** Admin — atualizar item */
    public function updateItem(Request $request, ServiceCatalog $catalog, ServiceCatalogItem $item): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId($request));

        if ((int) $item->service_catalog_id !== (int) $catalog->id) {
            return response()->json(['message' => 'Item não pertence ao catálogo'], 404);
        }

        $validated = $request->validate([
            'service_id' => 'nullable|exists:services,id',
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'sort_order' => 'integer|min:0',
        ]);

        $item->update($validated);
        $item->load('service:id,name,code,default_price');
        $arr = $item->toArray();
        $arr['image_url'] = $item->image_path ? Storage::disk('public')->url($item->image_path) : null;

        return response()->json($arr);
    }

    /** Admin — excluir item */
    public function destroyItem(ServiceCatalog $catalog, ServiceCatalogItem $item): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId(request()));

        if ((int) $item->service_catalog_id !== (int) $catalog->id) {
            return response()->json(['message' => 'Item não pertence ao catálogo'], 404);
        }

        if ($item->image_path) {
            Storage::disk('public')->delete($item->image_path);
        }
        $item->delete();

        return response()->json(null, 204);
    }

    /** Admin — upload de imagem do item */
    public function uploadImage(Request $request, ServiceCatalog $catalog, ServiceCatalogItem $item): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId($request));

        if ((int) $item->service_catalog_id !== (int) $catalog->id) {
            return response()->json(['message' => 'Item não pertence ao catálogo'], 404);
        }

        $request->validate([
            'image' => 'required|image|mimes:jpeg,jpg,png,webp|max:4096',
        ]);

        if ($item->image_path) {
            Storage::disk('public')->delete($item->image_path);
        }

        $path = $request->file('image')->store('catalog/' . $catalog->id, 'public');
        $item->update(['image_path' => $path]);

        return response()->json([
            'image_url' => Storage::disk('public')->url($path),
            'image_path' => $path,
        ]);
    }

    /** Admin — reordenar itens */
    public function reorderItems(Request $request, ServiceCatalog $catalog): JsonResponse
    {
        app()->instance('current_tenant_id', $this->tenantId($request));

        $validated = $request->validate([
            'item_ids' => 'required|array',
            'item_ids.*' => 'integer|exists:service_catalog_items,id',
        ]);

        foreach ($validated['item_ids'] as $order => $id) {
            ServiceCatalogItem::where('id', $id)
                ->where('service_catalog_id', $catalog->id)
                ->update(['sort_order' => $order]);
        }

        $items = $catalog->items()->with('service:id,name,code,default_price')->orderBy('sort_order')->get();
        $items = $items->map(fn (ServiceCatalogItem $i) => array_merge($i->toArray(), [
            'image_url' => $i->image_path ? Storage::disk('public')->url($i->image_path) : null,
        ]));

        return response()->json(['data' => $items]);
    }
}
