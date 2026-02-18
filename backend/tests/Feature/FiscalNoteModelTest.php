<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\FiscalNote;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FiscalNoteModelTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
    }

    // ─── Type helpers ────────────────────────────────

    public function test_is_nfe_returns_true_for_nfe(): void
    {
        $note = FiscalNote::factory()->nfe()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertTrue($note->isNFe());
        $this->assertFalse($note->isNFSe());
    }

    public function test_is_nfse_returns_true_for_nfse(): void
    {
        $note = FiscalNote::factory()->nfse()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertTrue($note->isNFSe());
        $this->assertFalse($note->isNFe());
    }

    // ─── Status helpers ──────────────────────────────

    public function test_is_pending_includes_pending_status(): void
    {
        $note = FiscalNote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => FiscalNote::STATUS_PENDING,
        ]);

        $this->assertTrue($note->isPending());
    }

    public function test_is_pending_includes_processing_status(): void
    {
        $note = FiscalNote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => FiscalNote::STATUS_PROCESSING,
        ]);

        $this->assertTrue($note->isPending());
    }

    public function test_is_authorized(): void
    {
        $note = FiscalNote::factory()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertTrue($note->isAuthorized());
        $this->assertFalse($note->isPending());
        $this->assertFalse($note->isCancelled());
    }

    public function test_is_cancelled(): void
    {
        $note = FiscalNote::factory()->cancelled()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertTrue($note->isCancelled());
    }

    // ─── Business rules ──────────────────────────────

    public function test_can_cancel_only_when_authorized(): void
    {
        $authorized = FiscalNote::factory()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);
        $pending = FiscalNote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => FiscalNote::STATUS_PENDING,
        ]);

        $this->assertTrue($authorized->canCancel());
        $this->assertFalse($pending->canCancel());
    }

    public function test_can_correct_only_nfe_authorized(): void
    {
        $nfe = FiscalNote::factory()->nfe()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);
        $nfse = FiscalNote::factory()->nfse()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);
        $cancelled = FiscalNote::factory()->nfe()->cancelled()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertTrue($nfe->canCorrect());
        $this->assertFalse($nfse->canCorrect());
        $this->assertFalse($cancelled->canCorrect());
    }

    // ─── Scopes ──────────────────────────────────────

    public function test_scope_for_tenant_filters_correctly(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);

        FiscalNote::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);
        FiscalNote::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $otherCustomer->id,
        ]);

        $this->assertCount(2, FiscalNote::forTenant($this->tenant->id)->get());
    }

    public function test_scope_of_type(): void
    {
        FiscalNote::factory()->nfe()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);
        FiscalNote::factory()->nfse()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertCount(1, FiscalNote::ofType('nfe')->get());
        $this->assertCount(2, FiscalNote::ofType('nfse')->get());
    }

    public function test_scope_authorized(): void
    {
        FiscalNote::factory()->authorized()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);
        FiscalNote::factory()->cancelled()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertCount(3, FiscalNote::authorized()->get());
    }

    // ─── Reference generation ────────────────────────

    public function test_generate_reference_format(): void
    {
        $ref = FiscalNote::generateReference('nfe', $this->tenant->id);

        $this->assertStringStartsWith('nfe_' . $this->tenant->id . '_', $ref);
        $this->assertGreaterThan(20, strlen($ref));
    }

    public function test_generate_reference_uniqueness(): void
    {
        $refs = [];
        for ($i = 0; $i < 10; $i++) {
            $refs[] = FiscalNote::generateReference('nfe', $this->tenant->id);
        }

        $this->assertCount(10, array_unique($refs));
    }

    // ─── Casts ───────────────────────────────────────

    public function test_raw_response_cast_to_array(): void
    {
        $note = FiscalNote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'raw_response' => ['key' => 'value'],
        ]);

        $this->assertIsArray($note->fresh()->raw_response);
        $this->assertEquals('value', $note->fresh()->raw_response['key']);
    }

    public function test_contingency_mode_cast_to_boolean(): void
    {
        $note = FiscalNote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => 1,
        ]);

        $this->assertIsBool($note->fresh()->contingency_mode);
        $this->assertTrue($note->fresh()->contingency_mode);
    }
}
