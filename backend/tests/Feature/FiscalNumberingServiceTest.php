<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Services\Fiscal\FiscalNumberingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FiscalNumberingServiceTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private FiscalNumberingService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create([
            'fiscal_nfe_next_number' => 1,
            'fiscal_nfe_series' => 1,
            'fiscal_nfse_rps_next_number' => 1,
            'fiscal_nfse_rps_series' => 'RPS',
        ]);

        $this->service = new FiscalNumberingService();
    }

    // ─── NF-e Numbering ──────────────────────────────

    public function test_next_nfe_number_returns_first_number(): void
    {
        $result = $this->service->nextNFeNumber($this->tenant);

        $this->assertEquals(1, $result['number']);
        $this->assertEquals(1, $result['series']);
    }

    public function test_next_nfe_number_increments_atomically(): void
    {
        $first = $this->service->nextNFeNumber($this->tenant);
        $second = $this->service->nextNFeNumber($this->tenant->fresh());

        $this->assertEquals(1, $first['number']);
        $this->assertEquals(2, $second['number']);
    }

    public function test_next_nfe_number_uses_custom_series(): void
    {
        $result = $this->service->nextNFeNumber($this->tenant, 5);

        $this->assertEquals(5, $result['series']);
    }

    public function test_sequential_nfe_numbers_no_gaps(): void
    {
        $numbers = [];
        for ($i = 0; $i < 5; $i++) {
            $result = $this->service->nextNFeNumber($this->tenant->fresh());
            $numbers[] = $result['number'];
        }

        $this->assertEquals([1, 2, 3, 4, 5], $numbers);
    }

    // ─── NFS-e RPS Numbering ─────────────────────────

    public function test_next_nfse_rps_number_returns_first(): void
    {
        $result = $this->service->nextNFSeRpsNumber($this->tenant);

        $this->assertEquals(1, $result['number']);
        $this->assertEquals('RPS', $result['series']);
    }

    public function test_next_nfse_rps_number_increments(): void
    {
        $first = $this->service->nextNFSeRpsNumber($this->tenant);
        $second = $this->service->nextNFSeRpsNumber($this->tenant->fresh());

        $this->assertEquals(1, $first['number']);
        $this->assertEquals(2, $second['number']);
    }

    public function test_nfse_rps_custom_series(): void
    {
        $result = $this->service->nextNFSeRpsNumber($this->tenant, 'SVC');

        $this->assertEquals('SVC', $result['series']);
    }

    // ─── Gap Detection ───────────────────────────────

    public function test_has_gap_returns_true_when_gap_exists(): void
    {
        $this->assertTrue($this->service->hasGap($this->tenant, 5));
    }

    public function test_has_gap_returns_false_when_no_gap(): void
    {
        $this->assertFalse($this->service->hasGap($this->tenant, 1));
    }

    // ─── Manual Set ──────────────────────────────────

    public function test_set_nfe_next_number(): void
    {
        $this->service->setNFeNextNumber($this->tenant, 100);

        $this->assertEquals(100, $this->tenant->fresh()->fiscal_nfe_next_number);
    }

    public function test_set_nfe_next_number_with_series(): void
    {
        $this->service->setNFeNextNumber($this->tenant, 50, 3);

        $fresh = $this->tenant->fresh();
        $this->assertEquals(50, $fresh->fiscal_nfe_next_number);
        $this->assertEquals(3, $fresh->fiscal_nfe_series);
    }

    public function test_set_nfse_next_number(): void
    {
        $this->service->setNFSeNextNumber($this->tenant, 200);

        $this->assertEquals(200, $this->tenant->fresh()->fiscal_nfse_rps_next_number);
    }

    public function test_set_nfse_next_number_with_series(): void
    {
        $this->service->setNFSeNextNumber($this->tenant, 75, 'NFSE');

        $fresh = $this->tenant->fresh();
        $this->assertEquals(75, $fresh->fiscal_nfse_rps_next_number);
        $this->assertEquals('NFSE', $fresh->fiscal_nfse_rps_series);
    }
}
