<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class HrPeopleController extends Controller
{
    // ─── #33 Banco de Horas Automático ──────────────────────────

    public function hourBankSummary(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $userId = $request->input('user_id', $request->user()->id);
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());

        $entries = DB::table('clock_entries')
            ->where('company_id', $tenantId)
            ->where('user_id', $userId)
            ->whereBetween('date', [$from, $to])
            ->get();

        $expectedHoursPerDay = $request->input('daily_hours', 8);
        $totalWorked = 0;
        $totalExpected = 0;
        $details = [];

        foreach ($entries as $entry) {
            $worked = ($entry->total_minutes ?? 0) / 60;
            $dayOfWeek = Carbon::parse($entry->date)->dayOfWeek;
            $isWorkday = $dayOfWeek >= 1 && $dayOfWeek <= 5;
            $expected = $isWorkday ? $expectedHoursPerDay : 0;

            $totalWorked += $worked;
            $totalExpected += $expected;

            $details[] = [
                'date' => $entry->date,
                'worked_hours' => round($worked, 2),
                'expected_hours' => $expected,
                'balance' => round($worked - $expected, 2),
            ];
        }

        $balance = $totalWorked - $totalExpected;

        return response()->json([
            'user_id' => $userId,
            'period' => ['from' => $from, 'to' => $to],
            'total_worked' => round($totalWorked, 2),
            'total_expected' => round($totalExpected, 2),
            'balance_hours' => round($balance, 2),
            'balance_type' => $balance >= 0 ? 'credit' : 'debit',
            'details' => $details,
        ]);
    }

    // ─── #34 Escala de Plantão Técnico ──────────────────────────

    public function onCallSchedule(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $from = $request->input('from', now()->toDateString());
        $to = $request->input('to', now()->addDays(30)->toDateString());

        $schedule = DB::table('on_call_schedules')
            ->where('company_id', $tenantId)
            ->whereBetween('date', [$from, $to])
            ->join('users', 'on_call_schedules.user_id', '=', 'users.id')
            ->select('on_call_schedules.*', 'users.name as technician_name')
            ->orderBy('date')
            ->get();

        return response()->json($schedule);
    }

    public function storeOnCallSchedule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entries' => 'required|array|min:1',
            'entries.*.user_id' => 'required|integer|exists:users,id',
            'entries.*.date' => 'required|date',
            'entries.*.shift' => 'required|string|in:morning,afternoon,night,full',
        ]);

        $tenantId = $request->user()->company_id;

        foreach ($data['entries'] as $entry) {
            DB::table('on_call_schedules')->updateOrInsert(
                ['company_id' => $tenantId, 'date' => $entry['date'], 'shift' => $entry['shift']],
                ['user_id' => $entry['user_id'], 'updated_at' => now(), 'created_at' => now()]
            );
        }

        return response()->json(['message' => count($data['entries']) . ' schedule entries saved']);
    }

    // ─── #35 Avaliação de Desempenho 360° ──────────────────────

    public function performanceReviews(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        return response()->json(
            DB::table('performance_reviews')
                ->where('company_id', $tenantId)
                ->orderByDesc('created_at')
                ->paginate(20)
        );
    }

    public function storePerformanceReview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'reviewer_id' => 'required|integer|exists:users,id',
            'period' => 'required|string',
            'scores' => 'required|array',
            'scores.technical' => 'required|integer|min:1|max:5',
            'scores.communication' => 'required|integer|min:1|max:5',
            'scores.teamwork' => 'required|integer|min:1|max:5',
            'scores.initiative' => 'required|integer|min:1|max:5',
            'scores.punctuality' => 'required|integer|min:1|max:5',
            'comments' => 'nullable|string',
            'goals' => 'nullable|array',
        ]);

        $avgScore = round(collect($data['scores'])->avg(), 2);

        $id = DB::table('performance_reviews')->insertGetId([
            'company_id' => $request->user()->company_id,
            'user_id' => $data['user_id'],
            'reviewer_id' => $data['reviewer_id'],
            'period' => $data['period'],
            'scores' => json_encode($data['scores']),
            'average_score' => $avgScore,
            'comments' => $data['comments'] ?? null,
            'goals' => json_encode($data['goals'] ?? []),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['id' => $id, 'average_score' => $avgScore], 201);
    }

    // ─── #36 Onboarding Digital ─────────────────────────────────

    public function onboardingTemplates(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $templates = DB::table('onboarding_templates')
            ->where('company_id', $tenantId)->get();

        return response()->json($templates);
    }

    public function storeOnboardingTemplate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'role' => 'required|string',
            'steps' => 'required|array|min:1',
            'steps.*.title' => 'required|string',
            'steps.*.description' => 'nullable|string',
            'steps.*.days_offset' => 'required|integer|min:0',
            'steps.*.assignee_role' => 'nullable|string',
        ]);

        $id = DB::table('onboarding_templates')->insertGetId([
            'company_id' => $request->user()->company_id,
            'name' => $data['name'],
            'role' => $data['role'],
            'steps' => json_encode($data['steps']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['id' => $id], 201);
    }

    public function startOnboarding(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'template_id' => 'required|integer',
        ]);

        $template = DB::table('onboarding_templates')->find($data['template_id']);
        if (!$template) return response()->json(['message' => 'Template not found'], 404);

        $steps = json_decode($template->steps, true);
        $startDate = now();

        $onboardingId = DB::table('onboarding_processes')->insertGetId([
            'company_id' => $request->user()->company_id,
            'user_id' => $data['user_id'],
            'template_id' => $data['template_id'],
            'status' => 'in_progress',
            'started_at' => $startDate,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        foreach ($steps as $i => $step) {
            DB::table('onboarding_steps')->insert([
                'onboarding_process_id' => $onboardingId,
                'title' => $step['title'],
                'description' => $step['description'] ?? null,
                'due_date' => $startDate->copy()->addDays($step['days_offset'])->toDateString(),
                'position' => $i + 1,
                'status' => 'pending',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return response()->json(['onboarding_id' => $onboardingId, 'steps' => count($steps)], 201);
    }

    // ─── #37 Gestão de Treinamentos e Certificações ────────────

    public function trainingCourses(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $courses = DB::table('training_courses')
            ->where('company_id', $tenantId)
            ->paginate(20);

        return response()->json($courses);
    }

    public function storeTrainingCourse(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'duration_hours' => 'required|integer|min:1',
            'certification_validity_months' => 'nullable|integer',
            'is_mandatory' => 'boolean',
        ]);

        $data['company_id'] = $request->user()->company_id;
        $id = DB::table('training_courses')->insertGetId(array_merge($data, [
            'created_at' => now(), 'updated_at' => now(),
        ]));

        return response()->json(['id' => $id], 201);
    }

    public function enrollUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'course_id' => 'required|integer',
            'scheduled_date' => 'nullable|date',
        ]);

        $id = DB::table('training_enrollments')->insertGetId([
            'company_id' => $request->user()->company_id,
            'user_id' => $data['user_id'],
            'course_id' => $data['course_id'],
            'status' => 'enrolled',
            'scheduled_date' => $data['scheduled_date'] ?? null,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['enrollment_id' => $id], 201);
    }

    public function completeTraining(Request $request, int $enrollmentId): JsonResponse
    {
        $request->validate([
            'score' => 'nullable|numeric|min:0|max:100',
            'certification_number' => 'nullable|string',
        ]);

        $enrollment = DB::table('training_enrollments')->find($enrollmentId);
        if (!$enrollment) return response()->json(['message' => 'Not found'], 404);

        $course = DB::table('training_courses')->find($enrollment->course_id);
        $validityMonths = $course->certification_validity_months ?? null;

        DB::table('training_enrollments')->where('id', $enrollmentId)->update([
            'status' => 'completed',
            'completed_at' => now(),
            'score' => $request->input('score'),
            'certification_number' => $request->input('certification_number'),
            'certification_expires_at' => $validityMonths ? now()->addMonths($validityMonths)->toDateString() : null,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Training completed']);
    }
}
