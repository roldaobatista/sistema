<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Schedule;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

class ScheduleFactory extends Factory
{
    protected $model = Schedule::class;

    public function definition(): array
    {
        $start = $this->faker->dateTimeBetween('now', '+30 days');
        $end = (clone $start)->modify('+' . $this->faker->numberBetween(1, 4) . ' hours');

        return [
            'tenant_id' => Tenant::factory(),
            'work_order_id' => null,
            'customer_id' => null,
            'technician_id' => fn (array $attrs) =>
                User::factory()->create(['tenant_id' => $attrs['tenant_id']])->id,
            'title' => $this->faker->sentence(3),
            'notes' => $this->faker->optional()->sentence(),
            'scheduled_start' => $start,
            'scheduled_end' => $end,
            'status' => Schedule::STATUS_SCHEDULED,
            'address' => $this->faker->optional()->address(),
        ];
    }

    public function confirmed(): static
    {
        return $this->state(['status' => Schedule::STATUS_CONFIRMED]);
    }

    public function completed(): static
    {
        return $this->state(['status' => Schedule::STATUS_COMPLETED]);
    }

    public function cancelled(): static
    {
        return $this->state(['status' => Schedule::STATUS_CANCELLED]);
    }
}
