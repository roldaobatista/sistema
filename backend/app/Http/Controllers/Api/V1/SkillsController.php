<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Skill;
use App\Models\SkillRequirement;
use App\Models\UserSkill;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SkillsController extends Controller
{
    public function index()
    {
        return Skill::all();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'category' => 'nullable|string',
            'description' => 'nullable|string',
        ]);
        $skill = Skill::create($validated + ['tenant_id' => auth()->user()->tenant_id]);
        return response()->json($skill, 201);
    }

    public function update(Request $request, Skill $skill)
    {
        $skill->update($request->validate(['name' => 'string', 'category' => 'nullable|string', 'description' => 'nullable|string']));
        return response()->json($skill);
    }

    public function destroy(Skill $skill)
    {
        $skill->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // Matrix Data
    public function matrix()
    {
        // Return structured data for the skills matrix: Users -> Position -> Requirements vs Actual
        // This can be heavy, so filtering by department is recommended
        $users = \App\Models\User::where('tenant_id', auth()->user()->tenant_id)
            ->with(['position.skillRequirements.skill', 'skills'])
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'position' => $user->position ? $user->position->name : null,
                    'requirements' => $user->position ? $user->position->skillRequirements->map(function ($req) {
                        return [
                            'skill_id' => $req->skill_id,
                            'skill_name' => $req->skill->name,
                            'required' => $req->required_level,
                        ];
                    }) : [],
                    'skills' => $user->skills->map(function ($s) {
                        return [
                            'skill_id' => $s->skill_id,
                            'current' => $s->current_level,
                            'assessed_at' => $s->assessed_at,
                        ];
                    }),
                ];
            });
        
        return $users;
    }

    public function assessUser(Request $request, $userId)
    {
        $validated = $request->validate([
            'skill_id' => 'required|exists:skills,id',
            'level' => 'required|integer|min:1|max:5',
        ]);

        $us = UserSkill::updateOrCreate(
            ['user_id' => $userId, 'skill_id' => $validated['skill_id']],
            [
                'current_level' => $validated['level'],
                'assessed_at' => now(),
                'assessed_by' => auth()->id(),
            ]
        );
        return response()->json($us);
    }
}
