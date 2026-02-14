<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrganizationController extends Controller
{
    // Departments
    public function indexDepartments()
    {
        return Department::with(['manager', 'parent', 'positions'])
            ->withCount('users')
            ->get();
    }

    public function storeDepartment(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|exists:departments,id',
            'manager_id' => 'nullable|exists:users,id',
            'cost_center' => 'nullable|string',
        ]);

        $dept = Department::create($validated + ['tenant_id' => auth()->user()->tenant_id]);
        return response()->json($dept, 201);
    }

    public function updateDepartment(Request $request, Department $department)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'parent_id' => 'nullable|exists:departments,id',
            'manager_id' => 'nullable|exists:users,id',
            'cost_center' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $department->update($validated);
        return response()->json($department);
    }

    public function destroyDepartment(Department $department)
    {
        if ($department->children()->exists() || $department->users()->exists()) {
            return response()->json(['message' => 'Cannot delete department with children or users'], 409);
        }
        $department->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // Positions
    public function indexPositions()
    {
        return Position::with('department')->get();
    }

    public function storePosition(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'department_id' => 'required|exists:departments,id',
            'level' => 'required|in:junior,pleno,senior,lead,manager,director,c-level',
            'description' => 'nullable|string',
        ]);

        $pos = Position::create($validated + ['tenant_id' => auth()->user()->tenant_id]);
        return response()->json($pos, 201);
    }

    public function updatePosition(Request $request, Position $position)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'department_id' => 'sometimes|exists:departments,id',
            'level' => 'sometimes|in:junior,pleno,senior,lead,manager,director,c-level',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $position->update($validated);
        return response()->json($position);
    }

    public function destroyPosition(Position $position)
    {
        if ($position->users()->exists()) {
            return response()->json(['message' => 'Cannot delete position with users'], 409);
        }
        $position->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // Org Chart Tree
    public function orgChart()
    {
        $departments = Department::with(['manager', 'positions'])
            ->whereNull('parent_id')
            ->with('children.manager', 'children.positions') // limited depth for now, recursive in frontend or deeper with
            ->get();
        // A recursive loader or flat list is better for frontend tree building
        // Returning flat list with parent_id is usually easier for frontend logic
        return Department::with(['manager', 'positions.users'])->get();
    }
}
