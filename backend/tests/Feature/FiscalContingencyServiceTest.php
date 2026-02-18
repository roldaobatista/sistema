<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\FiscalNote;
use App\Models\Tenant;
use App\Services\Fiscal\ContingencyService;
use App\Services\Fiscal\FiscalProvider;
use App\Services\Fiscal\FiscalResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class FiscalContingencyServiceTest extends TestCase
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

    // ─── saveOffline ─────────────────────────────────

    public function test_save_offline_sets_contingency_mode_and_pending(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $service = new ContingencyService($provider);

        $note = FiscalNote::factory()->nfe()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => 'authorized',
            'contingency_mode' => false,
        ]);

        $payload = ['ref' => 'test_ref', 'items' => []];
        $service->saveOffline($note, $payload);

        $note->refresh();
        $this->assertEquals(FiscalNote::STATUS_PENDING, $note->status);
        $this->assertTrue($note->contingency_mode);
        $this->assertArrayHasKey('offline_payload', $note->raw_response);
        $this->assertArrayHasKey('queued_at', $note->raw_response);
    }

    // ─── pendingCount ────────────────────────────────

    public function test_pending_count_returns_correct_count(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $service = new ContingencyService($provider);

        FiscalNote::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => true,
            'status' => FiscalNote::STATUS_PENDING,
        ]);

        FiscalNote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => false,
            'status' => FiscalNote::STATUS_AUTHORIZED,
        ]);

        $this->assertEquals(3, $service->pendingCount($this->tenant->id));
    }

    public function test_pending_count_zero_when_no_contingency(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $service = new ContingencyService($provider);

        $this->assertEquals(0, $service->pendingCount($this->tenant->id));
    }

    // ─── isSefazAvailable ────────────────────────────

    public function test_sefaz_available_returns_true_when_online(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $provider->shouldReceive('consultarStatusServico')
            ->with('MT')
            ->once()
            ->andReturn(FiscalResult::ok(['status' => 'online']));

        $service = new ContingencyService($provider);

        $this->assertTrue($service->isSefazAvailable());
    }

    public function test_sefaz_available_returns_false_on_exception(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $provider->shouldReceive('consultarStatusServico')
            ->with('MT')
            ->once()
            ->andThrow(new \Exception('Connection timeout'));

        $service = new ContingencyService($provider);

        $this->assertFalse($service->isSefazAvailable());
    }

    // ─── retransmitPending ───────────────────────────

    public function test_retransmit_pending_returns_empty_when_no_notes(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $service = new ContingencyService($provider);

        $result = $service->retransmitPending($this->tenant);

        $this->assertEquals(0, $result['total']);
        $this->assertEquals(0, $result['success']);
        $this->assertEmpty($result['results']);
    }

    public function test_retransmit_pending_aborts_when_sefaz_unavailable(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $provider->shouldReceive('consultarStatusServico')
            ->once()
            ->andReturn(FiscalResult::fail('offline'));

        FiscalNote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => true,
            'status' => FiscalNote::STATUS_PENDING,
            'raw_response' => ['offline_payload' => ['ref' => 'test']],
        ]);

        $service = new ContingencyService($provider);
        $result = $service->retransmitPending($this->tenant);

        $this->assertEquals(1, $result['total']);
        $this->assertEquals(0, $result['success']);
        $this->assertStringContainsString('indisponível', $result['message']);
    }

    public function test_retransmit_pending_processes_notes_successfully(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);

        $provider->shouldReceive('consultarStatusServico')
            ->once()
            ->andReturn(FiscalResult::ok());

        $provider->shouldReceive('emitirNFe')
            ->once()
            ->andReturn(FiscalResult::ok([
                'provider_id' => 'prov-123',
                'access_key' => '44chars-key-here',
                'number' => '100',
                'series' => '1',
                'status' => 'authorized',
            ]));

        $note = FiscalNote::factory()->nfe()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => true,
            'status' => FiscalNote::STATUS_PENDING,
            'reference' => 'nfe_1_test',
            'raw_response' => ['offline_payload' => ['ref' => 'nfe_1_test', 'items' => []]],
        ]);

        $service = new ContingencyService($provider);
        $result = $service->retransmitPending($this->tenant);

        $this->assertEquals(1, $result['total']);
        $this->assertEquals(1, $result['success']);
        $this->assertEquals(0, $result['failed']);

        $note->refresh();
        $this->assertFalse($note->contingency_mode);
        $this->assertEquals(FiscalNote::STATUS_AUTHORIZED, $note->status);
        $this->assertEquals('prov-123', $note->provider_id);
    }

    // ─── retransmitNote ──────────────────────────────

    public function test_retransmit_note_fails_without_payload(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $service = new ContingencyService($provider);

        $note = FiscalNote::factory()->nfe()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => true,
            'status' => FiscalNote::STATUS_PENDING,
            'raw_response' => null,
        ]);

        $result = $service->retransmitNote($note);

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('Payload', $result['error']);
    }

    public function test_retransmit_note_handles_provider_failure(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $provider->shouldReceive('emitirNFe')
            ->once()
            ->andReturn(FiscalResult::fail('SEFAZ rejeitou'));

        $note = FiscalNote::factory()->nfe()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => true,
            'status' => FiscalNote::STATUS_PENDING,
            'reference' => 'nfe_test',
            'raw_response' => ['offline_payload' => ['ref' => 'nfe_test']],
        ]);

        $service = new ContingencyService($provider);
        $result = $service->retransmitNote($note);

        $this->assertFalse($result['success']);
        $this->assertEquals('SEFAZ rejeitou', $result['error']);
    }

    public function test_retransmit_note_handles_exception(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $provider->shouldReceive('emitirNFe')
            ->once()
            ->andThrow(new \Exception('Network error'));

        $note = FiscalNote::factory()->nfe()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => true,
            'status' => FiscalNote::STATUS_PENDING,
            'reference' => 'nfe_test',
            'raw_response' => ['offline_payload' => ['ref' => 'nfe_test']],
        ]);

        $service = new ContingencyService($provider);
        $result = $service->retransmitNote($note);

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('Network error', $result['error']);
    }

    public function test_retransmit_nfse_uses_correct_provider_method(): void
    {
        $provider = Mockery::mock(FiscalProvider::class);
        $provider->shouldReceive('emitirNFSe')
            ->once()
            ->andReturn(FiscalResult::ok([
                'provider_id' => 'nfse-456',
                'verification_code' => 'VC123',
                'status' => 'authorized',
            ]));

        $note = FiscalNote::factory()->nfse()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => true,
            'status' => FiscalNote::STATUS_PENDING,
            'reference' => 'nfse_test',
            'raw_response' => ['offline_payload' => ['ref' => 'nfse_test']],
        ]);

        $service = new ContingencyService($provider);
        $result = $service->retransmitNote($note);

        $this->assertTrue($result['success']);
        $note->refresh();
        $this->assertEquals('VC123', $note->verification_code);
    }
}
