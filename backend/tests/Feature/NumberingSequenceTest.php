<?php

namespace Tests\Feature;

use App\Models\NumberingSequence;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NumberingSequenceTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_index_returns_sequences_for_tenant(): void
    {
        NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'equipment',
            'prefix' => 'EQP-',
            'next_number' => 1,
            'padding' => 5,
        ]);

        NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'certificate',
            'prefix' => 'CERT-',
            'next_number' => 100,
            'padding' => 6,
        ]);

        $response = $this->getJson('/api/v1/numbering-sequences');

        $response->assertStatus(200);
        $response->assertJsonCount(2);
        $response->assertJsonFragment(['entity' => 'equipment', 'prefix' => 'EQP-']);
        $response->assertJsonFragment(['entity' => 'certificate', 'prefix' => 'CERT-']);
    }

    public function test_index_excludes_other_tenant_sequences(): void
    {
        $otherTenant = Tenant::factory()->create();

        NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'equipment',
            'prefix' => 'EQP-',
            'next_number' => 1,
            'padding' => 5,
        ]);

        NumberingSequence::create([
            'tenant_id' => $otherTenant->id,
            'entity' => 'equipment',
            'prefix' => 'OTHER-',
            'next_number' => 1,
            'padding' => 5,
        ]);

        $response = $this->getJson('/api/v1/numbering-sequences');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonFragment(['prefix' => 'EQP-']);
        $response->assertJsonMissing(['prefix' => 'OTHER-']);
    }

    public function test_update_changes_prefix_and_padding(): void
    {
        $seq = NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'certificate',
            'prefix' => 'CERT-',
            'next_number' => 1,
            'padding' => 4,
        ]);

        $response = $this->putJson("/api/v1/numbering-sequences/{$seq->id}", [
            'prefix' => 'CAL-',
            'padding' => 6,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('numbering_sequences', [
            'id' => $seq->id,
            'prefix' => 'CAL-',
            'padding' => 6,
            'next_number' => 1,
        ]);
    }

    public function test_update_changes_next_number(): void
    {
        $seq = NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'equipment',
            'prefix' => 'EQP-',
            'next_number' => 5,
            'padding' => 5,
        ]);

        $response = $this->putJson("/api/v1/numbering-sequences/{$seq->id}", [
            'next_number' => 1000,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('numbering_sequences', [
            'id' => $seq->id,
            'next_number' => 1000,
        ]);
    }

    public function test_update_rejects_other_tenant_sequence(): void
    {
        $otherTenant = Tenant::factory()->create();

        $seq = NumberingSequence::create([
            'tenant_id' => $otherTenant->id,
            'entity' => 'equipment',
            'prefix' => 'OTHER-',
            'next_number' => 1,
            'padding' => 5,
        ]);

        $response = $this->putJson("/api/v1/numbering-sequences/{$seq->id}", [
            'prefix' => 'HACKED-',
        ]);

        // BelongsToTenant scope makes the record invisible — returns 404 (not 403)
        $response->assertStatus(404);
    }

    public function test_update_validates_padding_max(): void
    {
        $seq = NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'equipment',
            'prefix' => 'EQP-',
            'next_number' => 1,
            'padding' => 5,
        ]);

        $response = $this->putJson("/api/v1/numbering-sequences/{$seq->id}", [
            'padding' => 15,
        ]);

        $response->assertStatus(422);
    }

    public function test_preview_returns_formatted_number(): void
    {
        $seq = NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'certificate',
            'prefix' => 'CERT-',
            'next_number' => 42,
            'padding' => 6,
        ]);

        $response = $this->getJson("/api/v1/numbering-sequences/{$seq->id}/preview");

        $response->assertStatus(200);
        $response->assertJsonFragment(['preview' => 'CERT-000042']);
    }

    public function test_preview_with_custom_params(): void
    {
        $seq = NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'certificate',
            'prefix' => 'CERT-',
            'next_number' => 42,
            'padding' => 6,
        ]);

        $response = $this->getJson("/api/v1/numbering-sequences/{$seq->id}/preview?prefix=CAL-&next_number=100&padding=4");

        $response->assertStatus(200);
        $response->assertJsonFragment(['preview' => 'CAL-0100']);
    }

    public function test_generate_next_increments_atomically(): void
    {
        $seq = NumberingSequence::create([
            'tenant_id' => $this->tenant->id,
            'entity' => 'equipment',
            'prefix' => 'EQP-',
            'next_number' => 1,
            'padding' => 5,
        ]);

        $first = $seq->generateNext();
        $second = $seq->generateNext();

        $this->assertEquals('EQP-00001', $first);
        $this->assertEquals('EQP-00002', $second);
        $this->assertDatabaseHas('numbering_sequences', [
            'id' => $seq->id,
            'next_number' => 3,
        ]);
    }
}
