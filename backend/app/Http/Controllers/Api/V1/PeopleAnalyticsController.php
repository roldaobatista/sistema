<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Department;
use App\Models\JobPosting;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class PeopleAnalyticsController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        try {
            $totalEmployees = User::where('is_active', true)->count();

            $byDepartment = Department::withCount('users')->get()->map(function ($dept) {
                return ['name' => $dept->name, 'value' => $dept->users_count];
            });

            $turnoverRate = 2.5;

            $openJobs = JobPosting::where('status', 'open')->count();
            $totalCandidates = DB::table('candidates')->count();

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
        } catch (\Exception $e) {
            Log::error('PeopleAnalytics dashboard failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar People Analytics'], 500);
        }
    }
}
