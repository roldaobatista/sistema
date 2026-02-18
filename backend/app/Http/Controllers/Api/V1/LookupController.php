<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Lookups\AccountReceivableCategory;
use App\Models\Lookups\CalibrationType;
use App\Models\Lookups\CancellationReason;
use App\Models\Lookups\ContractType;
use App\Models\Lookups\CustomerSegment;
use App\Models\Lookups\DocumentType;
use App\Models\Lookups\EquipmentCategory;
use App\Models\Lookups\LeadSource;
use App\Models\Lookups\MaintenanceType;
use App\Models\Lookups\MeasurementUnit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LookupController extends Controller
{
    private const TYPE_MAP = [
        'equipment-categories'          => EquipmentCategory::class,
        'customer-segments'             => CustomerSegment::class,
        'lead-sources'                  => LeadSource::class,
        'contract-types'                => ContractType::class,
        'measurement-units'             => MeasurementUnit::class,
        'calibration-types'             => CalibrationType::class,
        'maintenance-types'             => MaintenanceType::class,
        'document-types'                => DocumentType::class,
        'account-receivable-categories' => AccountReceivableCategory::class,
        'cancellation-reasons'          => CancellationReason::class,
    ];

    public function types(): JsonResponse
    {
        return response()->json(array_keys(self::TYPE_MAP));
    }

    public function index(string $type): JsonResponse
    {
        $model = $this->resolveModel($type);
        if (!$model) {
            return response()->json(['message' => 'Tipo de cadastro inválido.'], 404);
        }

        $items = $model::query()->ordered()->get();

        return response()->json($items);
    }

    public function store(Request $request, string $type): JsonResponse
    {
        $model = $this->resolveModel($type);
        if (!$model) {
            return response()->json(['message' => 'Tipo de cadastro inválido.'], 404);
        }

        $rules = $this->validationRules($type);

        $validated = $request->validate($rules);

        try {
            $item = $model::create($validated);
            return response()->json($item, 201);
        } catch (\Throwable $e) {
            Log::error("Lookup store error [{$type}]", ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar registro.'], 500);
        }
    }

    public function update(Request $request, string $type, int $id): JsonResponse
    {
        $model = $this->resolveModel($type);
        if (!$model) {
            return response()->json(['message' => 'Tipo de cadastro inválido.'], 404);
        }

        $item = $model::find($id);
        if (!$item) {
            return response()->json(['message' => 'Registro não encontrado.'], 404);
        }

        $rules = $this->validationRules($type, $id);

        $validated = $request->validate($rules);

        try {
            $item->update($validated);
            return response()->json($item->fresh());
        } catch (\Throwable $e) {
            Log::error("Lookup update error [{$type}]", ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar registro.'], 500);
        }
    }

    public function destroy(string $type, int $id): JsonResponse
    {
        $model = $this->resolveModel($type);
        if (!$model) {
            return response()->json(['message' => 'Tipo de cadastro inválido.'], 404);
        }

        $item = $model::find($id);
        if (!$item) {
            return response()->json(['message' => 'Registro não encontrado.'], 404);
        }

        try {
            $item->delete();
            return response()->json(['message' => 'Registro excluído com sucesso.']);
        } catch (\Throwable $e) {
            Log::error("Lookup destroy error [{$type}]", ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir registro.'], 500);
        }
    }

    private function resolveModel(string $type): ?string
    {
        return self::TYPE_MAP[$type] ?? null;
    }

    private function validationRules(string $type, ?int $ignoreId = null): array
    {
        $modelClass = self::TYPE_MAP[$type];
        $table = (new $modelClass)->getTable();
        $tenantId = app()->bound('current_tenant_id') ? app('current_tenant_id') : null;

        $slugUnique = Rule::unique($table, 'slug')
            ->where('tenant_id', $tenantId);
        if ($ignoreId !== null) {
            $slugUnique->ignore($ignoreId);
        }

        $rules = [
            'name'        => [
                'required',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($table, $tenantId, $ignoreId): void {
                    $slug = Str::slug($value);
                    if ($slug === '') {
                        return;
                    }
                    $query = DB::table($table)
                        ->where('tenant_id', $tenantId)
                        ->where('slug', $slug)
                        ->whereNull('deleted_at');
                    if ($ignoreId !== null) {
                        $query->where('id', '!=', $ignoreId);
                    }
                    if ($query->exists()) {
                        $fail(__('validation.unique', ['attribute' => 'nome']));
                    }
                },
            ],
            'slug'        => ['nullable', 'string', 'max:255', $slugUnique],
            'description' => 'nullable|string|max:500',
            'color'       => 'nullable|string|max:20',
            'icon'        => 'nullable|string|max:50',
            'is_active'   => 'nullable|boolean',
            'sort_order'  => 'nullable|integer|min:0',
        ];

        if ($type === 'measurement-units') {
            $rules['abbreviation'] = 'nullable|string|max:20';
            $rules['unit_type'] = 'nullable|string|max:30';
        }

        if ($type === 'cancellation-reasons') {
            $rules['applies_to'] = 'nullable|array';
            $rules['applies_to.*'] = 'string|in:os,chamado,orcamento';
        }

        return $rules;
    }
}
