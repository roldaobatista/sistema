<?php

namespace Database\Factories;

use App\Models\Tenant;
use App\Models\TimeEntry;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

class TimeEntryFactory extends Factory
{
    protected $model = TimeEntry::class;

    public function definition(): array
    {
        $start = $this->faker->dateTimeBetween('-7 days', 'now');
        $end = (clone $start)->modify('+' . $this->faker->numberBetween(30, 240) . ' minutes');

        return [
            'tenant_id' => Tenant::factory(),
            'work_order_id' => fn (array $attrs) =>
                WorkOrder::factory()->create(['tenant_id' => $attrs['tenant_id']])->id,
            'technician_id' => fn (array $attrs) =>
                User::factory()->create(['tenant_id' => $attrs['tenant_id']])->id,
            'schedule_id' => null,
            'started_at' => $start,
            'ended_at' => $end,
            'duration_minutes' => null, // calculado automaticamente pelo model
            'type' => $this->faker->randomElement([TimeEntry::TYPE_WORK, TimeEntry::TYPE_TRAVEL, TimeEntry::TYPE_WAITING]),
            'description' => $this->faker->optional()->sentence(),
        ];
    }

    public function running(): static
    {
        return $this->state([
            'started_at' => now(),
            'ended_at' => null,
            'duration_minutes' => null,
        ]);
    }

    public function work(): static
    {
        return $this->state(['type' => TimeEntry::TYPE_WORK]);
    }

    public function travel(): static
    {
        return $this->state(['type' => TimeEntry::TYPE_TRAVEL]);
    }

    public function waiting(): static
    {
        return $this->state(['type' => TimeEntry::TYPE_WAITING]);
    }
}
