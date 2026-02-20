<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\StandardWeight;

class StandardWeightWearTest extends TestCase
{
    /**
     * A basic feature test example.
     */
    public function test_can_predict_standard_weight_wear(): void
    {
        $user = User::factory()->create();

        $weight = StandardWeight::factory()->create([
            'tenant_id' => $user->tenant_id,
            'nominal_value' => 20.0000,
        ]);

        $response = $this->actingAs($user)->postJson("/api/v1/standard-weights/{$weight->id}/predict-wear");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'weight_id',
                'name',
                'wear_rate_percentage',
                'expected_failure_date',
            ]);
    }
}
