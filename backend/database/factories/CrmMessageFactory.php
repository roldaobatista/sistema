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
            'channel' => fake()->randomElement([CrmMessage::CHANNEL_WHATSAPP, CrmMessage::CHANNEL_EMAIL]),
            'direction' => CrmMessage::DIRECTION_OUTBOUND,
            'status' => CrmMessage::STATUS_SENT,
            'body' => fake()->paragraph(),
            'to_address' => fake()->phoneNumber(),
            'sent_at' => now(),
        ];
    }

    public function whatsapp(): static
    {
        return $this->state(fn () => [
            'channel' => CrmMessage::CHANNEL_WHATSAPP,
            'to_address' => fake()->numerify('##9########'),
            'provider' => 'evolution-api',
        ]);
    }

    public function email(): static
    {
        return $this->state(fn () => [
            'channel' => CrmMessage::CHANNEL_EMAIL,
            'subject' => fake()->sentence(),
            'to_address' => fake()->email(),
            'provider' => 'smtp',
        ]);
    }

    public function inbound(): static
    {
        return $this->state(fn () => [
            'direction' => CrmMessage::DIRECTION_INBOUND,
            'status' => CrmMessage::STATUS_DELIVERED,
            'delivered_at' => now(),
        ]);
    }

    public function failed(): static
    {
        return $this->state(fn () => [
            'status' => CrmMessage::STATUS_FAILED,
            'failed_at' => now(),
            'error_message' => 'Connection timeout',
        ]);
    }

    public function delivered(): static
    {
        return $this->state(fn () => [
            'status' => CrmMessage::STATUS_DELIVERED,
            'delivered_at' => now(),
        ]);
    }

    public function read(): static
    {
        return $this->state(fn () => [
            'status' => CrmMessage::STATUS_READ,
            'delivered_at' => now()->subMinutes(5),
            'read_at' => now(),
        ]);
    }
}
