<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EmployeeBenefit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeBenefitController extends Controller
{
    public function index(Request $request)
    {
        $query = EmployeeBenefit::with('user');

        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        return response()->json($query->paginate(20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'type' => 'required|string',
            'provider' => 'nullable|string',
            'value' => 'required|numeric|min:0',
            'employee_contribution' => 'nullable|numeric|min:0',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'is_active' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        $benefit = EmployeeBenefit::create($validated);

        return response()->json($benefit, 201);
    }

    public function show($id)
    {
        return EmployeeBenefit::with('user')->findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $benefit = EmployeeBenefit::findOrFail($id);

        $validated = $request->validate([
            'user_id' => 'exists:users,id',
            'type' => 'string',
            'provider' => 'nullable|string',
            'value' => 'numeric|min:0',
            'employee_contribution' => 'nullable|numeric|min:0',
            'start_date' => 'date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'is_active' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        $benefit->update($validated);

        return response()->json($benefit);
    }

    public function destroy($id)
    {
        $benefit = EmployeeBenefit::findOrFail($id);
        $benefit->delete();

        return response()->json(null, 204);
    }
}
