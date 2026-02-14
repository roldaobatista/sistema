<?php

namespace Database\Factories;

use App\Models\Checklist;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

class ChecklistSubmissionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'checklist_id' => Checklist::factory(),
            'work_order_id' => WorkOrder::factory(),
            'technician_id' => User::factory(),
            'responses' => [
                'item_1' => true,
                'item_2' => 'path/to/photo.jpg',
                'item_3' => 'Equipamento em bom estado'
            ],
            'completed_at' => now(),
        ];
    }
}
