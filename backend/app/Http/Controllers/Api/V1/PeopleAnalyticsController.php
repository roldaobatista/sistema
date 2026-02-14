<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Department;
use App\Models\JobPosting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PeopleAnalyticsController extends Controller
{
    public function dashboard(Request $request)
    {
        // 1. Headcount Total
        $totalEmployees = User::where('is_active', true)->count();

        // 2. Headcount by Department
        $byDepartment = Department::withCount('users')->get()->map(function ($dept) {
            return ['name' => $dept->name, 'value' => $dept->users_count];
        });

        // 3. Turnover (Mocked logic for now, as we need historical data)
        // Ideally: (Dismissals / Average Headcount) * 100
        $turnoverRate = 2.5; // Dummy value

        // 4. Recruitment Stats
        $openJobs = JobPosting::where('status', 'open')->count();
        $totalCandidates = DB::table('candidates')->count();

        // 5. Gender Diversity (assuming we had gender field, using dummy distribution)
        $diversity = [
            ['name' => 'Masculino', 'value' => 60],
            ['name' => 'Feminino', 'value' => 40],
        ];

        return response()->json([
            'total_employees' => $totalEmployees,
            'turnover_rate' => $turnoverRate,
            'open_jobs' => $openJobs,
            'total_candidates' => $totalCandidates,
            'headcount_by_department' => $byDepartment,
            'diversity' => $diversity,
        ]);
    }
}
