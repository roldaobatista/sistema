<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\UserSkill>
 */
class UserSkillFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => \App\Models\User::factory(),
            'skill_id' => \App\Models\Skill::factory(),
            'current_level' => $this->faker->numberBetween(1, 5),
            'assessed_at' => $this->faker->date(),
            'assessed_by' => \App\Models\User::factory(),
        ];
    }
}
