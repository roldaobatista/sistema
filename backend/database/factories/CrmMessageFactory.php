<?php

namespace Database\Factories;

use App\Models\CrmMessage;
use App\Models\Customer;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class CrmMessageFactory extends Factory
{
    protected $model = CrmMessage::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'customer_id' => Customer::factory(),
            'channel' => fake()->randomElement(['whatsapp', 'email']),
            'direction' => 'outbound',
            'status' => 'sent',
            'body' => fake()->paragraph(),
            'to_address' => fake()->phoneNumber(),
            'sent_at' => now(),
        ];
    }

    public function whatsapp(): static
    {
        return $this->state(fn () => [
            'channel' => 'whatsapp',
            'to_address' => fake()->numerify('##9########'),
            'provider' => 'evolution-api',
        ]);
    }

    public function email(): static
    {
        return $this->state(fn () => [
            'channel' => 'email',
            'subject' => fake()->sentence(),
            'to_address' => fake()->email(),
            'provider' => 'smtp',
        ]);
    }

    public function inbound(): static
    {
        return $this->state(fn () => [
            'direction' => 'inbound',
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);
    }

    public function failed(): static
    {
        return $this->state(fn () => [
            'status' => 'failed',
            'failed_at' => now(),
            'error_message' => 'Connection timeout',
        ]);
    }

    public function delivered(): static
    {
        return $this->state(fn () => [
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);
    }

    public function read(): static
    {
        return $this->state(fn () => [
            'status' => 'read',
            'delivered_at' => now()->subMinutes(5),
            'read_at' => now(),
        ]);
    }
}
